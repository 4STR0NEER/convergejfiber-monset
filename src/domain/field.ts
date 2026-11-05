// Field submissions: what a crew sends from the phone, and how each one changes the portfolio.
import type { ISODate } from './dates'
import { km } from './geo'
import type { DelayEvent, FieldUpdate, Incident, LngLat, Network, Settings, Snapshot } from './types'

export type Submission =
  | { kind: 'update'; update: FieldUpdate }
  | { kind: 'blocker'; delay: DelayEvent }
  | { kind: 'incident'; incident: Incident }

/** Proof-first rules. Returns human-readable problems; empty = OK to queue. */
export function validateUpdate(u: Pick<FieldUpdate, 'progress' | 'photoIds' | 'gps' | 'at'>): string[] {
  const errs: string[] = []
  if (!(u.progress >= 0 && u.progress <= 100)) errs.push('Progress must be between 0 and 100%.')
  if (!u.photoIds.length) errs.push('Add at least one photo.')
  if (!u.gps || (u.gps[0] === 0 && u.gps[1] === 0)) errs.push('No GPS fix yet.')
  if (!u.at) errs.push('Missing timestamp.')
  return errs
}

/** Distance in km from a GPS fix to the nearest vertex of the PO's drawn route (null if no route). */
export function distanceToRoute(network: Network, poId: string, gps: LngLat): number | null {
  const seg = network.segments.filter(s => s.poId === poId)
  if (!seg.length) return null
  return Math.min(...seg.flatMap(s => s.path.map(p => km(p, gps))))
}

/** What a reason code does to the LD clock, in the crew's language. */
export function reasonImpact(code: string, s: Settings) {
  const r = s.reasons.find(x => x.code === code)
  const ldEligible = r?.ldEligible ?? true
  return {
    ldEligible,
    text: ldEligible
      ? 'Counts against the contractor: days lost here can be charged as LD.'
      : 'Not the contractor’s fault: the target moves out day for day while this is open. No LD.',
  }
}

/** Apply one synced submission to a snapshot (returns a new snapshot; inputs untouched). */
export function applySubmission(snap: Snapshot, sub: Submission): Snapshot {
  // Same id again = the blocker was updated (e.g. cleared with an end date).
  if (sub.kind === 'blocker') return { ...snap, delays: [...snap.delays.filter(d => d.id !== sub.delay.id), sub.delay] }
  if (sub.kind === 'incident') {
    const rest = snap.incidents.filter(i => i.id !== sub.incident.id)
    return { ...snap, incidents: [...rest, sub.incident] }
  }
  const u = sub.update
  const day: ISODate = u.at.slice(0, 10)
  const pos = snap.pos.map(po => {
    if (po.id !== u.poId) return po
    const prev = po.milestoneActual[u.milestone] ?? {}
    return {
      ...po,
      progress: { ...po.progress, [u.milestone]: u.progress },
      milestoneActual: {
        ...po.milestoneActual,
        [u.milestone]: { start: prev.start ?? (u.progress > 0 ? day : undefined), end: u.progress >= 100 ? prev.end ?? day : undefined },
      },
    }
  })
  const crews = snap.crews.map(c => (c.id === u.crewId && u.at > c.lastCheckIn.at ? { ...c, lastCheckIn: { gps: u.gps, at: u.at } } : c))
  return { ...snap, pos, crews, updates: [...snap.updates, u] }
}
