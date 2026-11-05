// Prototype sign-in. Demo accounts only, checked in the browser: this is NOT security, it is the shape of it.
// Supabase Auth replaces signIn/signOut/getSession; roles come from a profiles table and RLS enforces scope.
import type { Session } from '../domain/access'
import type { Snapshot } from '../domain/types'

const KEY = 'cjf.session.v1'
export const DEMO_PASSWORD = 'demo1234'
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

/** Demo directory: one admin, one manager per contractor, one ground account per crew. */
export function directory(snap: Snapshot): Session[] {
  return [
    { userId: 'u-admin', name: 'Backbone Build Admin', email: 'admin@convergej.demo', role: 'admin' },
    ...snap.contractors.map(c => ({ userId: `u-mgr-${c.id}`, name: `${c.short} Project Manager`, email: `pm.${c.id.toLowerCase()}@convergej.demo`, role: 'manager' as const, contractorId: c.id })),
    ...snap.crews.map(c => ({ userId: `u-crew-${c.id}`, name: c.lead, email: `${slug(c.lead)}@convergej.demo`, role: 'ground' as const, contractorId: c.contractorId, crewId: c.id })),
  ]
}

export function signIn(email: string, password: string, dir: Session[]): Session | null {
  const user = dir.find(u => u.email === email.trim().toLowerCase())
  if (!user || password !== DEMO_PASSWORD) return null
  try { localStorage.setItem(KEY, JSON.stringify(user)) } catch { /* session lasts until reload */ }
  return user
}

export function getSession(): Session | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

export function signOut() {
  try { localStorage.removeItem(KEY) } catch { /* nothing stored */ }
}
