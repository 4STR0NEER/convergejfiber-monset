// Settings > People and access. Admin invites users and sets their role; there is no public sign-up.
import { useEffect, useState } from 'react'
import { DEMO } from '../../data/supabase'
import { useData } from '../../state'
import { Panel } from '../../ui/Panel'

interface Profile { user_id: string; name: string; email: string; role_id: string; contractor_id: string | null; crew_id: string | null }
interface RoleRow { id: string; label: string; scope: 'all' | 'contractor' | 'crew' }

const field = 'h-10 rounded-lg border border-border bg-bg px-3 text-[14px] outline-none focus:border-[var(--accent)]'

export function Users() {
  const { snap, can } = useData()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [form, setForm] = useState({ email: '', name: '', role_id: 'ground', contractor_id: '', crew_id: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { supabase } = await import('../../data/supabaseClient')
    const [p, r] = await Promise.all([supabase.from('profiles').select('*').order('name'), supabase.from('roles').select('id, label, scope')])
    setProfiles((p.data ?? []) as Profile[]); setRoles((r.data ?? []) as RoleRow[])
  }
  useEffect(() => { if (!DEMO && can('users.manage')) load() }, [can])

  if (!can('users.manage')) return null
  if (DEMO) return (
    <Panel className="mt-4" title="People and access" sub="Who can sign in, and what they see">
      <p className="text-[13px] text-muted">Demo mode uses the fixed demo accounts on the sign-in screen. With the live backend, the admin invites each person by email here and picks their role, contractor and crew.</p>
    </Panel>
  )

  const scope = roles.find(r => r.id === form.role_id)?.scope ?? 'crew'
  const crews = snap.crews.filter(c => c.contractorId === form.contractor_id)
  const set = (p: Partial<typeof form>) => { setForm(f => ({ ...f, ...p })); setMsg(null) }
  const invite = async () => {
    setBusy(true)
    const { supabase } = await import('../../data/supabaseClient')
    const { data, error } = await supabase.functions.invoke('invite-user', { body: form })
    setBusy(false)
    if (error) {
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
      return setMsg({ ok: false, text: detail?.error ?? error.message })
    }
    setMsg({ ok: true, text: data?.resent ? `${form.email} already had an account: a password reset email was sent and their role updated.` : `Invitation sent to ${form.email}.` })
    setForm(f => ({ ...f, email: '', name: '' }))
    load()
  }
  const label = (p: Profile) => [roles.find(r => r.id === p.role_id)?.label ?? p.role_id, p.contractor_id, p.crew_id && `Crew ${p.crew_id}`].filter(Boolean).join(' · ')

  return (
    <Panel className="mt-4" title="People and access" sub="Invite by email; the invitation link lets them choose a password. Removing access: change their role, or delete the user in Supabase.">
      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]" onSubmit={e => { e.preventDefault(); invite() }}>
        <input aria-label="Email" type="email" required placeholder="Email" value={form.email} onChange={e => set({ email: e.target.value })} className={field} />
        <input aria-label="Full name" required placeholder="Full name" value={form.name} onChange={e => set({ name: e.target.value })} className={field} />
        <select aria-label="Role" value={form.role_id} onChange={e => set({ role_id: e.target.value })} className={field}>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select aria-label="Contractor" disabled={scope === 'all'} value={form.contractor_id} onChange={e => set({ contractor_id: e.target.value, crew_id: '' })} className={`${field} disabled:opacity-40`}>
          <option value="">{scope === 'all' ? 'All contractors' : 'Contractor…'}</option>
          {snap.contractors.map(c => <option key={c.id} value={c.id}>{c.short}</option>)}
        </select>
        <select aria-label="Crew" disabled={scope !== 'crew'} value={form.crew_id} onChange={e => set({ crew_id: e.target.value })} className={`${field} disabled:opacity-40`}>
          <option value="">{scope === 'crew' ? 'Crew…' : 'No crew'}</option>
          {crews.map(c => <option key={c.id} value={c.id}>{c.id} · {c.lead}</option>)}
        </select>
        <button disabled={busy} className="h-10 rounded-lg bg-text px-4 text-[13px] font-semibold text-bg disabled:opacity-60">{busy ? 'Sending…' : 'Invite'}</button>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-[13px] ${msg.ok ? 'text-[var(--st-ontrack)]' : 'text-bad'}`}>{msg.text}</p>}
      <table className="mt-4 w-full text-[13px]">
        <thead><tr className="text-left text-xs text-muted"><th className="py-1.5 font-medium">Name</th><th className="font-medium">Email</th><th className="font-medium">Access</th></tr></thead>
        <tbody>
          {profiles.map(p => <tr key={p.user_id} className="border-t border-border"><td className="py-2">{p.name}</td><td className="font-mono text-xs">{p.email}</td><td>{label(p)}</td></tr>)}
        </tbody>
      </table>
    </Panel>
  )
}
