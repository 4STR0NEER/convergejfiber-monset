// Admin invites a user (no public sign-up). Deploy: supabase functions deploy invite-user
// Body: { email, name, role_id, contractor_id?, crew_id? }. The caller must have can_manage_users.
// An email already registered gets a password-reset email instead (the "forgot password" path).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  // Acting as the caller, so RLS and the audit log see who did it.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return reply(401, { error: 'Sign in first.' })
  const { data: me } = await caller.from('profiles').select('roles(can_manage_users)').eq('user_id', user.id).maybeSingle()
  if (!(me?.roles as { can_manage_users?: boolean } | null)?.can_manage_users) return reply(403, { error: 'You may not invite users.' })

  const b = await req.json().catch(() => ({}))
  const email = String(b.email ?? '').trim().toLowerCase()
  const name = String(b.name ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) return reply(400, { error: 'Name and a valid email are required.' })
  const { data: role } = await caller.from('roles').select('scope').eq('id', b.role_id).maybeSingle()
  if (!role) return reply(400, { error: 'Unknown role.' })
  if (role.scope !== 'all' && !b.contractor_id) return reply(400, { error: 'Pick the contractor this user belongs to.' })
  if (role.scope === 'crew' && !b.crew_id) return reply(400, { error: 'Pick the crew this user belongs to.' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const redirectTo = req.headers.get('origin') ?? undefined
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  let userId = invited.data.user?.id
  if (!userId) {
    // Already registered: look them up and send a reset link instead.
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = data.users.find(u => u.email === email)?.id
    if (!userId) return reply(400, { error: invited.error?.message ?? 'Could not invite this email.' })
    await admin.auth.resetPasswordForEmail(email, { redirectTo })
  }
  const { error } = await caller.from('profiles').upsert({
    user_id: userId, email, name, role_id: b.role_id,
    contractor_id: role.scope === 'all' ? null : b.contractor_id, crew_id: role.scope === 'crew' ? b.crew_id : null,
  })
  if (error) return reply(400, { error: error.message })
  return reply(200, { ok: true, resent: !invited.data.user })
})
