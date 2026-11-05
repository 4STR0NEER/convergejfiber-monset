import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS as S } from './config'
import { can } from './access'
import { applySubmission } from './field'
import { buildPo, defaultMilestones, validateNewPo, type NewPoInput } from './po'
import { evaluatePO } from './status'
import { generateSeed } from '../data/seed'

const snap = generateSeed({ asOf: '2026-11-05', nowMs: Date.parse('2026-11-05T10:00:00+08:00') })
const input = (over: Partial<NewPoInput> = {}): NewPoInput => ({
  id: '4500999001', kind: 'PO', title: 'Aerial FOC build, Pajo to Ibo', programId: 'NEWBUILD', clusterId: 'LLC', categoryId: 'AER-NB',
  contractorId: 'BLC', costOfWorks: 2_500_000, lengthKm: 3.2, start: '2026-11-10', targetPat: '2027-03-10',
  milestones: defaultMilestones('2026-11-10', '2027-03-10'), signedAt: '2026-11-05', ...over,
})

describe('creating a PO', () => {
  it('default milestones follow the PTL and overlap like the seed', () => {
    const m = defaultMilestones('2026-01-01', '2026-04-11') // 100 days
    expect(m.ENG).toEqual({ plannedStart: '2026-01-01', plannedEnd: '2026-01-21' })
    expect(m.FOC.plannedEnd).toBe('2026-04-11')
    expect(m.ROW.plannedStart < m.ENG.plannedEnd).toBe(true)
  })

  it('validates the essentials', () => {
    const ids = new Set(snap.pos.map(p => p.id))
    expect(validateNewPo(input(), ids)).toEqual([])
    expect(validateNewPo(input({ id: snap.pos[0].id }), ids)[0]).toMatch(/already exists/)
    expect(validateNewPo(input({ id: '123' }), ids)).toContain('A PO number is 10 digits.')
    expect(validateNewPo(input({ costOfWorks: 0 }), ids).join()).toMatch(/Cost of works/)
    expect(validateNewPo(input({ targetPat: '2026-11-01' }), ids).join()).toMatch(/after the PTL start/)
    expect(validateNewPo(input({ kind: 'WO', id: 'WO-SR-26-0999' }), ids)).toEqual([])
  })

  it('a new PO joins the portfolio, starts Not Started, and can be assigned to a crew', () => {
    const crew = snap.crews.find(c => c.contractorId === 'BLC')!
    const next = applySubmission(snap, { kind: 'po', po: buildPo(input()), crewId: crew.id })
    expect(next.pos).toHaveLength(snap.pos.length + 1)
    expect(next.crews.find(c => c.id === crew.id)!.poIds).toContain('4500999001')
    const ev = evaluatePO(next.pos.at(-1)!, next.delays, S, snap.asOf)
    expect(ev.activity).toBe('NOT_STARTED')
    expect(ev.ld.amount).toBe(0)
  })

  it('only admins add POs and nodes', () => {
    expect(can({ userId: 'a', name: '', email: '', role: 'admin' }, 'po.create')).toBe(true)
    expect(can({ userId: 'm', name: '', email: '', role: 'manager', contractorId: 'BLC' }, 'po.create')).toBe(false)
    expect(can({ userId: 'm', name: '', email: '', role: 'manager', contractorId: 'BLC' }, 'network.edit')).toBe(false)
  })
})
