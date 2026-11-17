// Repository against Supabase. RLS on the server decides what each user gets; this file only maps and uploads.
import { todayManila } from '../domain/dates'
import type { Submission } from '../domain/field'
import type { MonthClose } from '../domain/monthEnd'
import type { Hub, Incident, Network, PO, Segment, Settings, Snapshot } from '../domain/types'
import { ASSUMED_SOURCE, assumedNetwork } from './network'
import type { AckView, Repository } from './repo'
import {
  closeFromRows, delayRow, incidentRow, milestoneRows, networkFromRows, nodeRow, noticeRow, poRow, ptlRow, reasonRows,
  segmentRow, settingsFromRows, settingsValue, snapshotFromRows, updateRow, type Tables,
} from './rows'
import { supabase } from './supabaseClient'

type Row = Record<string, unknown>
const PAGE = 1000 // PostgREST's default max rows per request

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/** Every row the caller may see, a page at a time. */
async function all(table: string, columns = '*'): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const page = check(await supabase.from(table).select(columns).range(from, from + PAGE - 1)) as unknown as Row[]
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

const isPath = (s: string | undefined): s is string => !!s && !s.startsWith('data:') && !s.startsWith('http') && s.includes('/')
const folder = (poId?: string) => poId ?? 'no-po'

/** Upload a data: URL to Storage (overwrites on retry); other values (paths, seeded ids) pass through. */
async function store(bucket: string, path: string, value: string): Promise<string> {
  if (!value.startsWith('data:')) return value
  const blob = await (await fetch(value)).blob()
  check(await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type }))
  return path
}

export class SupabaseRepo implements Repository {
  /** Last loaded state per close period, to write only what changed. */
  private closes = new Map<string, { close: MonthClose; exists: boolean }>()
  /** Signed URL -> storage path, so a record read with URLs is saved back with paths. */
  private paths = new Map<string, string>()
  private unsign = (s: string) => this.paths.get(s) ?? s

  async getSnapshot(): Promise<Snapshot> {
    const names = ['contractors', 'programs', 'categories', 'clusters', 'crews', 'crew_pos', 'pos', 'ptl_versions', 'po_milestones', 'delay_events', 'field_updates', 'incidents'] as const
    const data = await Promise.all(names.map(n => all(n)))
    const snap = snapshotFromRows(Object.fromEntries(names.map((n, i) => [n, data[i]])) as unknown as Tables, todayManila())
    return this.signUrls(snap)
  }

  /** Storage paths -> short-lived URLs the <img> tags can load (buckets are private). */
  private async signUrls(snap: Snapshot): Promise<Snapshot> {
    const photos = [...snap.updates.flatMap(u => u.photoIds), ...snap.incidents.flatMap(i => [...(i.photoIds ?? []), i.blotterPhotoId])].filter(isPath)
    const sigs = snap.incidents.map(i => i.undertaking?.signature).filter(isPath)
    const signed = new Map<string, string>()
    for (const [bucket, paths] of [['field-photos', photos], ['signatures', sigs]] as const) {
      for (let i = 0; i < paths.length; i += PAGE) {
        const { data } = await supabase.storage.from(bucket).createSignedUrls(paths.slice(i, i + PAGE), 3600)
        for (const d of data ?? []) if (d.path && d.signedUrl) { signed.set(d.path, d.signedUrl); this.paths.set(d.signedUrl, d.path) }
      }
    }
    if (!signed.size) return snap
    const url = (p: string) => signed.get(p) ?? p
    return {
      ...snap,
      updates: snap.updates.map(u => ({ ...u, photoIds: u.photoIds.map(url) })),
      incidents: snap.incidents.map(i => ({
        ...i,
        ...(i.photoIds && { photoIds: i.photoIds.map(url) }),
        ...(i.blotterPhotoId && { blotterPhotoId: url(i.blotterPhotoId) }),
        ...(i.undertaking && { undertaking: { ...i.undertaking, signature: url(i.undertaking.signature) } }),
      })),
    }
  }

