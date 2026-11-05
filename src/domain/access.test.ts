import { describe, expect, it } from 'vitest'
import { can, canVisit, scopeNetwork, scopeSnapshot, type Session } from './access'
import { generateSeed } from '../data/seed'
import type { Network } from './types'

const snap = generateSeed({ asOf: '2026-11-05', nowMs: Date.parse('2026-11-05T10:00:00+08:00') })
const admin: Session = { userId: 'a', name: 'Admin', email: 'a', role: 'admin' }
const manager: Session = { userId: 'm', name: 'Mgr', email: 'm', role: 'manager', contractorId: 'MCC' }
const crew = snap.crews.find(c => c.poIds.length > 1)!
const ground: Session = { userId: 'g', name: crew.lead, email: 'g', role: 'ground', contractorId: crew.contractorId, crewId: crew.id }

describe('access', () => {
  it('admin sees everything', () => {
    expect(scopeSnapshot(snap, admin)).toBe(snap)
  })

  it("a contractor manager sees only their contractor's work", () => {
    const s = scopeSnapshot(snap, manager)
    expect(s.pos.length).toBeGreaterThan(0)
    expect(s.pos.every(p => p.contractorId === 'MCC')).toBe(true)
    expect(s.crews.every(c => c.contractorId === 'MCC')).toBe(true)
    expect(s.contractors.map(c => c.id)).toEqual(['MCC'])
    const ids = new Set(s.pos.map(p => p.id))
    expect(s.delays.every(d => ids.has(d.poId))).toBe(true)
    expect(s.updates.every(u => ids.has(u.poId))).toBe(true)
  })

  it('ground team see only their crew and its POs', () => {
    const s = scopeSnapshot(snap, ground)
    expect(s.crews.map(c => c.id)).toEqual([crew.id])
    expect(s.pos.map(p => p.id).sort()).toEqual([...crew.poIds].sort())
  })

  it('routes are scoped with the POs', () => {
    const net: Network = { hubs: [], segments: snap.pos.map((p, i) => ({ segmentId: `S${i}`, poId: p.id, tier: 'sub' as const, corridor: '', path: [] })) }
    const s = scopeSnapshot(snap, manager)
    expect(scopeNetwork(net, s).segments).toHaveLength(s.pos.length)
  })

  it('permissions follow the role', () => {
    expect(can(admin, 'settings.edit')).toBe(true)
    expect(can(manager, 'settings.edit')).toBe(false)
    expect(can(manager, 'close.run')).toBe(false)
    expect(can(manager, 'close.acknowledge')).toBe(true)
    expect(can(manager, 'incident.award')).toBe(false)
    expect(can(ground, 'field.submit')).toBe(true)
    expect(can(ground, 'field.switchCrew')).toBe(false)
    expect(can(null, 'field.submit')).toBe(false)
  })

  it('screens follow the role', () => {
    expect(canVisit('admin', '/settings')).toBe(true)
    expect(canVisit('manager', '/settings')).toBe(false)
    expect(canVisit('manager', '/po/4500193017')).toBe(true)
    expect(canVisit('manager', '/month-end/2026-10/notice/MCC')).toBe(true)
    expect(canVisit('ground', '/field')).toBe(true)
    expect(canVisit('ground', '/')).toBe(false)
    expect(canVisit('ground', '/portfolio')).toBe(false)
  })
})
