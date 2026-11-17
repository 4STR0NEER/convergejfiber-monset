// Data access seam. UI only talks to `Repository`: LocalRepo (demo mode) or SupabaseRepo.
import { get, set } from 'idb-keyval'
import { DEFAULT_SETTINGS } from '../domain/config'
import { applySubmission, type Submission } from '../domain/field'
import { emptyClose, type MonthClose } from '../domain/monthEnd'
import { todayManila } from '../domain/dates'
import type { Hub, Incident, Network, PO, Segment, Settings, Snapshot } from '../domain/types'
import { ASSUMED_SOURCE, assumedNetwork, placeOnRoutes } from './network'
import { generateSeed, manilaIso } from './seed'
import { DEMO } from './supabase'

export interface Repository {
  getSnapshot(): Promise<Snapshot>
  getNetwork(): Promise<Network>
  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
  /** A field submission that reached the server (after the outbox synced it). */
  submit(sub: Submission): Promise<Snapshot>
  /** Office edits to an incident (BOM, award, undertaking). */
  saveIncident(i: Incident): Promise<Snapshot>
  /** Replace the drawn network (imported KMZ/KML/GeoJSON). null = back to the assumed routes. */
  saveNetwork(n: { name: string; network: Network } | null): Promise<void>
  getNetworkSource(): Promise<string>
  /** Office: add a PO / WO (optionally with its drawn route and a crew). */
  createPo(po: PO, opts?: { crewId?: string; segment?: Segment }): Promise<void>
  /** Office: add or rename a network node, or remove one. */
  saveHub(hub: Hub): Promise<void>
  removeHub(id: string): Promise<void>
  getClose(period: string): Promise<MonthClose>
  saveClose(c: MonthClose): Promise<void>
  /** QR signing page: the incident summary, for whoever holds the link (token checked on the server). */
  getAck(id: string, token: string): Promise<AckView | null>
  signAck(id: string, token: string, u: { name: string; position: string; signature: string }): Promise<boolean>
  /** Live changes from other users (server only). Returns an unsubscribe function. */
  subscribe?(onChange: () => void): () => void
}

/** What the signing page may show a third party. */
export interface AckView { id: string; responsibleParty: string; receivedAt: string; faultLocation: string; affectedLink: string; description: string; bom: Incident['bom']; signed: boolean }

// ponytail: local "server" = IndexedDB log replayed over the deterministic seed. Supabase replaces it.
const APPLIED_KEY = 'cjf.applied.v1'

const SETTINGS_KEY = 'cjf.settings.v1'
/** Hand edits layered over whichever route file is loaded, so importing routes keeps them. */
const EDITS_KEY = 'cjf.network.edits.v1'
interface NetworkEdits { segments: Segment[]; hubs: Hub[]; removedHubs: string[] }
const NO_EDITS: NetworkEdits = { segments: [], hubs: [], removedHubs: [] }

export class LocalRepo implements Repository {
  private snap?: Snapshot
  private network?: Network
  private source = ASSUMED_SOURCE

  async getNetwork() {
    if (this.network) return this.network
    const imported = await get<{ name: string; network: Network }>('cjf.network').catch(() => undefined)
    const assumed = assumedNetwork()
    // A route file without node points keeps the known NOC and hubs.
    const base = !imported ? assumed : { ...imported.network, hubs: imported.network.hubs.length ? imported.network.hubs : assumed.hubs, source: imported.name }
    if (imported) this.source = `Imported: ${imported.name}`
    const e = (await get<NetworkEdits>(EDITS_KEY).catch(() => undefined)) ?? NO_EDITS
    const added = new Map(e.hubs.map(h => [h.id, h]))
    return (this.network = {
      ...base,
      segments: [...base.segments.filter(s => !e.segments.some(x => x.segmentId === s.segmentId)), ...e.segments],
      hubs: [...base.hubs.filter(h => !e.removedHubs.includes(h.id)).map(h => added.get(h.id) ?? h), ...e.hubs.filter(h => !base.hubs.some(b => b.id === h.id) && !e.removedHubs.includes(h.id))],
    })
  }

