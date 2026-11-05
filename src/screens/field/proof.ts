// Field-side helpers: GPS fix, connectivity, outbox sync, ids.
import { useCallback, useEffect, useState } from 'react'
import { repo } from '../../data/repo'
import { outbox, type OutboxItem } from '../../data/outbox'
import { pointAlong } from '../../domain/geo'
import type { LngLat, Network, Snapshot } from '../../domain/types'

export interface Fix { gps: LngLat; accuracyM?: number; source: 'device' | 'route-demo' }

/** Asks the device for a GPS fix. If none, the crew can fall back to the route point (flagged as demo). */
export function useGps(network: Network, poId: string) {
  const [fix, setFix] = useState<Fix | null>(null)
  const [state, setState] = useState<'locating' | 'ok' | 'failed'>('locating')
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setState('failed'); return }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      p => { setFix({ gps: [p.coords.longitude, p.coords.latitude], accuracyM: Math.round(p.coords.accuracy), source: 'device' }); setState('ok') },
      () => setState('failed'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])
  useEffect(locate, [locate])
  const useRoutePoint = () => {
    const seg = network.segments.find(s => s.poId === poId)
    if (seg) { setFix({ gps: pointAlong(seg.path, 0.6), source: 'route-demo' }); setState('ok') }
  }
  return { fix, state, locate, useRoutePoint }
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>([])
  useEffect(() => outbox.subscribe(setItems), [])
  return items
}

let flushing = false
/** Sends queued items one at a time. The "server" is mocked: a short delay, then repo.submit. */
export async function flushOutbox(isOnline: () => boolean, onSnapshot: (s: Snapshot) => void) {
  if (flushing) return
  flushing = true
  try {
    for (const item of (await outbox.list()).filter(i => i.status === 'queued' || i.status === 'failed')) {
      if (!isOnline()) break
      await outbox.patch(item.id, { status: 'sending' })
      await new Promise(r => setTimeout(r, 900))
      if (!isOnline()) { await outbox.patch(item.id, { status: 'queued' }); break }
      try {
        onSnapshot(await repo.submit(item.sub))
        await outbox.patch(item.id, { status: 'sent', sentAt: new Date().toISOString(), error: undefined })
      } catch (e) {
        await outbox.patch(item.id, { status: 'failed', error: String(e) })
      }
    }
    await outbox.prune()
  } finally { flushing = false }
}

/** Manila timestamp for "now". */
export const nowManila = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 19) + '+08:00'
export const shortId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`
