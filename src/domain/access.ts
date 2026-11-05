// Who can see what, and do what. Pure functions: the UI uses them now; with Supabase the same rules
// become row-level security policies (see README).
import type { Network, Snapshot } from './types'

export type Role = 'admin' | 'manager' | 'ground'
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', manager: 'Contractor manager', ground: 'Ground team' }

export interface Session {
  userId: string
  name: string
  email: string
  role: Role
  /** Managers and ground team belong to one contractor (MSP). */
  contractorId?: string
  /** Ground team belong to one crew. */
  crewId?: string
}

export type Action =
  | 'settings.edit'      // business rules, reason codes, route files
  | 'close.run'          // mark close steps done, edit gap analyses, waive, issue notices
  | 'close.acknowledge'  // acknowledge or dispute an LD notice
  | 'incident.bom'       // edit the restoration bill of materials
  | 'incident.award'     // decide if permanent restoration is awarded or for award
  | 'field.submit'       // send updates, blockers, damage reports
  | 'field.switchCrew'   // act as another crew in the Field App

const RULES: Record<Action, Role[]> = {
  'settings.edit': ['admin'],
  'close.run': ['admin'],
  'close.acknowledge': ['admin', 'manager'],
  'incident.bom': ['admin', 'manager'],
  'incident.award': ['admin'],
  'field.submit': ['admin', 'manager', 'ground'],
  'field.switchCrew': ['admin', 'manager'],
}
export const can = (s: Session | null, a: Action) => !!s && RULES[a].includes(s.role)

/** Screens per role. Ground team only get the Field App. */
const SCREENS: Record<Role, string[]> = {
  admin: ['/', '/portfolio', '/po/', '/scorecards', '/month-end', '/incidents', '/field', '/settings'],
  manager: ['/', '/portfolio', '/po/', '/scorecards', '/month-end', '/incidents', '/field'],
  ground: ['/field'],
}
export const ROLE_HOME: Record<Role, string> = { admin: '/', manager: '/', ground: '/field' }
export function canVisit(role: Role, path: string) {
  return SCREENS[role].some(p => (p === '/' ? path === '/' : path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`)))
}

/**
 * The slice of the portfolio a user may see. Admin: everything. Manager: their contractor's POs and
 * everything hanging off them. Ground team: only their crew's POs.
 */
export function scopeSnapshot(snap: Snapshot, s: Session): Snapshot {
  if (s.role === 'admin') return snap
  const crew = s.role === 'ground' ? snap.crews.find(c => c.id === s.crewId) : undefined
  const pos = snap.pos.filter(p => (s.role === 'ground' ? !!crew?.poIds.includes(p.id) : p.contractorId === s.contractorId))
  const ids = new Set(pos.map(p => p.id))
  return {
    ...snap,
    pos,
    contractors: snap.contractors.filter(c => c.id === s.contractorId),
    delays: snap.delays.filter(d => ids.has(d.poId)),
    updates: snap.updates.filter(u => ids.has(u.poId)),
    crews: s.role === 'ground' ? (crew ? [crew] : []) : snap.crews.filter(c => c.contractorId === s.contractorId),
    incidents: snap.incidents.filter(i => (i.poId && ids.has(i.poId)) || (s.role === 'manager' && i.witnessingMsp === s.contractorId)),
  }
}

/** Only draw the routes of POs the user may see; nodes stay. */
export const scopeNetwork = (n: Network, snap: Snapshot): Network => {
  const ids = new Set(snap.pos.map(p => p.id))
  return { ...n, segments: n.segments.filter(seg => ids.has(seg.poId)) }
}
