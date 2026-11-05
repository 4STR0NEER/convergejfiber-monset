// Data access seam. UI only talks to `Repository`; swap LocalRepo for a SupabaseRepo later.
import { DEFAULT_SETTINGS } from '../domain/config'
import { todayManila } from '../domain/dates'
import { pointAlong } from '../domain/geo'
import { weightedProgress } from '../domain/status'
import type { LngLat, Network, Settings, Snapshot } from '../domain/types'
import { generateSeed } from './seed'
import networkJson from './network.geo.json'

export interface Repository {
  getSnapshot(): Promise<Snapshot>
  getNetwork(): Promise<Network>
  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
}

const SETTINGS_KEY = 'cjf.settings.v1'

/** GeoJSON FeatureCollection (assumed or imported routes) -> Network. */
export function parseNetwork(fc: { features: { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] }): Network {
  const segments: Network['segments'] = []
  const hubs: Network['hubs'] = []
  for (const f of fc.features) {
    const p = f.properties
    if (f.geometry.type === 'LineString' && p.poId) {
      segments.push({ segmentId: String(p.segmentId), poId: String(p.poId), tier: p.tier === 'mainline' ? 'mainline' : 'sub', corridor: String(p.corridor ?? ''), path: f.geometry.coordinates as LngLat[] })
    } else if (f.geometry.type === 'Point' && p.kind === 'node') {
      hubs.push({ id: String(p.id), name: String(p.name), coord: f.geometry.coordinates as LngLat, core: !!p.core })
    }
  }
  return { segments, hubs }
}

/** Small deterministic offset (about 30 m) so stacked pins don't overlap exactly. */
const nudge = ([lng, lat]: LngLat, key: string): LngLat => {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return [lng + ((h % 100) / 100 - 0.5) * 0.0006, lat + (((h >> 8) % 100) / 100 - 0.5) * 0.0006]
}

export class LocalRepo implements Repository {
  private snap?: Snapshot
  private network = parseNetwork(networkJson as never)

  async getNetwork() { return this.network }

  async getSnapshot() {
    if (this.snap) return this.snap
    const snap = generateSeed({ asOf: todayManila(), nowMs: Date.now() })
    // The seed only knows clusters; put crews, updates and incidents on their PO's drawn route.
    const seg = new Map(this.network.segments.map(s => [s.poId, s]))
    const workFront = (poId: string) => {
      const po = snap.pos.find(p => p.id === poId)!
      const s = seg.get(poId)
      return s ? pointAlong(s.path, Math.max(0.08, weightedProgress(po.progress, DEFAULT_SETTINGS.weights) / 100)) : undefined
    }
    for (const u of snap.updates) u.gps = nudge(workFront(u.poId) ?? u.gps, u.id)
    for (const c of snap.crews) {
      const latest = snap.updates.filter(u => u.crewId === c.id).sort((a, b) => b.at.localeCompare(a.at))[0]
      c.lastCheckIn.gps = latest?.gps ?? nudge(workFront(c.poIds[0]) ?? c.lastCheckIn.gps, c.id)
    }
    for (const i of snap.incidents) {
      const s = i.poId ? seg.get(i.poId) : undefined
      if (s) i.gps = pointAlong(s.path, 0.55)
    }
    return (this.snap = snap)
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
}

export const repo: Repository = new LocalRepo()
