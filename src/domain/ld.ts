import { addDays, coveredDays, diffDays, type ISODate } from './dates'
import { currentPtl, type DelayEvent, type PO, type Settings } from './types'

export interface DelayPeriod { reasonCode: string; label: string; start: ISODate; end: ISODate; days: number; ldEligible: boolean }

export interface LdBreakdown {
  /** Target PAT on the live PTL version. */
  baseTarget: ISODate
  /** Days of excusable (non-LD) delay, unioned so overlaps count once. Extends the target day for day. */
  eotDays: number
  effectiveTarget: ISODate
  /** PAT date if done, else as-of date. The LD clock never runs past this. */
  stopDate: ISODate
  clockStopped: boolean
  /** Calendar days past the effective target. All of these are contractor attributable. */
  lateDays: number
  /** Started weeks of delay: a portion of a week counts as a full week. */
  weeks: number
  rawAmount: number
  capAmount: number
  amount: number
  capped: boolean
  periods: DelayPeriod[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Liquidated damages for one PO.
 * - Excusable (non-LD) blockers push the target out day for day (extension of time).
 * - Every day past that extended target, until PAT, is contractor attributable.
 * - LD = rate x cost x started weeks, capped at ldCap x cost.
 */
export function computeLd(po: PO, delays: DelayEvent[], s: Settings, asOf: ISODate): LdBreakdown {
  const ptl = currentPtl(po)
  const clockStopped = !!po.patDate && po.patDate <= asOf
  const stopDate = clockStopped ? po.patDate! : asOf
  // Unknown codes (e.g. deleted in Settings) default to contractor attributable.
  const reason = (code: string) => s.reasons.find(r => r.code === code)

  const periods: DelayPeriod[] = delays
    .filter(d => d.poId === po.id && d.start <= stopDate)
    .map(d => {
      const r = reason(d.reasonCode)
      const end = d.end && d.end < stopDate ? d.end : stopDate
      return {
        reasonCode: d.reasonCode,
        label: r?.label ?? d.reasonCode,
        start: d.start,
        end,
        days: diffDays(d.start, end) + 1,
        ldEligible: r?.ldEligible ?? true,
      }
    })

  const eotDays = coveredDays(periods.filter(p => !p.ldEligible), ptl.start, stopDate)
  const effectiveTarget = addDays(ptl.targetPat, eotDays)
  const lateDays = Math.max(0, diffDays(effectiveTarget, stopDate))
  const weeks = Math.ceil(lateDays / 7)
  const rawAmount = round2(po.costOfWorks * s.ldRatePerWeek * weeks)
  const capAmount = round2(po.costOfWorks * s.ldCap)
  return {
    baseTarget: ptl.targetPat, eotDays, effectiveTarget, stopDate, clockStopped,
    lateDays, weeks, rawAmount, capAmount,
    amount: Math.min(rawAmount, capAmount),
    capped: rawAmount > capAmount,
    periods,
  }
}
