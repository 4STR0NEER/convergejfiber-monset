// Generates src/data/network.geo.json: ASSUMED backbone geometry for Metro Cebu.
// Run: npx tsx scripts/build-network.ts
// Replace the output with real routes later (see src/data/importRoutes.ts). Every segment carries the poId it belongs to.
import { writeFileSync } from 'node:fs'
import { generateSeed } from '../src/data/seed'

type P = [number, number]
const r = (() => { let a = 7331; return () => { a = (a * 16807) % 2147483647; return a / 2147483647 } })()

// Mainline corridors: waypoints roughly following major roads (assumed, not surveyed).
const NOC: P = [123.9223, 10.3236]
const CORRIDORS: Record<string, P[]> = {
  'Ring North (A.S. Fortuna, Banilad, Lahug, Capitol)': [NOC, [123.9165, 10.33], [123.9105, 10.3385], [123.905, 10.342], [123.8985, 10.3355], [123.894, 10.329], [123.8854, 10.3157], [123.892, 10.305], [123.899, 10.296]],
  'Ring South (M.J. Cuenco coastal)': [[123.899, 10.296], [123.906, 10.301], [123.912, 10.308], [123.917, 10.315], NOC],
  'North (Mandaue to Consolacion to Liloan)': [NOC, [123.933, 10.329], [123.944, 10.337], [123.95, 10.348], [123.954, 10.361], [123.9573, 10.3766], [123.97, 10.3855], [123.985, 10.3935], [123.9989, 10.399]],
  'Mactan (Marcelo Fernan Bridge to Lapu-Lapu)': [[123.933, 10.329], [123.9435, 10.3305], [123.953, 10.324], [123.951, 10.317], [123.9494, 10.3103], [123.96, 10.3], [123.975, 10.29], [123.995, 10.293]],
  'South (Cebu South Road to Talisay to Minglanilla)': [[123.899, 10.296], [123.888, 10.288], [123.876, 10.28], [123.864, 10.269], [123.856, 10.256], [123.8494, 10.2447], [123.835, 10.2455], [123.818, 10.244], [123.805, 10.245], [123.796, 10.2453]],
}

const HUBS = [
  { id: 'NOC-MDE', name: 'Mandaue Core / NOC (placeholder)', coord: NOC, core: true },
  { id: 'HUB-CEB', name: 'Cebu City hub', coord: [123.8854, 10.3157] as P },
  { id: 'HUB-LLC', name: 'Lapu-Lapu hub', coord: [123.9494, 10.3103] as P },
  { id: 'HUB-TAL', name: 'Talisay hub', coord: [123.8494, 10.2447] as P },
  { id: 'HUB-MNG', name: 'Minglanilla hub', coord: [123.796, 10.2453] as P },
  { id: 'HUB-CON', name: 'Consolacion hub', coord: [123.9573, 10.3766] as P },
  { id: 'HUB-LIL', name: 'Liloan hub', coord: [123.9989, 10.399] as P },
]

// Rough land boxes per cluster so barangay sub lines stay off the water.
const LAND: Record<string, [number, number, number, number]> = {
  'CEB-N': [123.875, 123.925, 10.33, 10.37], 'CEB-S': [123.85, 123.893, 10.278, 10.31],
  MDE: [123.918, 123.95, 10.33, 10.36], LLC: [123.952, 124.0, 10.268, 10.298], // south of the airport
  TAL: [123.785, 123.86, 10.249, 10.275], CNL: [123.945, 123.99, 10.375, 10.41],
}
const CENTERS: Record<string, P> = Object.fromEntries(Object.entries(LAND).map(([k, b]) => [k, [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]]))

