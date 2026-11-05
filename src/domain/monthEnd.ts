import { addDays, fmtDate, monthEnd, monthOf, peso, type ISODate } from './dates'
import type { PoEval } from './status'
import { currentPtl, MILESTONE_LABEL, MILESTONES, type FieldUpdate, type Settings } from './types'

export type CloseStepKey = 'declare' | 'docs' | 'fallout' | 'gap' | 'recommend' | 'notice'
export const CLOSE_STEPS: { key: CloseStepKey; label: string; from: number; to: number }[] = [
  { key: 'declare', label: 'Contractors declare actual PAT completions', from: 0, to: 0 },
  { key: 'docs', label: 'Build team accepts late as-built documentation (until midnight)', from: 1, to: 1 },
  { key: 'fallout', label: 'PMO issues the fallout list', from: 2, to: 3 },
  { key: 'gap', label: 'Backbone PMs submit gap analysis per fallout PO', from: 4, to: 5 },
  { key: 'recommend', label: 'Backbone Build sends LD recommendations to PMO', from: 5, to: 5 },
  { key: 'notice', label: 'PMO issues LD claim notice; contractor acknowledges', from: 6, to: 10 },
]

/**
 * Close calendar for a period ('YYYY-MM'). Index 0 is the last day of the month,
 * index N is "Day N": the Nth calendar day after month end, skipping listed holidays.
 */
export function closeDays(period: string, holidays: ISODate[]): ISODate[] {
  const days = [monthEnd(period)]
  let d = days[0]
  while (days.length <= 10) {
    d = addDays(d, 1)
    if (!holidays.includes(d)) days.push(d)
  }
  return days
}

export function closeSchedule(period: string, holidays: ISODate[]) {
  const days = closeDays(period, holidays)
  return CLOSE_STEPS.map(s => ({ ...s, start: days[s.from], end: days[s.to] }))
}

/** Docs are late when handed in after Day 1, 23:59:59 Manila time. */
export function docsDeadline(period: string, holidays: ISODate[]) {
  return `${closeDays(period, holidays)[1]}T23:59:59+08:00`
}
export const isDocsLate = (submittedAt: string | undefined, deadline: string) =>
  !submittedAt || Date.parse(submittedAt) > Date.parse(deadline)

export interface FalloutItem {
  ev: PoEval
  /** Base target fell inside this period (vs carried over from an earlier month). */
  newThisMonth: boolean
  completedLate: boolean
}

/**
 * Fallout = POs that missed the target PAT on their live PTL, judged at month end:
 * still open past target, or accepted this month after target.
 * `evals` must be evaluated as of monthEnd(period).
 */
export function falloutList(evals: PoEval[], period: string): FalloutItem[] {
  const end = monthEnd(period)
  return evals
    .filter(ev => {
      const target = currentPtl(ev.po).targetPat
      if (target > end) return false
      const pat = ev.po.patDate
      if (!pat || pat > end) return true
      return monthOf(pat) === period && pat > target
    })
    .map(ev => ({
      ev,
      newThisMonth: monthOf(currentPtl(ev.po).targetPat) === period,
      completedLate: !!ev.po.patDate && ev.po.patDate <= end,
    }))
}

export interface GapAnalysis { poId: string; lines: string[]; recommendLd: boolean; amount: number }

/** Pre-drafted gap analysis from field data. PMs edit the text; the numbers stay computed. */
export function draftGapAnalysis(item: FalloutItem, updates: FieldUpdate[], s: Settings): GapAnalysis {
  const { ev } = item
  const po = ev.po, ld = ev.ld
  const lines = [
    `${po.kind} ${po.id} (${po.title}) missed its target PAT of ${fmtDate(ld.baseTarget)}${item.completedLate ? `; PAT accepted ${fmtDate(po.patDate!)}` : '; still open at month end'}.`,
    `Progress now: ${MILESTONES.map(k => `${MILESTONE_LABEL[k]} ${Math.round(po.progress[k])}%`).join(', ')}.`,
  ]
  for (const p of ld.periods) {
    lines.push(`Delay: ${p.label}, ${fmtDate(p.start)} to ${fmtDate(p.end)} (${p.days} days, ${p.ldEligible ? 'contractor attributable' : 'excused, not subject to LD'}).`)
  }
  if (ld.eotDays) lines.push(`${ld.eotDays} excused days extend the target to ${fmtDate(ld.effectiveTarget)}.`)
  const last = updates.filter(u => u.poId === po.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (last) lines.push(`Last field update ${fmtDate(last.at.slice(0, 10))}: ${MILESTONE_LABEL[last.milestone]} at ${last.progress}%${last.note ? `, "${last.note.replace(/\.$/, '')}"` : ''}.`)
  lines.push(ld.amount > 0
    ? `Recommendation: apply LD of ${peso(ld.amount)} (${ld.lateDays} attributable days, ${ld.weeks} week${ld.weeks > 1 ? 's' : ''} at ${s.ldRatePerWeek * 100}%${ld.capped ? ', capped' : ''}).`
    : 'Recommendation: no LD. The delay is fully covered by excused reasons.')
  return { poId: po.id, lines, recommendLd: ld.amount > 0, amount: ld.amount }
}

export interface LdRecommendation { contractorId: string; items: { poId: string; lateDays: number; weeks: number; amount: number }[]; total: number }

export function ldRecommendations(fallout: FalloutItem[]): LdRecommendation[] {
  const map = new Map<string, LdRecommendation>()
  for (const { ev } of fallout) {
    if (ev.ld.amount <= 0) continue
    const c = ev.po.contractorId
    const rec = map.get(c) ?? { contractorId: c, items: [], total: 0 }
    rec.items.push({ poId: ev.po.id, lateDays: ev.ld.lateDays, weeks: ev.ld.weeks, amount: ev.ld.amount })
    rec.total = Math.round((rec.total + ev.ld.amount) * 100) / 100
    map.set(c, rec)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Which close day `today` is for this period: -1 before month end, 0..10 during the close, 11 after Day 10. */
export function closeDayIndex(period: string, holidays: ISODate[], today: ISODate) {
  const days = closeDays(period, holidays)
  if (today < days[0]) return -1
  if (today > days[10]) return 11
  let i = 0
  while (i < 10 && days[i + 1] <= today) i++
  return i
}

export interface DocsRow { ev: PoEval; deadline: string; late: boolean; missing: boolean }

/** POs accepted in the period and whether their as-built docs beat the Day 1 midnight cutoff. */
export function docsReport(evals: PoEval[], period: string, holidays: ISODate[]): DocsRow[] {
  const deadline = docsDeadline(period, holidays)
  return evals
    .filter(e => e.po.patDate && monthOf(e.po.patDate) === period)
    .map(ev => ({ ev, deadline, missing: !ev.po.docsSubmittedAt, late: isDocsLate(ev.po.docsSubmittedAt, deadline) }))
}

/** State of one month's close, saved as the PMs work through it. */
export interface MonthClose {
  period: string
  steps: Partial<Record<CloseStepKey, { doneAt: string; by: string }>>
  /** PM-edited gap analysis text and review flag per fallout PO. */
  gap: Record<string, { text: string; reviewed: boolean }>
  /** POs the PM chose not to charge, with the reason (shown on the recommendation). */
  waived: Record<string, string>
  notices: Record<string, { sentAt?: string; ack?: { name: string; at: string }; disputed?: string }>
}
export const emptyClose = (period: string): MonthClose => ({ period, steps: {}, gap: {}, waived: {}, notices: {} })
