import { addMonths, monthOf, type ISODate } from './dates'
import { closeDays, docsDeadline, isDocsLate } from './monthEnd'
import { STATUSES, type PoEval } from './status'
import { currentPtl, type Activity, type Settings, type Snapshot } from './types'

/**
 * LD still in play: POs not yet accepted (accruing), plus POs accepted in a month
 * whose LD notice window (Day 10) has not closed yet.
 */
export function isLdOpen(ev: PoEval, asOf: ISODate, holidays: ISODate[]) {
  if (!ev.po.patDate || ev.po.patDate > asOf) return true
  return closeDays(monthOf(ev.po.patDate), holidays)[10] >= asOf
}
export const ldExposure = (evals: PoEval[], asOf: ISODate, holidays: ISODate[]) =>
  sumPhp(evals.filter(e => isLdOpen(e, asOf, holidays)).map(e => e.ld.amount))

/** Sum pesos in centavos so totals never drift by floating point. */
export const sumPhp = (xs: number[]) => xs.reduce((a, x) => a + Math.round(x * 100), 0) / 100

// ---------- month over month ----------
export interface MonthPoint { period: string; target: number; actual: number; onTime: number }

/** Target = POs whose live target PAT falls in the month. Actual = PATs accepted that month. */
export function monthlySeries(evals: PoEval[], asOf: ISODate, months = 6): MonthPoint[] {
  const now = monthOf(asOf)
  return Array.from({ length: months }, (_, i) => addMonths(now, i - months + 1)).map(period => ({
    period,
    target: evals.filter(e => monthOf(currentPtl(e.po).targetPat) === period).length,
    actual: evals.filter(e => e.po.patDate && e.po.patDate <= asOf && monthOf(e.po.patDate) === period).length,
    onTime: evals.filter(e => e.po.patDate && e.po.patDate <= asOf && monthOf(e.po.patDate) === period && e.ld.lateDays === 0).length,
  }))
}

// ---------- contractor scorecards ----------
export interface Scorecard {
  contractorId: string
  total: number
  completed: number
  /** Share of completed POs accepted on or before their (extended) target. null if none completed. */
  onTimeRate: number | null
  /** Contractor-attributable late days / (attributable + excused days). null if no delay at all. */
  attributableShare: number | null
  attributableDays: number
  excusedDays: number
  /** Share of completed POs whose as-built docs missed the Day 1 midnight cutoff. */
  docsLateRate: number | null
  ldExposure: number
  /** On-time rate for each of the last 3 months (null = nothing completed that month). */
  trend: { period: string; rate: number | null }[]
}

const rate = (num: number, den: number) => (den ? num / den : null)

export function scorecards(snap: Snapshot, evals: PoEval[], s: Settings, asOf: ISODate): Scorecard[] {
  return snap.contractors.map(c => {
    const mine = evals.filter(e => e.po.contractorId === c.id)
    const done = mine.filter(e => e.activity === 'COMPLETED')
    const attributableDays = mine.reduce((a, e) => a + e.ld.lateDays, 0)
    const excusedDays = mine.reduce((a, e) => a + e.ld.eotDays, 0)
    const docsLate = done.filter(e => isDocsLate(e.po.docsSubmittedAt, docsDeadline(monthOf(e.po.patDate!), s.holidays)))
    const now = monthOf(asOf)
    return {
      contractorId: c.id,
      total: mine.length,
      completed: done.length,
      onTimeRate: rate(done.filter(e => e.ld.lateDays === 0).length, done.length),
      attributableShare: rate(attributableDays, attributableDays + excusedDays),
      attributableDays,
      excusedDays,
      docsLateRate: rate(docsLate.length, done.length),
      ldExposure: ldExposure(mine, asOf, s.holidays),
      trend: [-2, -1, 0].map(i => {
        const period = addMonths(now, i)
        const m = done.filter(e => monthOf(e.po.patDate!) === period)
        return { period, rate: rate(m.filter(e => e.ld.lateDays === 0).length, m.length) }
      }),
    }
  })
}

// ---------- reconciliation ----------
export interface Check { label: string; expected: number; actual: number; ok: boolean; unit: 'count' | 'php' }

/**
 * Every breakdown must add back to the same grand totals (count, cost of works, LD exposure).
 * Manila's dashboard fails this; ours shows the check on screen.
 */
export function reconcile(snap: Snapshot, evals: PoEval[], s: Settings, asOf: ISODate): Check[] {
  const total = evals.length
  const cost = sumPhp(evals.map(e => e.po.costOfWorks))
  const ld = ldExposure(evals, asOf, s.holidays)
  const checks: Check[] = []
  const push = (label: string, expected: number, actual: number, unit: Check['unit']) =>
    checks.push({ label, expected, actual, ok: Math.abs(expected - actual) < 0.005, unit })

  const dims = [
    ['program', snap.programs, (e: PoEval) => e.po.programId],
    ['cluster', snap.clusters, (e: PoEval) => e.po.clusterId],
    ['category', snap.categories, (e: PoEval) => e.po.categoryId],
    ['contractor', snap.contractors, (e: PoEval) => e.po.contractorId],
  ] as const
  for (const [name, list, key] of dims) {
    const groups = list.map(x => evals.filter(e => key(e) === x.id))
    push(`Count by ${name}`, total, groups.reduce((a, g) => a + g.length, 0), 'count')
    push(`Cost of works by ${name}`, cost, sumPhp(groups.map(g => sumPhp(g.map(e => e.po.costOfWorks)))), 'php')
    push(`LD exposure by ${name}`, ld, sumPhp(groups.map(g => ldExposure(g, asOf, s.holidays))), 'php')
  }
  push('PO + WO count', total, evals.filter(e => e.po.kind === 'PO').length + evals.filter(e => e.po.kind === 'WO').length, 'count')
  push('Count by status', total, STATUSES.reduce((a, st) => a + evals.filter(e => e.status === st).length, 0), 'count')
  const acts: Activity[] = ['COMPLETED', 'ONGOING', 'NOT_STARTED']
  push('Completed + Ongoing + Not Started', total, acts.reduce((a, x) => a + evals.filter(e => e.activity === x).length, 0), 'count')
  return checks
}
