import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS as S } from './config'
import { applySubmission, distanceToRoute, reasonImpact, validateUpdate } from './field'
import { evaluatePO } from './status'
import { generateSeed } from '../data/seed'
import type { FieldUpdate, Network } from './types'

const snap = generateSeed({ asOf: '2026-11-05', nowMs: Date.parse('2026-11-05T10:00:00+08:00') })
const open = snap.pos.find(p => !p.patDate && p.progress.FOC === 0 && p.progress.ENG > 0)!

const upd = (over: Partial<FieldUpdate> = {}): FieldUpdate => ({
  id: 'U1', poId: open.id, crewId: snap.crews[0].id, milestone: 'FOC', progress: 40,
  photoIds: ['p1'], gps: [123.9, 10.3], at: '2026-11-05T09:00:00+08:00', ...over,
})

describe('field submissions', () => {
  it('proof first: photo, GPS and progress range are required', () => {
    expect(validateUpdate(upd())).toEqual([])
    expect(validateUpdate(upd({ photoIds: [] }))).toContain('Add at least one photo.')
    expect(validateUpdate(upd({ gps: [0, 0] }))).toContain('No GPS fix yet.')
    expect(validateUpdate(upd({ progress: 120 }))).toHaveLength(1)
  })

  it('an update moves milestone progress and stamps actual start/end', () => {
    const a = applySubmission(snap, { kind: 'update', update: upd() })
    const po = a.pos.find(p => p.id === open.id)!
    expect(po.progress.FOC).toBe(40)
    expect(po.milestoneActual.FOC?.start).toBe('2026-11-05')
    expect(po.milestoneActual.FOC?.end).toBeUndefined()
    const b = applySubmission(a, { kind: 'update', update: upd({ id: 'U2', progress: 100, at: '2026-11-06T09:00:00+08:00' }) })
    expect(b.pos.find(p => p.id === open.id)!.milestoneActual.FOC).toEqual({ start: '2026-11-05', end: '2026-11-06' })
    expect(snap.pos.find(p => p.id === open.id)!.progress.FOC).toBe(0) // original untouched
  })

  it('an excused blocker immediately pushes the target; an LD blocker does not', () => {
    const base = evaluatePO(open, snap.delays, S, snap.asOf)
    const add = (code: string) => applySubmission(snap, { kind: 'blocker', delay: { id: 'B', poId: open.id, reasonCode: code, milestone: 'ROW', start: '2026-10-26', note: '', reportedBy: '' } })
    const excused = add('DPWH'), charged = add('MANPOWER')
    expect(evaluatePO(open, excused.delays, S, snap.asOf).ld.eotDays).toBeGreaterThan(base.ld.eotDays)
    expect(evaluatePO(open, charged.delays, S, snap.asOf).ld.eotDays).toBe(base.ld.eotDays)
    expect(reasonImpact('DPWH', S).ldEligible).toBe(false)
    expect(reasonImpact('MANPOWER', S).ldEligible).toBe(true)
  })

  it('clearing a blocker closes it instead of adding a second one', () => {
    const b = { id: 'B9', poId: open.id, reasonCode: 'DPWH', milestone: 'ROW' as const, start: '2026-10-20', note: '', reportedBy: '' }
    const opened = applySubmission(snap, { kind: 'blocker', delay: b })
    const cleared = applySubmission(opened, { kind: 'blocker', delay: { ...b, end: '2026-10-30' } })
    expect(cleared.delays.filter(d => d.id === 'B9')).toEqual([{ ...b, end: '2026-10-30' }])
    expect(evaluatePO(open, cleared.delays, S, snap.asOf).ld.eotDays).toBeLessThan(evaluatePO(open, opened.delays, S, snap.asOf).ld.eotDays)
  })

  it('measures how far a GPS fix is from the PO route', () => {
    const net: Network = { hubs: [], segments: [{ segmentId: 'S', poId: 'X', tier: 'sub', corridor: '', path: [[123.9, 10.3], [123.91, 10.3]] }] }
    expect(distanceToRoute(net, 'X', [123.9, 10.3])).toBe(0)
    expect(distanceToRoute(net, 'X', [124.0, 10.3])!).toBeGreaterThan(9)
    expect(distanceToRoute(net, 'nope', [123.9, 10.3])).toBeNull()
  })
})
