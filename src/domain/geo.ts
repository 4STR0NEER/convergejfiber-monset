import type { LngLat } from './types'

/** Great-circle distance in km. */
export function km(a: LngLat, b: LngLat) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Cumulative km at each vertex of a path. */
export const cumulativeKm = (path: LngLat[]) =>
  path.reduce<number[]>((acc, p, i) => [...acc, i ? acc[i - 1] + km(path[i - 1], p) : 0], [])

/** The point at fraction t (0..1) of a path's length. */
export function pointAlong(path: LngLat[], t: number): LngLat {
  const cum = cumulativeKm(path)
  const target = Math.min(1, Math.max(0, t)) * cum[cum.length - 1]
  for (let i = 1; i < path.length; i++) {
    if (cum[i] >= target) {
      const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]
    }
  }
  return path[path.length - 1]
}
