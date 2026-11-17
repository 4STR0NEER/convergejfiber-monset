// Domain objects <-> database rows (supabase/migrations). Pure, so the Supabase repo, the seed script and the
// RLS tests all map the same way. Geography is written as lng/lat columns (points) or GeoJSON coordinates (routes).
import { DEFAULT_SETTINGS } from '../domain/config'
import type { MonthClose } from '../domain/monthEnd'
import {
  MILESTONES, type Category, type Cluster, type Contractor, type Crew, type DelayEvent, type FieldUpdate, type Hub,
  type Incident, type MilestoneKey, type Network, type PO, type Program, type PtlVersion, type Segment, type Settings, type Snapshot,
} from '../domain/types'

type Row = Record<string, unknown>
// Postgres returns null where the app uses undefined.
const u = <T,>(v: T | null | undefined) => (v ?? undefined) as T | undefined
const num = (v: unknown) => (v == null ? 0 : Number(v))

// ───────── to rows ─────────
export const poRow = (p: PO): Row => ({
  id: p.id, kind: p.kind, title: p.title, program_id: p.programId, cluster_id: p.clusterId, category_id: p.categoryId,
  contractor_id: p.contractorId, cost_of_works: p.costOfWorks, length_km: p.lengthKm, pat_date: p.patDate ?? null, docs_submitted_at: p.docsSubmittedAt ?? null,
})
export const ptlRow = (poId: string, v: PtlVersion): Row => ({
  po_id: poId, version: v.version, signed_at: v.signedAt, start: v.start, target_pat: v.targetPat, milestones: v.milestones, note: v.note ?? null,
})
export const milestoneRows = (p: PO): Row[] => MILESTONES.map(m => ({
  po_id: p.id, milestone: m, progress: p.progress[m] ?? 0, actual_start: p.milestoneActual[m]?.start ?? null, actual_end: p.milestoneActual[m]?.end ?? null,
}))
export const delayRow = (d: DelayEvent): Row => ({
  id: d.id, po_id: d.poId, reason_code: d.reasonCode, milestone: d.milestone, start: d.start, end: d.end ?? null, note: d.note, reported_by: d.reportedBy,
})
export const updateRow = (x: FieldUpdate): Row => ({
  id: x.id, po_id: x.poId, crew_id: x.crewId, milestone: x.milestone, progress: x.progress, photo_paths: x.photoIds,
  lng: x.gps[0], lat: x.gps[1], gps_source: x.gpsSource ?? null, gps_accuracy_m: x.gpsAccuracyM ?? null,
  distance_to_route_km: x.distanceToRouteKm ?? null, at: x.at, note: x.note ?? null,
})
export const incidentRow = (i: Incident): Row => ({
  id: i.id, po_id: i.poId ?? null, cluster_id: i.clusterId, responsible_party: i.responsibleParty, witnessing_msp: i.witnessingMsp,
  attending: i.attending, ticket_ref: i.ticketRef, related_tickets: i.relatedTickets, affected_link: i.affectedLink, fault_location: i.faultLocation,
  lng: i.gps[0], lat: i.gps[1], received_at: i.receivedAt, restored_at: i.restoredAt ?? null, restoration_status: i.restorationStatus,
  description: i.description, undertaking_signed: i.undertakingSigned, blotter_attached: i.blotterAttached, bom: i.bom,
  permanent_restoration: i.permanentRestoration, photo_paths: i.photoIds ?? null, undertaking: i.undertaking ?? null,
  blotter_photo_path: i.blotterPhotoId ?? null, reported_by_crew: i.reportedByCrew ?? null,
})
export const segmentRow = (s: Segment): Row => ({ id: s.segmentId, po_id: s.poId, tier: s.tier, corridor: s.corridor, path: s.path })
export const nodeRow = (h: Hub): Row => ({ id: h.id, name: h.name, core: h.core, lng: h.coord[0], lat: h.coord[1] })
export const settingsValue = ({ reasons: _r, holidays: _h, ...value }: Settings) => value
export const reasonRows = (s: Settings): Row[] => s.reasons.map((r, i) => ({ code: r.code, label: r.label, description: r.description ?? null, ld_eligible: r.ldEligible, sort: i }))

