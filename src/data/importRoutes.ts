// Stub for swapping the assumed network for real routes (KMZ / KML / GeoJSON from the client's GIS).
// Output is the same FeatureCollection shape as network.geo.json, so `parseNetwork` takes it unchanged.
// Matching rule (assumed until we see real files): a LineString's PO number comes from an ExtendedData
// field named PO / PO_NO / WO, or else from the first 10-digit / WO-number pattern in the Placemark name.
import type { Network } from '../domain/types'
import { parseNetwork } from './repo'

type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] }

const PO_PATTERN = /(\d{10}|WO-[A-Z]{2}-\d{2}-\d{4})/

function kmlToGeoJson(kml: string): FC {
  const doc = new DOMParser().parseFromString(kml, 'application/xml')
  const features: FC['features'] = []
  let seq = 0
  for (const pm of Array.from(doc.getElementsByTagName('Placemark'))) {
    const name = pm.getElementsByTagName('name')[0]?.textContent ?? ''
    const data: Record<string, string> = {}
    for (const d of Array.from(pm.getElementsByTagName('Data'))) data[d.getAttribute('name')?.toUpperCase() ?? ''] = d.textContent?.trim() ?? ''
    const poId = data.PO ?? data.PO_NO ?? data.WO ?? name.match(PO_PATTERN)?.[1]
    for (const ls of Array.from(pm.getElementsByTagName('LineString'))) {
      const coords = (ls.getElementsByTagName('coordinates')[0]?.textContent ?? '').trim().split(/\s+/)
        .map(t => t.split(',').slice(0, 2).map(Number)).filter(c => c.length === 2 && c.every(Number.isFinite))
      if (coords.length > 1) features.push({
        type: 'Feature', geometry: { type: 'LineString', coordinates: coords },
        properties: { kind: 'segment', segmentId: `IMP-${++seq}`, poId, tier: /main|backbone|ring/i.test(name) ? 'mainline' : 'sub', corridor: name },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** Reads a .kmz, .kml or .geojson/.json file into a Network. Segments without a PO number are dropped and counted. */
export async function importRoutes(file: File): Promise<{ network: Network; unmatched: number }> {
  const name = file.name.toLowerCase()
  let fc: FC
  if (name.endsWith('.kmz')) {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(file)
    const kml = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'))
    if (!kml) throw new Error('No .kml file inside the KMZ.')
    fc = kmlToGeoJson(await kml.async('string'))
  } else if (name.endsWith('.kml')) {
    fc = kmlToGeoJson(await file.text())
  } else {
    fc = JSON.parse(await file.text())
  }
  const unmatched = fc.features.filter(f => f.geometry.type === 'LineString' && !f.properties.poId).length
  return { network: parseNetwork(fc), unmatched }
}