  async getNetwork(): Promise<Network> {
    const [segs, nodes, settings] = await Promise.all([all('segments_api'), all('network_nodes'), supabase.from('settings').select('network_source').maybeSingle()])
    return networkFromRows(segs, nodes, check(settings)?.network_source as string | undefined)
  }

  async getNetworkSource() {
    const s = check(await supabase.from('settings').select('network_source').maybeSingle())
    return s?.network_source ? `Imported: ${s.network_source}` : ASSUMED_SOURCE
  }

  async saveNetwork(n: { name: string; network: Network } | null) {
    const net = n?.network ?? assumedNetwork()
    check(await supabase.rpc('replace_network', {
      segs: net.segments.map(segmentRow), nodes: net.hubs.map(nodeRow), source: n?.name ?? null, origin: n ? 'imported' : 'assumed',
    }))
  }

  async getSettings(): Promise<Settings> {
    const [s, reasons, holidays] = await Promise.all([supabase.from('settings').select('*').maybeSingle(), all('reason_codes'), all('holidays')])
    return settingsFromRows(check(s) ?? undefined, reasons, holidays)
  }

  async saveSettings(s: Settings) {
    check(await supabase.rpc('save_settings', { value: settingsValue(s), reasons: reasonRows(s), holiday_days: s.holidays }))
  }

  async submit(sub: Submission): Promise<Snapshot> {
    if (sub.kind === 'update') {
      const u = sub.update
      const photoIds = await Promise.all(u.photoIds.map((p, i) => store('field-photos', `${u.poId}/${u.id}-${i}.jpg`, p)))
      // Same id again (outbox retry after a lost reply) is ignored, never applied twice.
      check(await supabase.from('field_updates').upsert(updateRow({ ...u, photoIds }), { onConflict: 'id', ignoreDuplicates: true }))
    } else if (sub.kind === 'blocker') {
      check(await supabase.from('delay_events').upsert(delayRow(sub.delay), { onConflict: 'id' }))
    } else if (sub.kind === 'incident') {
      check(await supabase.from('incidents').upsert(incidentRow(await this.uploadIncident(sub.incident)), { onConflict: 'id', ignoreDuplicates: true }))
    } else {
      await this.createPo(sub.po, { crewId: sub.crewId })
    }
    return this.getSnapshot()
  }

  private async uploadIncident(i: Incident): Promise<Incident> {
    const dir = `${folder(i.poId)}/${i.id}`
    return {
      ...i,
      ...(i.photoIds && { photoIds: await Promise.all(i.photoIds.map((p, n) => store('field-photos', `${dir}-${n}.jpg`, p))) }),
      ...(i.blotterPhotoId && { blotterPhotoId: await store('field-photos', `${dir}-blotter.jpg`, i.blotterPhotoId) }),
      ...(i.undertaking && { undertaking: { ...i.undertaking, signature: await store('signatures', `${dir}.png`, i.undertaking.signature) } }),
    }
  }

  async saveIncident(i: Incident) {
    const row = incidentRow(await this.uploadIncident({
      ...i,
      ...(i.photoIds && { photoIds: i.photoIds.map(this.unsign) }),
      ...(i.blotterPhotoId && { blotterPhotoId: this.unsign(i.blotterPhotoId) }),
      ...(i.undertaking && { undertaking: { ...i.undertaking, signature: this.unsign(i.undertaking.signature) } }),
    }))
    const { id, ...changes } = row
    check(await supabase.from('incidents').update(changes).eq('id', id))
    return this.getSnapshot()
  }

  async createPo(po: PO, opts: { crewId?: string; segment?: Segment } = {}) {
    check(await supabase.rpc('create_po', {
      po: poRow(po), ptl: ptlRow(po.id, po.ptl[0]), milestones: milestoneRows(po),
      crew_id: opts.crewId ?? null, segment: opts.segment ? segmentRow(opts.segment) : null,
    }))
  }

  async saveHub(hub: Hub) {
    check(await supabase.from('network_nodes').upsert(nodeRow(hub), { onConflict: 'id' }))
  }

