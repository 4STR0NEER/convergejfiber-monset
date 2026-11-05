import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS as S } from './config'
import { addDays, coveredDays } from './dates'
import { computeLd } from './ld'
import { closeDayIndex, closeDays, docsDeadline, docsReport, draftGapAnalysis, falloutList, isDocsLate, ldRecommendations } from './monthEnd'
import { evaluateAll, evaluatePO, weightedProgress } from './status'
import { delaysByReason, milestoneSummary, monthlySeries, reconcile, scorecards, statusBy } from './metrics'
import type { DelayEvent, PO } from './types'
import { generateSeed } from '../data/seed'

const ms = (s: string, e: string) => ({ plannedStart: s, plannedEnd: e })
function po(over: Partial<PO> & { start?: string; target?: string } = {}): PO {
  const start = over.start ?? '2026-01-01', target = over.target ?? '2026-01-31'
  return {
    id: 'P1', kind: 'PO', title: 't', programId: 'NEWBUILD', clusterId: 'MDE', categoryId: 'AER-NB', contractorId: 'KIS',
    costOfWorks: 1_000_000, lengthKm: 5,
    ptl: [{ version: 1, signedAt: start, start, targetPat: target, milestones: { ENG: ms(start, target), ROW: ms(start, target), CIVIL: ms(start, target), FOC: ms(start, target) } }],
    progress: { ENG: 0, ROW: 0, CIVIL: 0, FOC: 0 }, milestoneActual: {},
    ...over,
  }
}
const delay = (reasonCode: string, start: string, end?: string): DelayEvent =>
  ({ id: `${reasonCode}${start}`, poId: 'P1', reasonCode, milestone: 'ROW', start, end, note: '', reportedBy: '' })

describe('coveredDays', () => {
  it('unions overlaps and clips to the window', () => {
    expect(coveredDays([{ start: '2026-01-01', end: '2026-01-10' }, { start: '2026-01-05', end: '2026-01-12' }], '2026-01-01', '2026-12-31')).toBe(12)
    expect(coveredDays([{ start: '2026-01-01', end: '2026-01-10' }], '2026-01-06', '2026-01-08')).toBe(3)
    expect(coveredDays([{ start: '2026-01-01', end: '2026-01-03' }, { start: '2026-01-04', end: '2026-01-05' }], '2026-01-01', '2026-01-31')).toBe(5)
  })
})

