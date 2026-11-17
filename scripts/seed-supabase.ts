// Load the demo portfolio into Supabase: npm run seed:supabase
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (never commit it). Wipes all business data first,
// then loads the same deterministic seed the demo mode shows, with dates relative to today, and creates the
// demo accounts (password demo1234). Re-run it to refresh the dates before a pitch.
import { createClient } from '@supabase/supabase-js'
import { DEMO_PASSWORD, directory } from '../src/data/auth'
import { assumedNetwork, placeOnRoutes } from '../src/data/network'
import { snapshotRows } from '../src/data/rows'
import { generateSeed } from '../src/data/seed'
import { todayManila } from '../src/domain/dates'

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

function ok<R extends { data: unknown; error: { message: string } | null }>(r: R, what: string): R['data'] {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}
async function load(table: string, rows: Record<string, unknown>[], onConflict?: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    ok(await (onConflict ? db.from(table).upsert(batch, { onConflict }) : db.from(table).insert(batch)), table)
  }
  console.log(`  ${table}: ${rows.length}`)
}

const network = assumedNetwork()
const snap = placeOnRoutes(generateSeed({ asOf: todayManila(), nowMs: Date.now() }), network)
const r = snapshotRows(snap, network)

console.log('Wiping business data…')
ok(await db.rpc('reset_demo_data'), 'reset_demo_data')

console.log('Loading the demo portfolio…')
for (const t of ['contractors', 'programs', 'categories', 'clusters', 'reason_codes', 'holidays', 'settings', 'crews', 'pos', 'crew_pos', 'ptl_versions', 'delay_events', 'field_updates', 'incidents'] as const) {
  await load(t, r[t])
}
// Field updates move milestones and check-ins through a trigger; the seed's own values win.
await load('po_milestones', r.po_milestones, 'po_id,milestone')
await load('crews', r.crews, 'id')
ok(await db.rpc('replace_network', { segs: r.segments, nodes: r.network_nodes, source: null, origin: 'assumed' }), 'replace_network')
console.log(`  routes: ${r.segments.length}, nodes: ${r.network_nodes.length}`)

console.log('Demo accounts…')
const existing = new Map<string, string>()
for (let page = 1; ; page++) {
  const { users } = ok(await db.auth.admin.listUsers({ page, perPage: 1000 }), 'listUsers')
  users.forEach(u => u.email && existing.set(u.email, u.id))
  if (users.length < 1000) break
}
const profiles = []
for (const s of directory(snap)) {
  let id = existing.get(s.email)
  if (!id) id = ok(await db.auth.admin.createUser({ email: s.email, password: DEMO_PASSWORD, email_confirm: true }), s.email).user!.id
  profiles.push({ user_id: id, name: s.name, email: s.email, role_id: s.role, contractor_id: s.contractorId ?? null, crew_id: s.crewId ?? null })
}
await load('profiles', profiles, 'user_id')

// Loading is not history: start the audit log clean.
ok(await db.from('audit_log').delete().gte('id', 0), 'audit_log')
console.log(`Done. ${snap.pos.length} POs as of ${snap.asOf}. Sign in as admin@convergej.demo / ${DEMO_PASSWORD}.`)
