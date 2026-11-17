// Route geometry helpers shared by the local repo, the Supabase repo and the Supabase seed script.
import { DEFAULT_SETTINGS } from '../domain/config'
import { pointAlong } from '../domain/geo'
import { weightedProgress } from '../domain/status'
import type { LngLat, Network, Snapshot } from '../domain/types'
import networkJson from './network.geo.json'

export const ASSUMED_SOURCE = 'Assumed routes (network.geo.json)'

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

export const assumedNetwork = () => parseNetwork(networkJson as never)

/** Small deterministic offset (about 30 m) so stacked pins don't overlap exactly. */
const nudge = ([lng, lat]: LngLat, key: string): LngLat => {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return [lng + ((h % 100) / 100 - 0.5) * 0.0006, lat + (((h >> 8) % 100) / 100 - 0.5) * 0.0006]
}

/** The seed only knows clusters; put crews, updates and incidents on their PO's drawn route. Mutates and returns snap. */
export function placeOnRoutes(snap: Snapshot, network: Network): Snapshot {
  const seg = new Map(network.segments.map(s => [s.poId, s]))
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
  return snap
}