  async removeHub(id: string) {
    check(await supabase.from('network_nodes').delete().eq('id', id))
  }

  async getClose(period: string): Promise<MonthClose> {
    const [close, gaps, waivers, notices] = await Promise.all([
      supabase.from('month_closes').select('*').eq('period', period).maybeSingle(),
      supabase.from('close_gaps').select('*').eq('period', period),
      supabase.from('close_waivers').select('*').eq('period', period),
      supabase.from('ld_notices').select('*').eq('period', period),
    ])
    const c = closeFromRows(period, check(close) ?? undefined, check(gaps) ?? [], check(waivers) ?? [], check(notices) ?? [])
    this.closes.set(period, { close: c, exists: !!check(close) })
    return c
  }

  /** Writes only what changed since the last load, so a contractor's acknowledgment never touches PMO rows. */
  async saveClose(c: MonthClose) {
    const last = this.closes.get(c.period) ?? { close: { period: c.period, steps: {}, gap: {}, waived: {}, notices: {} }, exists: false }
    const prev = last.close
    let exists = last.exists
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    const changed = <T,>(next: Record<string, T>, old: Record<string, T>) => Object.keys(next).filter(k => !same(next[k], old[k]))
    const removed = <T,>(next: Record<string, T>, old: Record<string, T>) => Object.keys(old).filter(k => !(k in next))
    const p = c.period

    const gapKeys = changed(c.gap, prev.gap), waiveKeys = changed(c.waived, prev.waived), noticeKeys = changed(c.notices, prev.notices)
    if (!same(c.steps, prev.steps) || (!exists && (gapKeys.length || waiveKeys.length || noticeKeys.some(k => !prev.notices[k])))) {
      check(await supabase.from('month_closes').upsert({ period: p, steps: c.steps }, { onConflict: 'period' }))
      exists = true
    }
    if (gapKeys.length) check(await supabase.from('close_gaps').upsert(gapKeys.map(po_id => ({ period: p, po_id, ...c.gap[po_id] })), { onConflict: 'period,po_id' }))
    for (const po_id of removed(c.gap, prev.gap)) check(await supabase.from('close_gaps').delete().match({ period: p, po_id }))
    if (waiveKeys.length) check(await supabase.from('close_waivers').upsert(waiveKeys.map(po_id => ({ period: p, po_id, reason: c.waived[po_id] })), { onConflict: 'period,po_id' }))
    for (const po_id of removed(c.waived, prev.waived)) check(await supabase.from('close_waivers').delete().match({ period: p, po_id }))
    for (const k of noticeKeys) {
      const { period: _p, contractor_id: _c, ...fields } = noticeRow(p, k, c.notices[k])
      // Existing notice = update (all a contractor may do); new = insert (PMO only).
      if (prev.notices[k]) check(await supabase.from('ld_notices').update(fields).match({ period: p, contractor_id: k }))
      else check(await supabase.from('ld_notices').insert(noticeRow(p, k, c.notices[k])))
    }
    this.closes.set(p, { close: c, exists })
  }

  async getAck(id: string, token: string): Promise<AckView | null> {
    const r = check(await supabase.rpc('ack_incident', { incident_id: id, token })) as Row | null
    return r && {
      id: r.id as string, responsibleParty: r.responsible_party as string, receivedAt: r.received_at as string,
      faultLocation: r.fault_location as string, affectedLink: r.affected_link as string, description: r.description as string, bom: r.bom as Incident['bom'],
      signed: !!r.undertaking,
    }
  }

  async signAck(id: string, token: string, u: { name: string; position: string; signature: string }) {
    return !!check(await supabase.rpc('sign_undertaking', { incident_id: id, token, signer_name: u.name, signer_position: u.position, signature: u.signature }))
  }

  subscribe(onChange: () => void) {
    const ch = supabase.channel('backbone').on('postgres_changes', { event: '*', schema: 'public' }, onChange).subscribe()
    return () => { supabase.removeChannel(ch) }
  }
}
