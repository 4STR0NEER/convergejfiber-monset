// Sign-in. Demo mode: demo accounts checked in the browser (the shape of security, not security).
// Otherwise Supabase Auth; the role and its permission flags come from the profiles and roles tables, and RLS enforces them.
import { permissionsFromFlags, type Role, type Session } from '../domain/access'
import type { Snapshot } from '../domain/types'
import { DEMO } from './supabase'

const KEY = 'cjf.session.v1'
export const DEMO_PASSWORD = 'demo1234'
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

/** Demo directory: one admin, one manager per contractor, one ground account per crew. The seed script creates the same accounts in Supabase. */
export function directory(snap: Snapshot): Session[] {
  return [
    { userId: 'u-admin', name: 'Backbone Build Admin', email: 'admin@convergej.demo', role: 'admin' },
    ...snap.contractors.map(c => ({ userId: `u-mgr-${c.id}`, name: `${c.short} Project Manager`, email: `pm.${c.id.toLowerCase()}@convergej.demo`, role: 'manager' as const, contractorId: c.id })),
    ...snap.crews.map(c => ({ userId: `u-crew-${c.id}`, name: c.lead, email: `${slug(c.lead)}@convergej.demo`, role: 'ground' as const, contractorId: c.contractorId, crewId: c.id })),
  ]
}

/** The signed-in user's id, for tagging outbox items (who queued it). */
let currentUserId: string | null = null
export const getCurrentUserId = () => currentUserId
const remember = (s: Session | null) => { currentUserId = s?.userId ?? null; return s }

const client = async () => (await import('./supabaseClient')).supabase

async function profileSession(userId: string): Promise<Session | null> {
  const supabase = await client()
  const { data } = await supabase.from('profiles').select('*, roles(*)').eq('user_id', userId).maybeSingle()
  if (!data) return null
  return {
    userId, name: data.name, email: data.email, role: data.role_id as Role,
    ...(data.contractor_id && { contractorId: data.contractor_id }),
    ...(data.crew_id && { crewId: data.crew_id }),
    permissions: permissionsFromFlags(data.roles ?? {}),
  }
}

export type SignInResult = { session: Session } | { error: string }

export async function signIn(email: string, password: string, dir: Session[]): Promise<SignInResult> {
  if (DEMO) {
    const user = dir.find(u => u.email === email.trim().toLowerCase())
    if (!user || password !== DEMO_PASSWORD) return { error: 'That email and password do not match a demo account.' }
    try { localStorage.setItem(KEY, JSON.stringify(user)) } catch { /* session lasts until reload */ }
    return { session: remember(user)! }
  }
  const supabase = await client()
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user) return { error: 'That email and password do not match an account.' }
  const session = await profileSession(data.user.id)
  if (!session) { await supabase.auth.signOut(); return { error: 'Your account has no role yet. Ask the Converge-J Fiber admin to finish your invitation.' } }
  return { session: remember(session)! }
}

/** Converge staff SSO (Q40). Only offered when VITE_SSO_PROVIDERS lists the provider. */
export async function signInWithProvider(provider: 'google' | 'azure') {
  await (await client()).auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } })
}

export async function getSession(): Promise<Session | null> {
  if (DEMO) {
    try { const raw = localStorage.getItem(KEY); return remember(raw ? JSON.parse(raw) : null) } catch { return null }
  }
  const { data } = await (await client()).auth.getSession()
  return remember(data.session ? await profileSession(data.session.user.id) : null)
}

/** Unsent outbox items are kept (IndexedDB); they wait for their own user to sign in again. */
export async function signOut() {
  remember(null)
  if (DEMO) { try { localStorage.removeItem(KEY) } catch { /* nothing stored */ } return }
  await (await client()).auth.signOut()
}