const km = (a: P, b: P) => {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const round = (p: P): P => [+p[0].toFixed(5), +p[1].toFixed(5)]

/** Cut a polyline into pieces of about `step` km, keeping the original vertices. */
function split(line: P[], step: number): P[][] {
  const out: P[][] = []
  let cur: P[] = [line[0]], acc = 0
  for (let i = 1; i < line.length; i++) {
    let a = line[i - 1]
    const b = line[i]
    let d = km(a, b)
    while (acc + d >= step) {
      const t = (step - acc) / d
      const p: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      cur.push(p); out.push(cur.map(round)); cur = [p]
      a = p; d = km(a, b); acc = 0
    }
    cur.push(b); acc += d
  }
  if (cur.length > 1) acc < step * 0.4 && out.length ? out[out.length - 1].push(...cur.slice(1).map(round)) : out.push(cur.map(round))
  return out
}

const snap = generateSeed({ asOf: '2026-11-05', nowMs: 0 }) // ids and clusters do not depend on the date
const free = new Set(snap.pos.map(p => p.id))
const nearestCluster = (p: P) => Object.entries(CENTERS).sort((a, b) => km(p, a[1]) - km(p, b[1]))[0][0]
const takePo = (cluster: string, prefer: (id: string) => boolean) => {
  const inCluster = snap.pos.filter(p => free.has(p.id) && p.clusterId === cluster)
  const po = inCluster.find(p => prefer(p.id)) ?? inCluster[0]
  if (po) free.delete(po.id)
  return po?.id
}
const isBuild = (id: string) => ['AER-NB', 'UG-NB'].includes(snap.pos.find(p => p.id === id)!.categoryId)

const features: object[] = []
let seq = 0
const mainVertices: P[] = []
for (const [corridor, line] of Object.entries(CORRIDORS)) {
  for (const piece of split(line, 1.6)) {
    mainVertices.push(...piece)
    const mid = piece[Math.floor(piece.length / 2)]
    const poId = takePo(nearestCluster(mid), isBuild)
    if (!poId) continue
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: piece }, properties: { kind: 'segment', segmentId: `SEG-${String(++seq).padStart(3, '0')}`, poId, tier: 'mainline', corridor } })
  }
}

// Remaining POs: barangay laterals. Each cluster grows a few laterals inland from the mainline;
// consecutive pieces of a lateral belong to consecutive POs, so it reads like a real distribution tree.
const INLAND: Record<string, P> = { 'CEB-N': [-0.55, 0.85], 'CEB-S': [-0.8, 0.6], MDE: [0.25, 1], LLC: [1, -0.25], TAL: [-0.1, 1], CNL: [-0.6, 0.8] }
const inBox = (p: P, b: number[]) => p[0] >= b[0] && p[0] <= b[1] && p[1] >= b[2] && p[1] <= b[3]
for (const cluster of Object.keys(LAND)) {
  const pos = snap.pos.filter(p => free.has(p.id) && p.clusterId === cluster)
  if (!pos.length) continue
  const box = LAND[cluster]
  const local = mainVertices.filter(v => nearestCluster(v) === cluster)
  const anchors = local.length ? local : [mainVertices.reduce((a, v) => (km(v, CENTERS[cluster]) < km(a, CENTERS[cluster]) ? v : a))]
  const laterals = Math.max(2, Math.ceil(pos.length / 5))
  let i = 0
  for (let l = 0; l < laterals && i < pos.length; l++) {
    let at: P = anchors[Math.floor(((l + 0.5) / laterals) * anchors.length)]
    let ang = Math.atan2(INLAND[cluster][1], INLAND[cluster][0]) + (r() - 0.5) * 1.1
    const take = Math.ceil((pos.length - i) / (laterals - l))
    for (let k = 0; k < take; k++, i++) {
      const piece: P[] = [at]
      const steps = 3 + Math.floor(r() * 3) // ~0.6-1.1 km per PO
      for (let st = 0; st < steps; st++) {
        ang += (r() - 0.5) * 0.7
        let next: P = [at[0] + Math.cos(ang) * 0.0019, at[1] + Math.sin(ang) * 0.0019]
        if (!inBox(next, box)) { ang += Math.PI * (0.5 + r() * 0.5); next = [at[0] + Math.cos(ang) * 0.0019, at[1] + Math.sin(ang) * 0.0019] }
        piece.push(next); at = next
      }
      // Every third PO branches off sideways instead of continuing the lateral.
      const po = pos[i]
      features.push({
        type: 'Feature', geometry: { type: 'LineString', coordinates: piece.map(round) },
        properties: { kind: 'segment', segmentId: `SEG-${String(++seq).padStart(3, '0')}`, poId: po.id, tier: 'sub', corridor: `${cluster} lateral ${l + 1}` },
      })
      free.delete(po.id)
      if (k % 3 === 2) { at = piece[1]; ang += (r() < 0.5 ? 1 : -1) * 1.2 }
    }
  }
}
for (const h of HUBS) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: h.coord }, properties: { kind: 'node', id: h.id, name: h.name, core: !!h.core } })

writeFileSync('src/data/network.geo.json', JSON.stringify({ type: 'FeatureCollection', name: 'Converge-J Fiber assumed backbone (replace with real routes)', features }))
console.log(`segments ${seq} (mainline ${features.filter((f: any) => f.properties.tier === 'mainline').length}), unassigned POs ${free.size}`)