describe('LD math', () => {
  it('no LD when PAT is on the target date', () => {
    const ld = computeLd(po({ patDate: '2026-01-31' }), [], S, '2026-03-01')
    expect(ld.lateDays).toBe(0)
    expect(ld.amount).toBe(0)
  })

  it('a portion of a week counts as a full week', () => {
    expect(computeLd(po({ patDate: '2026-02-01' }), [], S, '2026-03-01')).toMatchObject({ lateDays: 1, weeks: 1, amount: 5000 })
    expect(computeLd(po({ patDate: '2026-02-07' }), [], S, '2026-03-01')).toMatchObject({ lateDays: 7, weeks: 1, amount: 5000 })
    expect(computeLd(po({ patDate: '2026-02-08' }), [], S, '2026-03-01')).toMatchObject({ lateDays: 8, weeks: 2, amount: 10000 })
  })

  it('caps total LD at 50% of cost of works', () => {
    const ld = computeLd(po(), [], S, addDays('2026-01-31', 701)) // 101 weeks = 50.5%
    expect(ld.weeks).toBe(101)
    expect(ld.rawAmount).toBe(505_000)
    expect(ld.amount).toBe(500_000)
    expect(ld.capped).toBe(true)
    const under = computeLd(po(), [], S, addDays('2026-01-31', 700)) // exactly 100 weeks = 50%
    expect(under).toMatchObject({ amount: 500_000, capped: false })
  })

  it('mixed LD and non-LD delays: only non-LD days extend the target', () => {
    const d = [delay('DPWH', '2026-01-20', '2026-02-04'), delay('MANPOWER', '2026-02-10', '2026-02-20')]
    const ld = computeLd(po({ patDate: '2026-03-01' }), d, S, '2026-04-01')
    expect(ld.eotDays).toBe(16)
    expect(ld.effectiveTarget).toBe('2026-02-16')
    expect(ld.lateDays).toBe(13)
    expect(ld.weeks).toBe(2)
    expect(ld.amount).toBe(10_000)
    expect(ld.periods.map(p => p.ldEligible)).toEqual([false, true])
  })

  it('overlapping non-LD blockers are counted once', () => {
    const d = [delay('DPWH', '2026-01-10', '2026-01-19'), delay('LGU_POLE', '2026-01-15', '2026-01-24')]
    expect(computeLd(po({ patDate: '2026-03-01' }), d, S, '2026-04-01').eotDays).toBe(15)
  })

  it('an open non-LD blocker keeps pushing the target, so no LD accrues while blocked', () => {
    const ld = computeLd(po(), [delay('OSI', '2026-01-15')], S, '2026-03-01')
    expect(ld.lateDays).toBe(0)
    expect(ld.amount).toBe(0)
  })

  it('completion stops the clock', () => {
    const p = po({ patDate: '2026-03-01' })
    const atPat = computeLd(p, [], S, '2026-03-01')
    const later = computeLd(p, [], S, '2026-09-01')
    expect(later).toEqual(atPat)
    expect(later.clockStopped).toBe(true)
    // An open PO keeps accruing
    expect(computeLd(po(), [], S, '2026-09-01').lateDays).toBeGreaterThan(atPat.lateDays)
  })

  it('non-LD delays after PAT are ignored; unknown reason codes are contractor attributable', () => {
    expect(computeLd(po({ patDate: '2026-02-10' }), [delay('FM', '2026-02-11', '2026-03-01')], S, '2026-04-01').eotDays).toBe(0)
    expect(computeLd(po({ patDate: '2026-02-10' }), [delay('XYZ', '2026-01-20', '2026-01-25')], S, '2026-04-01').eotDays).toBe(0)
  })

  it('uses the latest PTL version as baseline', () => {
    const p = po({ patDate: '2026-02-20' })
    p.ptl.push({ ...p.ptl[0], version: 2, targetPat: '2026-02-28', note: 'rebaselined' })
    expect(computeLd(p, [], S, '2026-04-01').lateDays).toBe(0)
  })
})

describe('status', () => {
  const asOf = '2026-06-01'
  const half = { ENG: 100, ROW: 100, CIVIL: 50, FOC: 0 }
  it('Manila calendar rules at the boundaries', () => {
    expect(evaluatePO(po({ start: '2026-05-01', target: addDays(asOf, 30), progress: half }), [], S, asOf).status).toBe('AT_RISK')
    expect(evaluatePO(po({ start: '2026-05-01', target: addDays(asOf, 31), progress: half }), [], S, asOf).status).toBe('ON_TRACK')
    expect(evaluatePO(po({ start: '2026-05-01', target: asOf, progress: half }), [], S, asOf).status).toBe('AT_RISK')
    expect(evaluatePO(po({ start: '2026-05-01', target: addDays(asOf, -1), progress: half }), [], S, asOf).status).toBe('DELAYED')
    expect(evaluatePO(po({ start: '2026-05-01', target: addDays(asOf, -1), patDate: '2026-05-20' }), [], S, asOf).status).toBe('COMPLETED')
  })

  it('weighted progress uses milestone weights', () => {
    expect(weightedProgress({ ENG: 100, ROW: 0, CIVIL: 0, FOC: 0 }, S.weights)).toBe(15)
    expect(weightedProgress({ ENG: 100, ROW: 100, CIVIL: 100, FOC: 100 }, S.weights)).toBe(100)
  })

  it('Trending Late fires on a progress gap even when the target is far away', () => {
    const base = { start: addDays(asOf, -100), target: addDays(asOf, 100) } // 50% elapsed
    const behind = evaluatePO(po({ ...base, progress: { ENG: 100, ROW: 20, CIVIL: 0, FOC: 0 } }), [], S, asOf) // 20%
    expect(behind.manilaStatus).toBe('ON_TRACK')
    expect(behind.status).toBe('TRENDING_LATE')
    expect(Math.round(behind.gap)).toBe(30)
    expect(behind.why[0]).toMatch(/30 points behind/)
    const fine = evaluatePO(po({ ...base, progress: { ENG: 100, ROW: 100, CIVIL: 0, FOC: 0 } }), [], S, asOf) // 40%
    expect(fine.status).toBe('ON_TRACK')
  })

  it('activity: not started vs ongoing vs completed', () => {
    expect(evaluatePO(po({ start: addDays(asOf, 5), target: addDays(asOf, 90) }), [], S, asOf).activity).toBe('NOT_STARTED')
    expect(evaluatePO(po({ start: '2026-05-01', target: '2026-09-01', progress: half }), [], S, asOf).activity).toBe('ONGOING')
  })

  it('explains open blockers and LD in plain language', () => {
    const ev = evaluatePO(po({ progress: half }), [delay('MANPOWER', '2026-01-20')], S, '2026-02-10')
    expect(ev.status).toBe('DELAYED')
    expect(ev.why.join(' ')).toMatch(/Manpower \(subject to LD\)/)
    expect(ev.why.join(' ')).toMatch(/accruing/)
  })
})

