import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, type Layer, type MapViewState, type PickingInfo } from '@deck.gl/core'
import { ColumnLayer, IconLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import { Map as MapGL, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { animate } from 'animejs'
import { cumulativeKm, km } from '../../domain/geo'
import { STATUS_LABEL } from '../../domain/status'
import { MILESTONE_LABEL } from '../../domain/types'
import type { Crew, Hub, Incident, LngLat, Segment } from '../../domain/types'
import { fmtDate } from '../../domain/dates'
import { useData } from '../../state'
import { ago, pesoShort } from '../../ui/format'
import { glyphSvg, hexToRgb, STATUS_DASH, STATUS_HEX } from '../../ui/status'

// MapLibre 6 finds its worker relative to its own module, which bundlers move. Point at it explicitly.
setWorkerUrl(workerUrl)

const STYLE = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}
const BUILDING = { dark: '#231d36', light: '#d8d1de' }
const NOC: LngLat = [123.9223, 10.3236]
const HOME = { longitude: 123.905, latitude: 10.305, zoom: 12.25, pitch: 55, bearing: -28 }
const PULSE_LOOP = 6 // km-units per loop
const ORBIT_DEG_PER_S = 1.6
const RESUME_ORBIT_MS = 40_000

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const CREW_ICON = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80">
  <path d="M32 78 C32 78 6 50 6 31 A26 26 0 1 1 58 31 C58 50 32 78 32 78Z" fill="#7c3aed" stroke="#fff" stroke-width="4"/>
  <path d="M18 36 a14 14 0 0 1 28 0 h4 v5 H14 v-5Z" fill="#fff"/><rect x="29" y="18" width="6" height="10" rx="2" fill="#fff"/></svg>`)
const INCIDENT_ICON = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="12" y="12" width="40" height="40" rx="6" transform="rotate(45 32 32)" fill="#e11d48" stroke="#fff" stroke-width="4"/>
  <rect x="29" y="19" width="6" height="18" rx="3" fill="#fff"/><circle cx="32" cy="44" r="3.6" fill="#fff"/></svg>`)

const hashUnit = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h >>> 0) % 1000) / 1000 }

interface Props { mode3d: boolean; reduceMotion: boolean; resetSignal: number }

