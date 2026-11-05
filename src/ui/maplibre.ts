// One place for MapLibre setup shared by the hero map and the map picker.
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre 6 finds its worker relative to its own module, which bundlers move. Point at it explicitly.
setWorkerUrl(workerUrl)

export const MAP_STYLE = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}