/** Every table's rows for a whole portfolio (seed script, tests). Segments carry GeoJSON coordinates in `path`. */
export function snapshotRows(snap: Snapshot, network: Network, settings: Settings = DEFAULT_SETTINGS) {
  return {
    contractors: snap.contractors.map(c => ({ id: c.id, name: c.name, short: c.short })),
    programs: snap.programs.map(p => ({ id: p.id, name: p.name, type: p.type, unit: p.unit })),
    categories: snap.categories.map(c => ({ id: c.id, name: c.name, scope: c.scope })),
    clusters: snap.clusters.map(c => ({ id: c.id, name: c.name, lng: c.center[0], lat: c.center[1] })),
    reason_codes: reasonRows(settings),
    holidays: settings.holidays.map(day => ({ day })),
    settings: [{ id: 1, value: settingsValue(settings), network_source: network.source ?? null }],
    crews: snap.crews.map(c => ({ id: c.id, lead: c.lead, contractor_id: c.contractorId, last_lng: c.lastCheckIn.gps[0], last_lat: c.lastCheckIn.gps[1], last_at: c.lastCheckIn.at })),
    pos: snap.pos.map(poRow),
    crew_pos: snap.crews.flatMap(c => c.poIds.map(po_id => ({ crew_id: c.id, po_id }))),
    ptl_versions: snap.pos.flatMap(p => p.ptl.map(v => ptlRow(p.id, v))),
    po_milestones: snap.pos.flatMap(milestoneRows),
    delay_events: snap.delays.map(delayRow),
    field_updates: snap.updates.map(updateRow),
    incidents: snap.incidents.map(incidentRow),
    segments: network.segments.map(segmentRow),
    network_nodes: network.hubs.map(nodeRow),
  }
}

// ───────── from rows ─────────
export interface Tables {
  contractors: Row[]; programs: Row[]; categories: Row[]; clusters: Row[]; crews: Row[]; crew_pos: Row[]; pos: Row[]
  ptl_versions: Row[]; po_milestones: Row[]; delay_events: Row[]; field_updates: Row[]; incidents: Row[]
}

export function snapshotFromRows(t: Tables, asOf: string): Snapshot {
  const ptl = groupBy(t.ptl_versions, 'po_id')
  const ms = groupBy(t.po_milestones, 'po_id')
  const crewPos = groupBy(t.crew_pos, 'crew_id')
  return {
    asOf,
    contractors: t.contractors.map(r => ({ id: r.id, name: r.name, short: r.short }) as Contractor),
    programs: t.programs.map(r => ({ id: r.id, name: r.name, type: r.type, unit: r.unit }) as Program),
    categories: t.categories.map(r => ({ id: r.id, name: r.name, scope: r.scope }) as Category),
    clusters: t.clusters.map(r => ({ id: r.id, name: r.name, center: [num(r.lng), num(r.lat)] }) as Cluster),
    pos: t.pos.map(r => {
      const rows = ms.get(r.id as string) ?? []
      const progress = Object.fromEntries(MILESTONES.map(m => [m, num(rows.find(x => x.milestone === m)?.progress)])) as Record<MilestoneKey, number>
      const milestoneActual: PO['milestoneActual'] = {}
      for (const x of rows) {
        if (x.actual_start || x.actual_end) milestoneActual[x.milestone as MilestoneKey] = { start: u(x.actual_start as string), end: u(x.actual_end as string) }
      }
      return {
        id: r.id, kind: r.kind, title: r.title, programId: r.program_id, clusterId: r.cluster_id, categoryId: r.category_id,
        contractorId: r.contractor_id, costOfWorks: num(r.cost_of_works), lengthKm: num(r.length_km),
        ptl: (ptl.get(r.id as string) ?? []).sort((a, b) => num(a.version) - num(b.version)).map(v => ({
          version: num(v.version), signedAt: v.signed_at, start: v.start, targetPat: v.target_pat, milestones: v.milestones, ...(v.note != null && { note: v.note }),
        }) as PtlVersion),
        progress, milestoneActual,
        ...(r.pat_date != null && { patDate: r.pat_date }),
        ...(r.docs_submitted_at != null && { docsSubmittedAt: r.docs_submitted_at }),
      } as PO
    }),
    delays: t.delay_events.map(r => ({
      id: r.id, poId: r.po_id, reasonCode: r.reason_code, milestone: r.milestone, start: r.start, ...(r.end != null && { end: r.end }), note: r.note, reportedBy: r.reported_by,
    }) as DelayEvent),
    crews: t.crews.map(r => ({
      id: r.id, lead: r.lead, contractorId: r.contractor_id, poIds: (crewPos.get(r.id as string) ?? []).map(x => x.po_id as string),
      lastCheckIn: { gps: [num(r.last_lng), num(r.last_lat)], at: r.last_at },
    }) as Crew),
    updates: t.field_updates.map(r => strip({
      id: r.id, poId: r.po_id, crewId: r.crew_id, milestone: r.milestone, progress: num(r.progress), photoIds: r.photo_paths,
      gps: [num(r.lng), num(r.lat)], at: r.at, note: r.note, gpsSource: r.gps_source, gpsAccuracyM: r.gps_accuracy_m, distanceToRouteKm: r.distance_to_route_km,
    }) as unknown as FieldUpdate),
    incidents: t.incidents.map(r => strip({
      id: r.id, poId: r.po_id, clusterId: r.cluster_id, responsibleParty: r.responsible_party, witnessingMsp: r.witnessing_msp,
      attending: r.attending, ticketRef: r.ticket_ref, relatedTickets: r.related_tickets, affectedLink: r.affected_link, faultLocation: r.fault_location,
      gps: [num(r.lng), num(r.lat)], receivedAt: r.received_at, restoredAt: r.restored_at, restorationStatus: r.restoration_status,
      description: r.description, undertakingSigned: r.undertaking_signed, blotterAttached: r.blotter_attached, bom: r.bom,
      permanentRestoration: r.permanent_restoration, photoIds: r.photo_paths, undertaking: r.undertaking, blotterPhotoId: r.blotter_photo_path,
      reportedByCrew: r.reported_by_crew, ackToken: r.ack_token,
    }) as unknown as Incident),
  }
}