  private async editNetwork(fn: (e: NetworkEdits) => NetworkEdits) {
    const e = (await get<NetworkEdits>(EDITS_KEY).catch(() => undefined)) ?? NO_EDITS
    await set(EDITS_KEY, fn(e)).catch(() => { /* not persisted */ })
    this.network = undefined
    this.snap = undefined // crews and incidents are re-placed on the routes
  }

  async createPo(po: PO, opts: { crewId?: string; segment?: Segment } = {}) {
    if (opts.segment) await this.editNetwork(e => ({ ...e, segments: [...e.segments, opts.segment!] }))
    await this.submit({ kind: 'po', po, crewId: opts.crewId })
  }

  async saveHub(hub: Hub) {
    await this.editNetwork(e => ({ ...e, hubs: [...e.hubs.filter(h => h.id !== hub.id), hub], removedHubs: e.removedHubs.filter(id => id !== hub.id) }))
  }

  async removeHub(id: string) {
    await this.editNetwork(e => ({ ...e, hubs: e.hubs.filter(h => h.id !== id), removedHubs: [...new Set([...e.removedHubs, id])] }))
  }

  async getNetworkSource() { await this.getNetwork(); return this.source }

  async saveNetwork(n: { name: string; network: Network } | null) {
    await (n ? set('cjf.network', n) : set('cjf.network', undefined)).catch(() => { /* not persisted */ })
    this.network = undefined
    this.snap = undefined // crews and incidents are re-placed on the new routes
  }

  async submit(sub: Submission) {
    const log = ((await get<Submission[]>(APPLIED_KEY).catch(() => undefined)) ?? []).concat(sub)
    await set(APPLIED_KEY, log).catch(() => { /* kept in memory only */ })
    return (this.snap = applySubmission(await this.getSnapshot(), sub))
  }

  async saveIncident(incident: Incident) { return this.submit({ kind: 'incident', incident }) }

  async getClose(period: string) {
    return (await get<MonthClose>(`cjf.close.${period}`).catch(() => undefined)) ?? emptyClose(period)
  }

  async saveClose(c: MonthClose) {
    await set(`cjf.close.${c.period}`, c).catch(() => { /* not persisted */ })
  }

  async getSnapshot() {
    if (this.snap) return this.snap
    const snap = placeOnRoutes(generateSeed({ asOf: todayManila(), nowMs: Date.now() }), await this.getNetwork())
    const log = (await get<Submission[]>(APPLIED_KEY).catch(() => undefined)) ?? []
    return (this.snap = log.reduce(applySubmission, snap))
  }

  async getSettings(): Promise<Settings> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch { /* private mode or corrupt value: fall back to defaults */ }
    return DEFAULT_SETTINGS
  }

  async saveSettings(s: Settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* not persisted */ }
  }

  // Demo: no token check, the link is the incident id.
  async getAck(id: string): Promise<AckView | null> {
    const i = (await this.getSnapshot()).incidents.find(x => x.id === id)
    return i ? { id: i.id, responsibleParty: i.responsibleParty, receivedAt: i.receivedAt, faultLocation: i.faultLocation, affectedLink: i.affectedLink, description: i.description, bom: i.bom, signed: !!i.undertaking } : null
  }

  async signAck(id: string, _token: string, u: { name: string; position: string; signature: string }) {
    const i = (await this.getSnapshot()).incidents.find(x => x.id === id)
    if (!i || i.undertaking) return false
    await this.saveIncident({ ...i, undertakingSigned: true, undertaking: { ...u, at: manilaIso(Date.now()), via: 'qr-link' } })
    return true
  }
}

// Demo mode keeps everything in this browser; otherwise Supabase (loaded only when used).
export const repo: Repository = DEMO ? new LocalRepo() : new (await import('./supabaseRepo')).SupabaseRepo()