describe('month-end close', () => {
  it('Day N counts calendar days and skips listed holidays', () => {
    const d = closeDays('2026-10', S.holidays)
    expect(d[0]).toBe('2026-10-31')
    expect(d[1]).toBe('2026-11-02') // 1 Nov is All Saints' Day
    expect(d[10]).toBe('2026-11-11')
    expect(docsDeadline('2026-10', S.holidays)).toBe('2026-11-02T23:59:59+08:00')
    expect(isDocsLate('2026-11-02T23:00:00+08:00', docsDeadline('2026-10', S.holidays))).toBe(false)
    expect(isDocsLate('2026-11-03T00:00:10+08:00', docsDeadline('2026-10', S.holidays))).toBe(true)
  })

  it('fallout list, gap draft and LD recommendations', () => {
    const asOf = '2026-10-31'
    const pos = [
      po({ id: 'LATE_OPEN', target: '2026-10-10', start: '2026-08-01' }),
      po({ id: 'ON_TIME', target: '2026-10-10', start: '2026-08-01', patDate: '2026-10-09' }),
      po({ id: 'LATE_DONE', target: '2026-10-10', start: '2026-08-01', patDate: '2026-10-20', contractorId: 'KIS' }),
      po({ id: 'EXCUSED', target: '2026-10-10', start: '2026-08-01', contractorId: 'BLC' }),
      po({ id: 'NEXT_MONTH', target: '2026-11-10', start: '2026-08-01' }),
      po({ id: 'OLD_DONE', target: '2026-08-10', start: '2026-06-01', patDate: '2026-09-01' }),
    ]
    const delays = [{ ...delay('DPWH', '2026-09-01'), poId: 'EXCUSED' }]
    const evals = pos.map(p => evaluatePO(p, delays, S, asOf))
    const fallout = falloutList(evals, '2026-10')
    expect(fallout.map(f => f.ev.po.id).sort()).toEqual(['EXCUSED', 'LATE_DONE', 'LATE_OPEN'])
    expect(fallout.find(f => f.ev.po.id === 'LATE_DONE')!.completedLate).toBe(true)

    const recs = ldRecommendations(fallout)
    expect(recs).toHaveLength(1) // EXCUSED (BLC) gets nothing
    expect(recs[0].contractorId).toBe('KIS')
    expect(recs[0].items.map(i => i.poId).sort()).toEqual(['LATE_DONE', 'LATE_OPEN'])
    expect(recs[0].total).toBe(15_000 + 10_000) // open: 21 days -> 3 wks; done: 10 days -> 2 wks
  })

  it('knows which close day today is', () => {
    expect(closeDayIndex('2026-10', S.holidays, '2026-10-30')).toBe(-1)
    expect(closeDayIndex('2026-10', S.holidays, '2026-10-31')).toBe(0)
    expect(closeDayIndex('2026-10', S.holidays, '2026-11-01')).toBe(0) // holiday: still Day 0
    expect(closeDayIndex('2026-10', S.holidays, '2026-11-02')).toBe(1)
    expect(closeDayIndex('2026-10', S.holidays, '2026-11-05')).toBe(4)
    expect(closeDayIndex('2026-10', S.holidays, '2026-11-11')).toBe(10)
    expect(closeDayIndex('2026-10', S.holidays, '2026-11-12')).toBe(11)
  })

  it('docs report flags late and missing as-built documentation', () => {
    const a = po({ id: 'A', patDate: '2026-10-20', docsSubmittedAt: '2026-11-02T22:00:00+08:00' })
    const b = po({ id: 'B', patDate: '2026-10-25', docsSubmittedAt: '2026-11-03T08:00:00+08:00' })
    const c = po({ id: 'C', patDate: '2026-10-28' })
    const rows = docsReport([a, b, c].map(p => evaluatePO(p, [], S, '2026-11-05')), '2026-10', S.holidays)
    expect(rows.map(r => [r.ev.po.id, r.late, r.missing])).toEqual([['A', false, false], ['B', true, false], ['C', true, true]])
  })

  it('gap analysis says no LD when fully excused', () => {
    const p = po({ id: 'P1', target: '2026-10-10', start: '2026-08-01' })
    const ev = evaluatePO(p, [delay('DPWH', '2026-09-01')], S, '2026-10-31')
    const gap = draftGapAnalysis({ ev, newThisMonth: true, completedLate: false }, [], S)
    expect(gap.recommendLd).toBe(false)
    expect(gap.lines.at(-1)).toMatch(/no LD/)
  })
})

