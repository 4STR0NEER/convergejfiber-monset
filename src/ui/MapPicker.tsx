// Click-to-place map used in the office: drop a node, or click point by point to draw a route.
// Plain 2D MapLibre (no deck.gl): existing routes in grey, hubs as rings, the new shape in brand orange.
import { useMemo } from 'react'
import { Layer, Map as MapGL, Source } from 'react-map-gl/maplibre'
import { Undo2, X } from 'lucide-react'
import type { LngLat } from '../domain/types'
import { useData } from '../state'
import { MAP_STYLE } from './maplibre'

type Props =
  | { mode: 'point'; value: LngLat | null; onChange: (v: LngLat | null) => void; center?: LngLat }
  | { mode: 'line'; value: LngLat[]; onChange: (v: LngLat[]) => void; center?: LngLat }

const round = (n: number) => Math.round(n * 1e5) / 1e5

export function MapPicker(props: Props) {
  const { network, theme } = useData()
  const center = props.center ?? [123.91, 10.31]
  const existing = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: network.segments.map(s => ({ type: 'Feature' as const, properties: { tier: s.tier }, geometry: { type: 'LineString' as const, coordinates: s.path } })),
  }), [network])
  const hubs = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: network.hubs.map(h => ({ type: 'Feature' as const, properties: { name: h.name }, geometry: { type: 'Point' as const, coordinates: h.coord } })),
  }), [network])
  const drawn = props.mode === 'line' ? props.value : props.value ? [props.value] : []
  const shape = {
    type: 'FeatureCollection' as const,
    features: [
      ...(props.mode === 'line' && drawn.length > 1 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: drawn } }] : []),
      ...drawn.map(p => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: p } })),
    ],
  }
  const grey = theme === 'dark' ? '#8e97ad' : '#64748b'

  return (
    <div>
      <div className="relative h-80 overflow-hidden rounded-xl border border-border">
        <MapGL initialViewState={{ longitude: center[0], latitude: center[1], zoom: 12.6 }} mapStyle={MAP_STYLE[theme]} cursor="crosshair"
          attributionControl={{ compact: true }}
          onClick={e => {
            const p: LngLat = [round(e.lngLat.lng), round(e.lngLat.lat)]
            if (props.mode === 'line') props.onChange([...props.value, p])
            else props.onChange(p)
          }}>
          <Source id="existing" type="geojson" data={existing}>
            <Layer id="existing-lines" type="line" paint={{ 'line-color': grey, 'line-opacity': 0.6, 'line-width': ['match', ['get', 'tier'], 'mainline', 3.5, 1.6] }} />
          </Source>
          <Source id="hubs" type="geojson" data={hubs}>
            <Layer id="hub-dots" type="circle" paint={{ 'circle-radius': 5, 'circle-color': theme === 'dark' ? '#0d0b14' : '#fff', 'circle-stroke-color': '#ff6b1a', 'circle-stroke-width': 2 }} />
          </Source>
          <Source id="drawn" type="geojson" data={shape}>
            <Layer id="drawn-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': '#ff6b1a', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
            <Layer id="drawn-points" type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': props.mode === 'point' ? 8 : 5, 'circle-color': '#ff6b1a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }} />
          </Source>
        </MapGL>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>{props.mode === 'line' ? `Click along the road to draw the route · ${drawn.length} point${drawn.length === 1 ? '' : 's'}` : drawn.length ? `${drawn[0][1]}, ${drawn[0][0]}` : 'Click the map to place it'}</span>
        {props.mode === 'line' && drawn.length > 0 && (
          <button type="button" onClick={() => props.onChange(props.value.slice(0, -1))} className="inline-flex items-center gap-1 hover:text-text"><Undo2 size={12} />Undo point</button>
        )}
        {drawn.length > 0 && (
          <button type="button" onClick={() => (props.mode === 'line' ? props.onChange([]) : props.onChange(null))} className="inline-flex items-center gap-1 hover:text-text"><X size={12} />Clear</button>
        )}
      </div>
    </div>
  )
}