export function networkFromRows(segments: Row[], nodes: Row[], source: string | null | undefined): Network {
  return {
    segments: segments.map(r => ({ segmentId: r.id, poId: r.po_id, tier: r.tier, corridor: r.corridor, path: r.path }) as Segment),
    hubs: nodes.map(r => ({ id: r.id, name: r.name, coord: [num(r.lng), num(r.lat)], core: !!r.core }) as Hub),
    ...(source && { source }),
  }
}

export function settingsFromRows(settings: Row | undefined, reasons: Row[], holidays: Row[]): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings?.value as Partial<Settings> | undefined),
    reasons: reasons.filter(r => r.active !== false).sort((a, b) => num(a.sort) - num(b.sort))
      .map(r => ({ code: r.code as string, label: r.label as string, ...(r.description != null && { description: r.description as string }), ldEligible: !!r.ld_eligible })),
    holidays: holidays.map(h => String(h.day).slice(0, 10)).sort(),
  }
}

export function closeFromRows(period: string, close: Row | undefined, gaps: Row[], waivers: Row[], notices: Row[]): MonthClose {
  return {
    period,
    steps: (close?.steps as MonthClose['steps']) ?? {},
    gap: Object.fromEntries(gaps.map(g => [g.po_id, { text: g.text, reviewed: !!g.reviewed }])) as MonthClose['gap'],
    waived: Object.fromEntries(waivers.map(w => [w.po_id, w.reason])) as MonthClose['waived'],
    notices: Object.fromEntries(notices.map(n => [n.contractor_id, strip({
      sentAt: n.sent_at, ack: n.ack_name ? { name: n.ack_name, at: n.ack_at } : undefined, disputed: n.disputed,
    })])) as MonthClose['notices'],
  }
}
export const noticeRow = (period: string, contractorId: string, n: MonthClose['notices'][string]): Row => ({
  period, contractor_id: contractorId, sent_at: n.sentAt ?? null, ack_name: n.ack?.name ?? null, ack_at: n.ack?.at ?? null, disputed: n.disputed ?? null,
})

function groupBy(rows: Row[], key: string) {
  const m = new Map<string, Row[]>()
  for (const r of rows) m.set(r[key] as string, [...(m.get(r[key] as string) ?? []), r])
  return m
}
/** Drop null/undefined keys so rows read back equal what the app wrote. */
function strip<T extends Row>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as T
}