export function HeroMap({ mode3d, reduceMotion, resetSignal }: Props) {
  const { network, snap, byId, matches, matchesScope, selectedId, select, theme } = useData()
  const [view, setView] = useState<MapViewState>(reduceMotion ? HOME : { ...HOME, zoom: 14.2, pitch: 62, bearing: -40, longitude: NOC[0], latitude: NOC[1] })
  const [reveal, setReveal] = useState(reduceMotion ? 1 : 0)
  const [time, setTime] = useState(0)
  const [glError, setGlError] = useState(false)
  const lastInteraction = useRef(0)
  const orbiting = useRef(false)
  const mapRef = useRef<MapRef>(null)
  const hex = STATUS_HEX[theme]

  // ---------- derived data ----------
  const segs = useMemo(() => network.segments.map(s => {
    const cum = cumulativeKm(s.path)
    const start = km(NOC, s.path[0]) * 1.15 // rough "distance along the network" for the reveal
    const off = hashUnit(s.segmentId) * 2
    return { ...s, revealTs: cum.map(c => start + c), pulseTs: cum.map(c => off + c), len: cum[cum.length - 1] }
  }), [network])
  const revealMax = useMemo(() => Math.max(...segs.map(s => s.revealTs[s.revealTs.length - 1])), [segs])
  type Seg = (typeof segs)[number]

  const colorOf = useCallback((s: Segment, alpha = 255): [number, number, number, number] => {
    const ev = byId.get(s.poId)!
    const a = !matches(ev) ? 38 : ev.status === 'COMPLETED' ? Math.round(alpha * 0.62) : alpha
    return [...hexToRgb(hex[ev.status]), a]
  }, [byId, matches, hex])

  const crews = useMemo(() => snap.crews.filter(c => c.poIds.some(id => matchesScope(byId.get(id)!))), [snap, byId, matchesScope])
  const incidents = useMemo(() => snap.incidents.filter(i => !i.poId || matchesScope(byId.get(i.poId)!)), [snap, byId, matchesScope])
  const active = useMemo(() => segs.filter(s => { const e = byId.get(s.poId)!; return e.activity === 'ONGOING' && matches(e) }), [segs, byId, matches])
  const selectedSeg = segs.find(s => s.poId === selectedId)

  // ---------- intro: one hero moment (anime.js) ----------
  useEffect(() => {
    if (reduceMotion) return
    const cam = { zoom: 14.2, pitch: 62, bearing: -40, longitude: NOC[0], latitude: NOC[1], reveal: 0 }
    const a = animate(cam, {
      zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing, longitude: HOME.longitude, latitude: HOME.latitude,
      duration: 2600, ease: 'inOut(3)',
      onUpdate: () => setView(v => ({ ...v, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, longitude: cam.longitude, latitude: cam.latitude })),
    })
    const r = animate(cam, {
      reveal: 1, duration: 2400, delay: 250, ease: 'out(3)',
      onUpdate: () => setReveal(cam.reveal),
      onComplete: () => { setReveal(1); orbiting.current = true },
    })
    return () => { a.revert(); r.revert() }
  }, [reduceMotion])

  // ---------- frame loop: pulse + idle orbit ----------
  useEffect(() => {
    if (reduceMotion || !mode3d) { orbiting.current = false; return }
    let raf = 0, last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      setTime(t => (t + dt * 0.6) % PULSE_LOOP)
      if (!orbiting.current && !selectedId && lastInteraction.current && now - lastInteraction.current > RESUME_ORBIT_MS) orbiting.current = true
      if (orbiting.current && !selectedId) setView(v => ({ ...v, bearing: (v.bearing ?? 0) + dt * ORBIT_DEG_PER_S, transitionDuration: 0 }))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduceMotion, mode3d, selectedId])

  // ---------- fly to the selected segment ----------
  useEffect(() => {
    if (!selectedSeg) return
    orbiting.current = false
    const xs = selectedSeg.path.map(p => p[0]), ys = selectedSeg.path.map(p => p[1])
    const zoom = 15
    const panelShift = window.innerWidth > 900 ? (210 * 360) / (512 * 2 ** zoom) : 0 // keep it clear of the side panel
    setView(v => ({
      ...v, longitude: (Math.min(...xs) + Math.max(...xs)) / 2 + panelShift, latitude: (Math.min(...ys) + Math.max(...ys)) / 2,
      zoom, pitch: mode3d ? 60 : 0,
      transitionDuration: reduceMotion ? 0 : 1600, transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
    }))
  }, [selectedSeg?.segmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- reset + 2D/3D ----------
  useEffect(() => {
    if (!resetSignal) return
    select(null)
    setView({ ...HOME, pitch: mode3d ? HOME.pitch : 0, bearing: mode3d ? HOME.bearing : 0, transitionDuration: reduceMotion ? 0 : 1200, transitionInterpolator: new FlyToInterpolator({ speed: 1.8 }) })
    lastInteraction.current = performance.now()
  }, [resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setView(v => ({ ...v, pitch: mode3d ? HOME.pitch : 0, bearing: mode3d ? v.bearing : 0, transitionDuration: reduceMotion ? 0 : 600 }))
  }, [mode3d, reduceMotion])

  // ---------- 3D buildings on the basemap ----------
  const addBuildings = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.isStyleLoaded() || !map.getSource('openmaptiles')) return
    if (!map.getLayer('cjf-buildings')) {
      map.addLayer({
        id: 'cjf-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': BUILDING[theme],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      })
    }
    map.setLayoutProperty('cjf-buildings', 'visibility', mode3d ? 'visible' : 'none')
    for (const l of map.getStyle().layers ?? []) {
      if (l.type === 'symbol' && !l.id.startsWith('cjf')) map.setPaintProperty(l.id, 'text-opacity', 0.45)
    }
  }, [theme, mode3d])
  useEffect(() => { addBuildings() }, [addBuildings])

  // ---------- layers ----------
  const mainline = segs.filter(s => s.tier === 'mainline')
  const width = (s: Seg) => {
    const done = byId.get(s.poId)!.status === 'COMPLETED'
    return s.tier === 'mainline' ? (done ? 4 : 6) : (done ? 1.8 : 3)
  }
  const updateTriggers = { getColor: [theme, matches], getWidth: [byId], getDashArray: [byId] }
  const layers: (Layer | false | null | undefined)[] = reveal < 1
    ? [new TripsLayer<Seg>({
        id: 'reveal', data: segs, getPath: s => s.path, getTimestamps: s => s.revealTs,
        getColor: s => colorOf(s), getWidth: width, widthUnits: 'pixels', capRounded: true, jointRounded: true,
        currentTime: reveal * revealMax, trailLength: revealMax + 1, fadeTrail: false, updateTriggers,
      })]
    : [
        new PathLayer<Seg>({
          id: 'mainline-glow', data: mainline, getPath: s => s.path, getColor: s => colorOf(s, 70),
          getWidth: 22, widthUnits: 'pixels', capRounded: true, jointRounded: true, updateTriggers,
        }),
        selectedSeg && new PathLayer<Seg>({
          id: 'selected-casing', data: [selectedSeg], getPath: s => s.path,
          getColor: theme === 'dark' ? [255, 255, 255, 230] : [21, 18, 28, 230],
          getWidth: s => width(s) + 7, widthUnits: 'pixels', capRounded: true, jointRounded: true,
        }),
        new PathLayer<Seg, PathStyleExtensionProps<Seg>>({
          id: 'segments', data: segs, getPath: s => s.path, getColor: s => colorOf(s), getWidth: width,
          widthUnits: 'pixels', capRounded: true, jointRounded: true, pickable: true, autoHighlight: true,
          highlightColor: theme === 'dark' ? [255, 255, 255, 110] : [21, 18, 28, 90],
          getDashArray: s => STATUS_DASH[byId.get(s.poId)!.status] ?? [0, 0], dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })], updateTriggers,
        }),
        !reduceMotion && mode3d && new TripsLayer<Seg>({
          id: 'pulse', data: active, getPath: s => s.path, getTimestamps: s => s.pulseTs,
          getColor: theme === 'dark' ? [255, 214, 186] : [194, 71, 10], getWidth: s => (s.tier === 'mainline' ? 4 : 2.4),
          widthUnits: 'pixels', capRounded: true, currentTime: time, trailLength: 0.8, fadeTrail: true,
        }),
      ]

  const hubs = network.hubs
  layers.push(
    mode3d && new ColumnLayer<Hub>({
      id: 'noc', data: hubs.filter(h => h.core), getPosition: h => h.coord, diskResolution: 6, radius: 55,
      extruded: true, getElevation: 320, getFillColor: [124, 58, 237, 230], material: false,
    }),
    new ScatterplotLayer<Hub>({
      id: 'hubs', data: hubs, getPosition: h => h.coord, getRadius: h => (h.core ? 9 : 6), radiusUnits: 'pixels',
      stroked: true, getLineWidth: 2.5, lineWidthUnits: 'pixels',
      getFillColor: theme === 'dark' ? [13, 11, 20, 255] : [255, 255, 255, 255], getLineColor: [255, 107, 26, 255],
    }),
    new TextLayer<Hub>({
      id: 'hub-labels', data: hubs, getPosition: h => h.coord, getText: h => (h.core ? 'Mandaue NOC' : h.name.replace(/ hub$/, '')),
      getSize: h => (h.core ? 14 : 12), getPixelOffset: h => [0, h.core ? -36 : -18], fontFamily: 'Archivo Variable, sans-serif', fontWeight: 600,
      getColor: theme === 'dark' ? [243, 240, 247, 255] : [21, 18, 28, 255],
      background: true, getBackgroundColor: theme === 'dark' ? [13, 11, 20, 200] : [255, 255, 255, 220], backgroundPadding: [6, 3],
      characterSet: 'auto',
    }),
    new IconLayer<Crew>({
      id: 'crews', data: crews, getPosition: c => c.lastCheckIn.gps, pickable: true,
      getIcon: () => ({ url: CREW_ICON, width: 64, height: 80, anchorY: 80 }), getSize: 140, sizeUnits: 'meters', sizeMinPixels: 15, sizeMaxPixels: 34,
    }),
    new IconLayer<Incident>({
      id: 'incidents', data: incidents, getPosition: i => i.gps, pickable: true,
      getIcon: () => ({ url: INCIDENT_ICON, width: 64, height: 64 }), getSize: 130, sizeUnits: 'meters', sizeMinPixels: 16, sizeMaxPixels: 32,
    }),
  )

  // ---------- tooltip + click ----------
  const now = Date.now()
  const tipStyle = {
    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '10px',
    padding: '10px 12px', fontFamily: 'Archivo Variable, sans-serif', fontSize: '12px', lineHeight: '1.45',
    boxShadow: 'var(--shadow)', maxWidth: '280px',
  }
  const getTooltip = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return null
    if (layer.id === 'segments') {
      const ev = byId.get((object as Seg).poId)!
      return {
        style: tipStyle,
        html: `<div style="display:flex;gap:6px;align-items:center;font-weight:600;color:${hex[ev.status]}">${glyphSvg(ev.status, hex[ev.status])}${STATUS_LABEL[ev.status]}</div>
          <div style="margin-top:4px;font-family:'JetBrains Mono Variable',monospace;font-size:11px;opacity:.75">${ev.po.kind} ${ev.po.id} · ${(object as Seg).tier === 'mainline' ? 'Mainline' : 'Sub line'}</div>
          <div style="font-weight:600">${ev.po.title}</div>
          <div style="opacity:.8">${Math.round(ev.progressPct)}% done · target ${fmtDate(ev.effectiveTarget)}${ev.ld.amount ? ` · LD ${pesoShort(ev.ld.amount)}` : ''}</div>`,
      }
    }
    if (layer.id === 'crews') {
      const c = object as Crew
      const po = byId.get(c.poIds[0])!
      return { style: tipStyle, html: `<b>Crew ${c.id} · ${c.lead}</b><div style="opacity:.8">${snap.contractors.find(x => x.id === c.contractorId)?.name}</div><div>Last check-in ${ago(c.lastCheckIn.at, now)}</div><div style="opacity:.8">On ${po.po.id}, ${MILESTONE_LABEL[([...(['FOC', 'CIVIL', 'ROW', 'ENG'] as const)].find(k => po.po.progress[k] > 0) ?? 'ENG')]}</div>` }
    }
    if (layer.id === 'incidents') {
      const i = object as Incident
      return { style: tipStyle, html: `<b>Third-party damage · ${i.id}</b><div>${i.responsibleParty}</div><div style="opacity:.8">Reported ${ago(i.receivedAt, now)} · ${i.restorationStatus === 'ongoing' ? 'restoration ongoing' : `${i.restorationStatus} restoration done`}</div>` }
    }
    return null
  }
  const onClick = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return
    lastInteraction.current = performance.now()
    if (layer.id === 'segments') select((object as Seg).poId)
    else if (layer.id === 'crews') select((object as Crew).poIds[0])
    else if (layer.id === 'incidents' && (object as Incident).poId) select((object as Incident).poId!)
  }

  if (glError) return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
      This device could not start WebGL, so the 3D map is unavailable. The portfolio views still work.
    </div>
  )

  return (
    <DeckGL
      viewState={view}
      onViewStateChange={({ viewState }) => setView(viewState as MapViewState)}
      onInteractionStateChange={s => {
        if (s.isDragging || s.isPanning || s.isRotating || s.isZooming) { orbiting.current = false; lastInteraction.current = performance.now() }
      }}
      controller={{ dragRotate: mode3d, touchRotate: mode3d, keyboard: true }}
      layers={layers.filter(Boolean)}
      getTooltip={getTooltip}
      onClick={onClick}
      getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
      onError={() => setGlError(true)}
    >
      <MapGL ref={mapRef} reuseMaps mapStyle={STYLE[theme]} onLoad={addBuildings} onStyleData={addBuildings} attributionControl={{ compact: true }} />
    </DeckGL>
  )
}