describe('seed + reconciliation', () => {
  const asOf = '2026-11-05'
  const nowMs = Date.parse('2026-11-05T10:00:00+08:00')
  const snap = generateSeed({ asOf, nowMs })
  const evals = evaluateAll(snap, S)

  it('is deterministic', () => {
    expect(generateSeed({ asOf, nowMs })).toEqual(snap)
  })

  it('has the planned portfolio shape', () => {
    expect(snap.pos.filter(p => p.kind === 'PO')).toHaveLength(150)
    expect(snap.pos.filter(p => p.kind === 'WO')).toHaveLength(30)
    expect(snap.contractors).toHaveLength(8)
    expect(snap.crews).toHaveLength(30)
    expect(new Set(snap.pos.map(p => p.id)).size).toBe(snap.pos.length)
  })

  it('has a believable status mix', () => {
    const count = (st: string) => evals.filter(e => e.status === st).length
    for (const st of ['COMPLETED', 'ON_TRACK', 'TRENDING_LATE', 'AT_RISK', 'DELAYED']) expect(count(st), st).toBeGreaterThan(3)
    expect(evals.some(e => e.activity === 'NOT_STARTED')).toBe(true)
    expect(evals.filter(e => e.ld.amount > 0 && e.activity !== 'COMPLETED').length).toBeGreaterThan(3) // LD accruing
    expect(evals.some(e => e.ld.eotDays > 0)).toBe(true) // non-LD delays
    expect(snap.incidents.length).toBeGreaterThanOrEqual(3)
  })

  it('every breakdown reconciles to the grand totals', () => {
    const checks = reconcile(snap, evals, S, asOf)
    expect(checks.filter(c => !c.ok)).toEqual([])
  })

  it('scorecards cover every PO once', () => {
    const cards = scorecards(snap, evals, S, asOf)
    expect(cards.reduce((a, c) => a + c.total, 0)).toBe(evals.length)
  })

  it('delay days by reason split excused from attributable', () => {
    const rows = delaysByReason(evals)
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.some(r => r.ldEligible) && rows.some(r => !r.ldEligible)).toBe(true)
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].days).toBeGreaterThanOrEqual(rows[i].days)
  })

  it('portfolio aggregates add up', () => {
    const rows = statusBy(evals, snap.clusters, e => e.po.clusterId)
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(evals.length)
    for (const r of rows) expect(Object.values(r.counts).reduce((a, n) => a + n, 0)).toBe(r.total)
    const ms = milestoneSummary(evals, asOf)
    expect(ms.map(m => m.key)).toEqual(['ENG', 'ROW', 'CIVIL', 'FOC'])
    // Engineering comes first, so it is always at least as far along as FOC on average.
    expect(ms[0].avgProgress).toBeGreaterThanOrEqual(ms[3].avgProgress)
    for (const m of ms) expect(m.complete).toBeLessThanOrEqual(m.total)
    const series = monthlySeries(evals, asOf)
    expect(series).toHaveLength(6)
    for (const p of series) expect(p.onTime).toBeLessThanOrEqual(p.actual)
  })
})
