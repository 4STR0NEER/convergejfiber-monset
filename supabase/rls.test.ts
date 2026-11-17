// Runs the real migrations in an in-process Postgres (PGlite + PostGIS) with stand-ins for Supabase's auth and
// storage schemas, loads the demo seed, then signs in as each demo role and checks what RLS lets through.
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { beforeAll, describe, expect, it } from 'vitest'
import { directory } from '../src/data/auth'
import { assumedNetwork, placeOnRoutes } from '../src/data/network'
import { closeFromRows, snapshotFromRows, snapshotRows, type Tables } from '../src/data/rows'
import { generateSeed } from '../src/data/seed'
import { DEFAULT_ROLES, permissionsFromFlags, scopeSnapshot, type Role, type Session } from '../src/domain/access'
import { applySubmission } from '../src/domain/field'
import type { FieldUpdate, Snapshot } from '../src/domain/types'

// Stand-ins for what Supabase provides: roles, auth.uid() from the JWT claims, the storage tables.
const SUPABASE_STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create schema storage; grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant select, insert, update on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
`
const TABLES = ['contractors', 'programs', 'categories', 'clusters', 'crews', 'crew_pos', 'pos', 'ptl_versions', 'po_milestones', 'delay_events', 'field_updates', 'incidents'] as const

let db: PGlite
let seed: Snapshot
const users = new Map<string, Session>() // key -> session (userId is the auth uuid)

/** Rows exactly as PostgREST would return them (JSON, Manila timestamps). */
async function rows(sql: string, params: unknown[] = []) {
  const r = await db.query<{ j: Record<string, unknown>[] }>(`select coalesce(jsonb_agg(to_jsonb(x) - 'gps' - 'center' - 'last_gps' - 'location'), '[]') j from (${sql}) x`, params)
  return r.rows[0].j
}
async function as(key: string | null) {
  await db.exec('reset role')
  const id = key ? users.get(key)!.userId : ''
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(key ? { sub: id } : {})])
  await db.exec(`set role ${key ? 'authenticated' : 'anon'}`)
}
async function tables(): Promise<Tables> {
  const out = {} as Record<string, unknown[]>
  for (const t of TABLES) out[t] = await rows(`select * from ${t}`)
  return out as unknown as Tables
}
async function insert(table: string, data: Record<string, unknown>[], upsertOn?: string) {
  if (!data.length) return
  const cols = Object.keys(data[0]).map(c => `"${c}"`).join(', ')
  const set = upsertOn ? Object.keys(data[0]).map(c => `"${c}" = excluded."${c}"`).join(', ') : ''
  await db.query(`insert into ${table} (${cols}) select ${cols} from jsonb_populate_recordset(null::${table}, $1)${upsertOn ? ` on conflict (${upsertOn}) do update set ${set}` : ''}`, [JSON.stringify(data)])
}
const sortById = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
const norm = (s: Snapshot) => ({
  ...s,
  pos: sortById(s.pos), delays: sortById(s.delays), updates: sortById(s.updates), incidents: sortById(s.incidents).map(({ ackToken: _t, ...i }) => i),
  crews: sortById(s.crews).map(c => ({ ...c, poIds: [...c.poIds].sort() })), contractors: sortById(s.contractors),
  programs: sortById(s.programs), categories: sortById(s.categories), clusters: sortById(s.clusters),
})

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } })
  await db.exec(SUPABASE_STUBS)
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`set timezone to 'Asia/Manila'`)

  const network = assumedNetwork()
  seed = placeOnRoutes(generateSeed({ asOf: '2026-11-05', nowMs: Date.parse('2026-11-05T10:00:00+08:00') }), network)
  const r = snapshotRows(seed, network)
  for (const t of ['contractors', 'programs', 'categories', 'clusters', 'reason_codes', 'holidays', 'settings', 'crews', 'pos', 'crew_pos', 'ptl_versions', 'delay_events', 'field_updates', 'incidents'] as const) await insert(t, r[t])
  // Field updates move milestones and check-ins through a trigger; the seed's own values win.
  await insert('po_milestones', r.po_milestones, 'po_id, milestone')
  await insert('crews', r.crews, 'id')
  await db.query(`select replace_network($1, $2, null, 'assumed')`, [JSON.stringify(r.segments), JSON.stringify(r.network_nodes)])

  const dir = directory(seed)
  const crew = seed.crews.find(c => c.poIds.length > 1)!
  const pick: Record<string, Session> = {
    admin: dir.find(d => d.role === 'admin')!,
    mcc: dir.find(d => d.role === 'manager' && d.contractorId === 'MCC')!,
    other: dir.find(d => d.role === 'manager' && d.contractorId !== 'MCC' && d.contractorId !== crew.contractorId)!,
    ground: dir.find(d => d.role === 'ground' && d.crewId === crew.id)!,
  }
  for (const [key, s] of Object.entries(pick)) {
    const id = crypto.randomUUID()
    users.set(key, { ...s, userId: id })
    await db.query('insert into auth.users values ($1, $2)', [id, s.email])
    await db.query('insert into profiles values ($1, $2, $3, $4, $5, $6)', [id, s.name, s.email, s.role, s.contractorId ?? null, s.crewId ?? null])
  }
}, 120_000)

describe('schema', () => {
  it('roles table matches DEFAULT_ROLES in the domain', async () => {
    for (const row of await rows('select * from roles')) {
      const def = DEFAULT_ROLES[row.id as Role]
      expect({ scope: row.scope, permissions: permissionsFromFlags(row).sort() }).toEqual({ scope: def.scope, permissions: [...def.permissions].sort() })
    }
  })

  it('the seed reads back unchanged (row mapping round-trips)', async () => {
    await as('admin')
    expect(norm(snapshotFromRows(await tables(), seed.asOf))).toEqual(norm(seed))
  })
})

describe('row-level security', () => {
  it('admin sees every PO', async () => {
    await as('admin')
    expect(await rows('select id from pos')).toHaveLength(seed.pos.length)
  })

  it('a contractor manager sees exactly what scopeSnapshot gives them, nothing of other contractors', async () => {
    await as('mcc')
    const got = norm(snapshotFromRows(await tables(), seed.asOf))
    const want = norm(scopeSnapshot(seed, users.get('mcc')!))
    expect(got.pos.map(p => p.id)).toEqual(want.pos.map(p => p.id))
    expect(got.delays.map(d => d.id)).toEqual(want.delays.map(d => d.id))
    expect(got.updates.map(x => x.id)).toEqual(want.updates.map(x => x.id))
    expect(got.incidents.map(i => i.id)).toEqual(want.incidents.map(i => i.id))
    expect(got.crews.map(c => c.id)).toEqual(want.crews.map(c => c.id))
    expect(got.contractors.map(c => c.id)).toEqual(['MCC'])
    expect(await rows(`select id from pos where contractor_id <> 'MCC'`)).toEqual([])
    const segs = await rows('select po_id from segments_api')
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.every(s => want.pos.some(p => p.id === s.po_id))).toBe(true)
  })

  it('ground team see only their crew and its POs', async () => {
    await as('ground')
    const me = users.get('ground')!
    const crew = seed.crews.find(c => c.id === me.crewId)!
    expect((await rows('select id from pos')).map(r => r.id).sort()).toEqual([...crew.poIds].sort())
    expect((await rows('select id from crews')).map(r => r.id)).toEqual([crew.id])
    expect(await rows('select * from month_closes')).toEqual([])
  })

  it('anonymous visitors read nothing', async () => {
    await as(null)
    await expect(db.query('select id from pos')).rejects.toThrow(/permission denied/)
  })

  it('managers cannot add POs or change settings', async () => {
    await as('mcc')
    const po = await rows(`select * from pos where contractor_id = 'MCC' limit 1`)
    await expect(db.query(`insert into pos select * from jsonb_populate_record(null::pos, $1)`, [JSON.stringify({ ...po[0], id: 'X-1' })])).rejects.toThrow(/row-level security/)
    await db.query(`update settings set value = value || '{"ldCap": 0.9}'`)
    await as('admin')
    expect((await rows('select value from settings'))[0].value).toMatchObject({ ldCap: 0.5 })
  })

  it('a field update applies server-side like applySubmission, and only for your own crew', async () => {
    await as('ground')
    const me = users.get('ground')!
    const poId = seed.crews.find(c => c.id === me.crewId)!.poIds[0]
    const update: FieldUpdate = { id: 'FU-TEST', poId, crewId: me.crewId!, milestone: 'CIVIL', progress: 100, photoIds: [`${poId}/FU-TEST-0.jpg`], gps: [123.9, 10.3], at: '2026-11-05T11:00:00+08:00' }
    await insert('field_updates', [{ id: 'FU-TEST', po_id: poId, crew_id: me.crewId, milestone: 'CIVIL', progress: 100, photo_paths: update.photoIds, lng: 123.9, lat: 10.3, at: update.at }])
    const got = snapshotFromRows(await tables(), seed.asOf)
    const want = applySubmission(scopeSnapshot(seed, me), { kind: 'update', update })
    expect(got.pos.find(p => p.id === poId)!.progress).toEqual(want.pos.find(p => p.id === poId)!.progress)
    expect(got.pos.find(p => p.id === poId)!.milestoneActual.CIVIL).toEqual(want.pos.find(p => p.id === poId)!.milestoneActual.CIVIL)
    expect(got.crews[0].lastCheckIn).toEqual(want.crews.find(c => c.id === me.crewId)!.lastCheckIn)

    const notMine = seed.pos.find(p => !seed.crews.find(c => c.id === me.crewId)!.poIds.includes(p.id))!.id
    await expect(db.query(`insert into field_updates (id, po_id, crew_id, milestone, progress, photo_paths, lng, lat, at) values ('FU-X', $1, $2, 'ENG', 10, '{a}', 0, 0, now())`, [notMine, me.crewId])).rejects.toThrow(/row-level security/)
  })

  it('signed PTL versions can never be changed, even by admin or the database owner', async () => {
    await as('admin')
    expect((await db.query(`update ptl_versions set target_pat = target_pat + 30 where version = 1`)).affectedRows).toBe(0)
    await db.exec('reset role')
    await expect(db.query(`update ptl_versions set target_pat = target_pat + 30 where version = 1`)).rejects.toThrow(/signed and cannot be changed/)
    await expect(db.query(`delete from ptl_versions where version = 1`)).rejects.toThrow(/signed and cannot be changed/)
  })

  it('contractors see an LD notice only once issued, may acknowledge it, and cannot change anything else', async () => {
    await as('admin')
    await db.exec(`insert into month_closes (period) values ('2026-10'); insert into ld_notices (period, contractor_id) values ('2026-10', 'MCC')`)
    await as('mcc')
    expect(await rows('select * from ld_notices')).toEqual([])
    await as('admin')
    await db.exec(`update ld_notices set sent_at = now() where contractor_id = 'MCC'`)
    await as('mcc')
    await db.exec(`update ld_notices set ack_name = 'MCC PM', ack_at = now()`)
    await expect(db.exec(`update ld_notices set sent_at = null`)).rejects.toThrow(/Only the PMO/)
    const close = closeFromRows('2026-10', (await rows('select * from month_closes'))[0], [], [], await rows('select * from ld_notices'))
    expect(close.notices.MCC.ack?.name).toBe('MCC PM')
    await as('other')
    expect(await rows('select * from ld_notices')).toEqual([])
  })

  it('managers edit the BOM but cannot decide the award', async () => {
    await db.exec('reset role')
    const inc = (await db.query<{ id: string }>(`update incidents set witnessing_msp = 'MCC' where id = (select min(id) from incidents) returning id`)).rows[0]
    await as('mcc')
    expect((await db.query(`update incidents set bom = '[]' where id = $1`, [inc.id])).affectedRows).toBe(1)
    await expect(db.query(`update incidents set permanent_restoration = case when permanent_restoration = 'for-award' then 'same-contractor' else 'for-award' end where id = $1`, [inc.id])).rejects.toThrow(/award/)
  })

  it('every change lands in the audit log with who did it; only admins read it', async () => {
    await as('admin')
    await db.exec(`update settings set value = value || '{"atRiskDays": 21}'`)
    const log = await rows(`select * from audit_log where entity = 'settings' and field = 'value'`)
    expect(log.at(-1)).toMatchObject({ actor_email: users.get('admin')!.email, action: 'update' })
    expect((log.at(-1)!.after as { atRiskDays: number }).atRiskDays).toBe(21)
    await as('mcc')
    expect(await rows('select * from audit_log')).toEqual([])
  })

  it('the QR signing link works without an account, with the right token, once', async () => {
    await as('admin')
    const { id, ack_token } = (await rows('select id, ack_token from incidents where undertaking is null limit 1'))[0] as { id: string; ack_token: string }
    await as(null)
    expect((await db.query<{ j: unknown }>('select ack_incident($1, gen_random_uuid()) j', [id])).rows[0].j).toBeNull()
    expect((await db.query<{ j: { id: string } }>('select ack_incident($1, $2) j', [id, ack_token])).rows[0].j.id).toBe(id)
    expect((await db.query<{ ok: boolean }>(`select sign_undertaking($1, $2, 'J. Cruz', 'Foreman', 'data:image/png;base64,AA') ok`, [id, ack_token])).rows[0].ok).toBe(true)
    expect((await db.query<{ ok: boolean }>(`select sign_undertaking($1, $2, 'Someone', 'Else', 'x') ok`, [id, ack_token])).rows[0].ok).toBe(false)
  })

  it('photos follow PO visibility in Storage', async () => {
    await as('ground')
    const me = users.get('ground')!
    const mine = seed.crews.find(c => c.id === me.crewId)!.poIds[0]
    const other = seed.pos.find(p => p.contractorId !== me.contractorId)!.id
    await db.query(`insert into storage.objects (bucket_id, name) values ('field-photos', $1)`, [`${mine}/a.jpg`])
    await expect(db.query(`insert into storage.objects (bucket_id, name) values ('field-photos', $1)`, [`${other}/a.jpg`])).rejects.toThrow(/row-level security/)
    await as('other')
    expect(await rows(`select name from storage.objects`)).toEqual([])
  })

  it('only the seed script (service role) can wipe the data', async () => {
    await as('admin')
    await expect(db.query('select reset_demo_data()')).rejects.toThrow(/permission denied/)
  })
})
