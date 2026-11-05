import { diffDays, fmtDate, peso, type ISODate } from './dates'
import { computeLd, type LdBreakdown } from './ld'
import {
  currentPtl, MILESTONE_LABEL, MILESTONES,
  type Activity, type DelayEvent, type MilestoneKey, type PO, type Settings, type Snapshot, type Status,
} from './types'

export const STATUS_LABEL: Record<Status, string> = {
  COMPLETED: 'Completed', ON_TRACK: 'On Track', TRENDING_LATE: 'Trending Late', AT_RISK: 'At Risk', DELAYED: 'Delayed',
}
export const STATUSES: Status[] = ['COMPLETED', 'ON_TRACK', 'TRENDING_LATE', 'AT_RISK', 'DELAYED']

export interface PoEval {
  po: PO
  /** Our status (Manila rules + Trending Late). */
  status: Status
  /** Manila's status, calendar only. Never TRENDING_LATE. */
  manilaStatus: Status
  activity: Activity
  effectiveTarget: ISODate
  /** Negative when past the target. */
  daysToTarget: number
  elapsedPct: number
  progressPct: number
  /** elapsed - progress, in points. Positive = behind schedule. */
  gap: number
  /** 0-100 schedule health. */
  health: number
  ld: LdBreakdown
  openBlockers: DelayEvent[]
  /** Plain-language reasons the PO has its status. */
  why: string[]
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n)

export function weightedProgress(progress: Record<MilestoneKey, number>, weights: Record<MilestoneKey, number>) {
  const total = MILESTONES.reduce((a, k) => a + weights[k], 0)
  return total ? MILESTONES.reduce((a, k) => a + progress[k] * weights[k], 0) / total : 0
}

/** Planned % of a milestone by a date, straight line between its PTL start and end. */
export function plannedMilestonePct(po: PO, k: MilestoneKey, asOf: ISODate) {
  const m = currentPtl(po).milestones[k]
  const span = diffDays(m.plannedStart, m.plannedEnd)
  if (span <= 0) return asOf >= m.plannedEnd ? 100 : 0
  return clamp((diffDays(m.plannedStart, asOf) / span) * 100)
}

export function evaluatePO(po: PO, delays: DelayEvent[], s: Settings, asOf: ISODate): PoEval {
  const ptl = currentPtl(po)
  const mine = delays.filter(d => d.poId === po.id)
  const ld = computeLd(po, mine, s, asOf)
  const done = !!po.patDate && po.patDate <= asOf
  const progressPct = done ? 100 : weightedProgress(po.progress, s.weights)
  const started = ptl.start <= asOf && (progressPct > 0 || Object.values(po.milestoneActual).some(m => m?.start))
  const activity: Activity = done ? 'COMPLETED' : started ? 'ONGOING' : 'NOT_STARTED'

  const daysToTarget = diffDays(asOf, ld.effectiveTarget)
  const span = diffDays(ptl.start, ld.effectiveTarget)
  const elapsedPct = done ? 100 : span > 0 ? clamp((diffDays(ptl.start, asOf) / span) * 100) : 100
  const gap = done ? 0 : elapsedPct - progressPct

  const manilaStatus: Status = done ? 'COMPLETED'
    : daysToTarget < 0 ? 'DELAYED'
    : daysToTarget <= s.atRiskDays ? 'AT_RISK'
    : 'ON_TRACK'
  const status: Status = manilaStatus === 'ON_TRACK' && gap > s.trendingLateGap ? 'TRENDING_LATE' : manilaStatus

  const health = round(clamp(100 - Math.max(0, gap) - Math.min(50, ld.lateDays)))
  const openBlockers = mine.filter(d => !d.end || d.end >= asOf).filter(d => d.start <= asOf)

  // ---- plain-language why ----
  const why: string[] = []
  const eotNote = ld.eotDays
    ? ` Target includes ${ld.eotDays} days of excused delay (${[...new Set(ld.periods.filter(p => !p.ldEligible).map(p => p.label))].join(', ')}).`
    : ''
  if (status === 'COMPLETED') {
    why.push(ld.lateDays
      ? `PAT accepted ${fmtDate(po.patDate!)}, ${ld.lateDays} days after the target of ${fmtDate(ld.effectiveTarget)}.${eotNote}`
      : `PAT accepted ${fmtDate(po.patDate!)}, on or before the target of ${fmtDate(ld.effectiveTarget)}.`)
  } else if (status === 'DELAYED') {
    why.push(`Target PAT was ${fmtDate(ld.effectiveTarget)}, ${-daysToTarget} days ago, and the PO is not yet accepted.${eotNote}`)
  } else if (status === 'AT_RISK') {
    why.push(`Target PAT ${fmtDate(ld.effectiveTarget)} is ${daysToTarget} days away and work is ${round(progressPct)}% done.${eotNote}`)
  } else if (status === 'TRENDING_LATE') {
    why.push(`${round(elapsedPct)}% of the timeline has passed but work is only ${round(progressPct)}% done: ${round(gap)} points behind (flag at ${s.trendingLateGap}). Target is still ${daysToTarget} days away.`)
  }
  if (!done && activity !== 'NOT_STARTED') {
    const worst = MILESTONES
      .map(k => ({ k, behind: plannedMilestonePct(po, k, asOf) - po.progress[k] }))
      .sort((a, b) => b.behind - a.behind)[0]
    if (worst.behind >= 15) {
      why.push(`${MILESTONE_LABEL[worst.k]} is at ${round(po.progress[worst.k])}%, planned ${round(plannedMilestonePct(po, worst.k, asOf))}% by today.`)
    }
  }
  for (const b of openBlockers) {
    const r = s.reasons.find(x => x.code === b.reasonCode)
    why.push(`Blocked since ${fmtDate(b.start)}: ${r?.label ?? b.reasonCode} (${r?.ldEligible === false ? 'not subject to LD' : 'subject to LD'}).`)
  }
  if (ld.amount > 0) {
    why.push(`${ld.lateDays} contractor-attributable days late = ${ld.weeks} week${ld.weeks > 1 ? 's' : ''} of LD: ${peso(ld.amount)}${ld.capped ? ' (capped at 50%)' : ''}${ld.clockStopped ? ', clock stopped at PAT' : ' and accruing'}.`)
  }

  return { po, status, manilaStatus, activity, effectiveTarget: ld.effectiveTarget, daysToTarget, elapsedPct, progressPct, gap, health, ld, openBlockers, why }
}

export function evaluateAll(snap: Snapshot, s: Settings, asOf = snap.asOf): PoEval[] {
  const byPo = new Map<string, DelayEvent[]>()
  for (const d of snap.delays) byPo.set(d.poId, [...(byPo.get(d.poId) ?? []), d])
  return snap.pos.map(po => evaluatePO(po, byPo.get(po.id) ?? [], s, asOf))
}
