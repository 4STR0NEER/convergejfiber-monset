-- Backbone Command core schema: reference data, POs and PTL versions, field data, incidents, month-end close,
-- settings, roles as data, row-level security mirroring src/domain/access.ts, and the audit log.
-- Ids stay text so they match the app's ids (PO numbers, crew codes) one to one.

create extension if not exists postgis;
create schema if not exists app;
-- The app compares and slices timestamps as Manila-time strings (…+08:00), so the API must return them that way.
do $$ begin execute format('alter database %I set timezone to %L', current_database(), 'Asia/Manila'); end $$;
set timezone to 'Asia/Manila';
grant usage on schema app to anon, authenticated;

-- ───────────── Roles as data ─────────────
-- One column per permission. Splitting Admin into PMO / Backbone PM / leadership (Q37) = new rows, no code change.
-- Keep in step with DEFAULT_ROLES in src/domain/access.ts (a test compares them).
create table roles (
  id text primary key,
  label text not null,
  scope text not null check (scope in ('all', 'contractor', 'crew')),
  can_edit_settings boolean not null default false,
  can_run_close boolean not null default false,
  can_issue_notices boolean not null default false,
  can_acknowledge_notices boolean not null default false,
  can_edit_bom boolean not null default false,
  can_award_incidents boolean not null default false,
  can_submit_field boolean not null default false,
  can_switch_crew boolean not null default false,
  can_create_pos boolean not null default false,
  can_edit_network boolean not null default false,
  can_manage_users boolean not null default false,
  can_read_audit boolean not null default false,
  can_approve_change_requests boolean not null default false
);
insert into roles values
  ('admin',   'Admin',              'all',        true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true),
  ('manager', 'Contractor manager', 'contractor', false, false, false, true,  true,  false, true,  true,  false, false, false, false, false),
  ('ground',  'Ground team',        'crew',       false, false, false, false, false, false, true,  false, false, false, false, false, false);

-- ───────────── Reference data ─────────────
create table contractors (id text primary key, name text not null, short text not null);
create table programs (id text primary key, name text not null, type text not null, unit text not null check (unit in ('PO', 'WO')));
create table categories (id text primary key, name text not null, scope text not null check (scope in ('New Build', 'O&M')));
create table clusters (
  id text primary key, name text not null, lng float8 not null, lat float8 not null,
  center geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored
);
create table reason_codes (
  code text primary key, label text not null, description text, ld_eligible boolean not null,
  sort int not null default 0,
  -- Removed in Settings = inactive; old blockers keep pointing at it.
  active boolean not null default true
);
create table holidays (day date primary key);
create table settings (
  id int primary key default 1 check (id = 1),
  -- weights, trendingLateGap, atRiskDays, ldRatePerWeek, ldCap, brand. Reasons and holidays have their own tables.
  value jsonb not null,
  network_source text
);

-- ───────────── People ─────────────
create table crews (
  id text primary key, lead text not null, contractor_id text not null references contractors,
  last_lng float8, last_lat float8, last_at timestamptz,
  last_gps geography(point, 4326) generated always as (st_setsrid(st_makepoint(last_lng, last_lat), 4326)::geography) stored
);
-- Accounts are created by invitation only (Edge Function invite-user); no public sign-up.
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  role_id text not null references roles,
  contractor_id text references contractors,
  crew_id text references crews
);

-- ───────────── POs, PTL versions, milestones ─────────────
create table pos (
  id text primary key,
  kind text not null check (kind in ('PO', 'WO')),
  title text not null,
  program_id text not null references programs,
  cluster_id text not null references clusters,
  category_id text not null references categories,
  contractor_id text not null references contractors,
  cost_of_works numeric(14, 2) not null check (cost_of_works >= 0),
  length_km numeric not null default 0,
  pat_date date,
  docs_submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on pos (contractor_id);
create table crew_pos (crew_id text references crews on delete cascade, po_id text references pos on delete cascade, primary key (crew_id, po_id));
create index on crew_pos (po_id);

-- A signed PTL is never overwritten: a change is a new version (trigger below refuses updates and deletes).
create table ptl_versions (
  po_id text references pos on delete cascade,
  version int not null check (version >= 1),
  signed_at date not null,
  start date not null,
  target_pat date not null,
  milestones jsonb not null,
  note text,
  primary key (po_id, version)
);
create table po_milestones (
  po_id text references pos on delete cascade,
  milestone text not null check (milestone in ('ENG', 'ROW', 'CIVIL', 'FOC')),
  progress int not null default 0 check (progress between 0 and 100),
  actual_start date,
  actual_end date,
  primary key (po_id, milestone)
);

-- ───────────── Field data ─────────────
create table delay_events (
  id text primary key,
  po_id text not null references pos on delete cascade,
  reason_code text not null references reason_codes,
  milestone text not null check (milestone in ('ENG', 'ROW', 'CIVIL', 'FOC')),
  start date not null,
  "end" date,
  note text not null default '',
  reported_by text not null default ''
);
create index on delay_events (po_id);

create table field_updates (
  id text primary key,
  po_id text not null references pos on delete cascade,
  crew_id text not null references crews,
  milestone text not null check (milestone in ('ENG', 'ROW', 'CIVIL', 'FOC')),
  progress int not null check (progress between 0 and 100),
  photo_paths text[] not null check (cardinality(photo_paths) > 0),
  lng float8 not null, lat float8 not null,
  gps geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  gps_source text check (gps_source in ('device', 'route-demo')),
  gps_accuracy_m float8,
  distance_to_route_km float8,
  at timestamptz not null,
  note text,
  submitted_by uuid default auth.uid(),
  received_at timestamptz not null default now()
);
create index on field_updates (po_id, at);

-- ───────────── Network ─────────────
-- Routes: one row per drawn piece. origin: assumed (bundled file), imported (KMZ/KML/GeoJSON), drawn (by hand).
-- po_id is not a foreign key: an imported file may name POs not entered yet.
create table segments (
  id text primary key,
  po_id text not null,
  tier text not null check (tier in ('mainline', 'sub')),
  corridor text not null default '',
  origin text not null default 'drawn' check (origin in ('assumed', 'imported', 'drawn')),
  path geography(linestring, 4326) not null
);
create index on segments (po_id);
create index on segments using gist (path);
create table network_nodes (
  id text primary key, name text not null, core boolean not null default false,
  origin text not null default 'drawn' check (origin in ('assumed', 'imported', 'drawn')),
  lng float8 not null, lat float8 not null,
  location geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored
);
-- Readable geometry for the app (coordinates as JSON). security_invoker keeps the caller's RLS.
create view segments_api with (security_invoker = true) as
  select id, po_id, tier, corridor, origin, (st_asgeojson(path)::jsonb) -> 'coordinates' as path from segments;

-- ───────────── Incidents ─────────────
create table incidents (
  id text primary key,
  po_id text references pos on delete set null,
  cluster_id text not null references clusters,
  responsible_party text not null,
  witnessing_msp text not null,
  attending jsonb not null,
  ticket_ref text not null default '',
  related_tickets text[] not null default '{}',
  affected_link text not null default '',
  fault_location text not null default '',
  lng float8 not null, lat float8 not null,
  gps geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  received_at timestamptz not null,
  restored_at timestamptz,
  restoration_status text not null check (restoration_status in ('temporary', 'permanent', 'ongoing')),
  description text not null default '',
  undertaking_signed boolean not null default false,
  blotter_attached boolean not null default false,
  bom jsonb not null default '[]',
  permanent_restoration text not null default 'same-contractor' check (permanent_restoration in ('same-contractor', 'for-award')),
  photo_paths text[],
  undertaking jsonb,
  blotter_photo_path text,
  reported_by_crew text,
  -- Secret in the QR link, so a third party can sign the undertaking without an account.
  ack_token uuid not null default gen_random_uuid()
);
create index on incidents (po_id);

-- ───────────── Month-end close ─────────────
-- Split per PO / contractor so RLS can show a contractor only their own rows.
create table month_closes (period text primary key check (period ~ '^\d{4}-\d{2}$'), steps jsonb not null default '{}');
create table close_gaps (period text references month_closes on delete cascade, po_id text references pos on delete cascade, text text not null default '', reviewed boolean not null default false, primary key (period, po_id));
create table close_waivers (period text references month_closes on delete cascade, po_id text references pos on delete cascade, reason text not null, primary key (period, po_id));
create table ld_notices (
  period text references month_closes on delete cascade,
  contractor_id text references contractors,
  sent_at timestamptz,
  ack_name text, ack_at timestamptz,
  disputed text,
  primary key (period, contractor_id)
);

-- ───────────── Audit log ─────────────
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  actor_email text,
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  field text,
  before jsonb,
  after jsonb,
  -- Set by server functions with set_config('app.reason', ..., true) (change requests, Phase 8).
  reason text
);
create index on audit_log (entity, entity_id, at);

-- ═════════════ Helper functions (security definer: read the caller's profile without RLS recursion) ═════════════
create function app.role() returns roles language sql stable security definer set search_path = public as $$
  select r.* from profiles p join roles r on r.id = p.role_id where p.user_id = auth.uid()
$$;
create function app.scope() returns text language sql stable security definer set search_path = public as $$
  select (app.role()).scope
$$;
create function app.can(flag text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((to_jsonb(app.role()) ->> flag)::boolean, false)
$$;
create function app.my_contractor() returns text language sql stable security definer set search_path = public as $$
  select contractor_id from profiles where user_id = auth.uid()
$$;
create function app.my_crew() returns text language sql stable security definer set search_path = public as $$
  select crew_id from profiles where user_id = auth.uid()
$$;
-- Same slice as scopeSnapshot(): admin everything, manager their contractor's POs, ground their crew's POs.
create function app.sees_po(p text) returns boolean language sql stable security definer set search_path = public as $$
  select case app.scope()
    when 'all' then true
    when 'contractor' then exists (select 1 from pos where id = p and contractor_id = app.my_contractor())
    when 'crew' then exists (select 1 from crew_pos where po_id = p and crew_id = app.my_crew())
    else false end
$$;
create function app.sees_crew(c text) returns boolean language sql stable security definer set search_path = public as $$
  select case app.scope()
    when 'all' then true
    when 'contractor' then exists (select 1 from crews where id = c and contractor_id = app.my_contractor())
    when 'crew' then c = app.my_crew()
    else false end
$$;
grant execute on all functions in schema app to authenticated;

-- ═════════════ Triggers ═════════════
create function app.ptl_is_signed() returns trigger language plpgsql as $$
begin
  raise exception 'PTL % v% is signed and cannot be changed; add a new PTL version instead', old.po_id, old.version;
end $$;
create trigger ptl_versions_immutable before update or delete on ptl_versions for each row execute function app.ptl_is_signed();

-- A field update moves its milestone and the crew's last check-in (same rule as applySubmission in src/domain/field.ts).
create function app.apply_field_update() returns trigger language plpgsql security definer set search_path = public as $$
declare day date := (new.at at time zone 'Asia/Manila')::date;
begin
  insert into po_milestones (po_id, milestone) values (new.po_id, new.milestone) on conflict do nothing;
  update po_milestones set
    progress = new.progress,
    actual_start = coalesce(actual_start, case when new.progress > 0 then day end),
    actual_end = case when new.progress >= 100 then coalesce(actual_end, day) end
  where po_id = new.po_id and milestone = new.milestone;
  update crews set last_lng = new.lng, last_lat = new.lat, last_at = new.at
  where id = new.crew_id and (last_at is null or new.at > last_at);
  return new;
end $$;
create trigger field_updates_apply after insert on field_updates for each row execute function app.apply_field_update();

-- Who may change which incident fields: BOM editors (contractor managers) cannot decide the award.
create function app.guard_incident() returns trigger language plpgsql as $$
begin
  if new.permanent_restoration is distinct from old.permanent_restoration and not app.can('can_award_incidents') then
    raise exception 'Only users who can award restoration may change it';
  end if;
  if new.ack_token is distinct from old.ack_token then raise exception 'ack_token cannot change'; end if;
  return new;
end $$;
create trigger incidents_guard before update on incidents for each row execute function app.guard_incident();

-- Contractors may acknowledge or dispute an issued notice; only issuers may change anything else.
create function app.guard_notice() returns trigger language plpgsql as $$
begin
  if not app.can('can_issue_notices') and (new.sent_at is distinct from old.sent_at or new.contractor_id is distinct from old.contractor_id or new.period is distinct from old.period) then
    raise exception 'Only the PMO can issue notices';
  end if;
  return new;
end $$;
create trigger ld_notices_guard before update on ld_notices for each row execute function app.guard_notice();

-- Audit: one row per changed field (insert/delete: one row with the whole record). Generated geography columns are skipped.
create function app.audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'center' - 'last_gps' - 'gps' - 'location' end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'center' - 'last_gps' - 'gps' - 'location' end;
  rec jsonb := coalesce(n, o);
  eid text := (select string_agg(rec ->> k, '/') from unnest(tg_argv) k);
  who text := (select email from profiles where user_id = auth.uid());
  why text := nullif(current_setting('app.reason', true), '');
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if (n -> k) is distinct from (o -> k) then
        insert into audit_log (actor_email, entity, entity_id, action, field, before, after, reason)
        values (who, tg_table_name, eid, 'update', k, o -> k, n -> k, why);
      end if;
    end loop;
  else
    insert into audit_log (actor_email, entity, entity_id, action, before, after, reason)
    values (who, tg_table_name, eid, lower(tg_op), o, n, why);
  end if;
  return null;
end $$;

do $$
declare t record;
begin
  for t in select * from (values
    ('pos', 'id'), ('ptl_versions', 'po_id,version'), ('po_milestones', 'po_id,milestone'), ('crew_pos', 'crew_id,po_id'),
    ('crews', 'id'), ('profiles', 'email'), ('roles', 'id'), ('delay_events', 'id'), ('incidents', 'id'),
    ('segments', 'id'), ('network_nodes', 'id'), ('settings', 'id'), ('reason_codes', 'code'), ('holidays', 'day'),
    ('month_closes', 'period'), ('close_gaps', 'period,po_id'), ('close_waivers', 'period,po_id'), ('ld_notices', 'period,contractor_id'),
    ('contractors', 'id'), ('programs', 'id'), ('clusters', 'id'), ('categories', 'id')
  ) as x(tbl, keys) loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function app.audit(%s)',
      t.tbl || '_audit', t.tbl, (select string_agg(quote_literal(k), ',') from unnest(string_to_array(t.keys, ',')) k));
  end loop;
end $$;

-- ═════════════ Row-level security ═════════════
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys' loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
grant select on segments_api to authenticated;
-- Audit rows are written by the trigger only.
revoke insert, update, delete on audit_log from authenticated;

-- Reference data and settings: everyone signed in reads; settings editors write.
create policy read on roles for select to authenticated using (true);
create policy read on programs for select to authenticated using (true);
create policy read on categories for select to authenticated using (true);
create policy read on clusters for select to authenticated using (true);
create policy read on reason_codes for select to authenticated using (true);
create policy read on holidays for select to authenticated using (true);
create policy read on settings for select to authenticated using (true);
create policy read on network_nodes for select to authenticated using (true);
do $$
declare t text;
begin
  foreach t in array array['programs', 'categories', 'clusters', 'reason_codes', 'holidays', 'settings'] loop
    execute format('create policy write on %I for all to authenticated using (app.can(''can_edit_settings'')) with check (app.can(''can_edit_settings''))', t);
  end loop;
end $$;
create policy write on network_nodes for all to authenticated using (app.can('can_edit_network')) with check (app.can('can_edit_network'));
create policy write on roles for all to authenticated using (app.can('can_manage_users')) with check (app.can('can_manage_users'));

create policy read on contractors for select to authenticated using (app.scope() = 'all' or id = app.my_contractor());
create policy write on contractors for all to authenticated using (app.can('can_edit_settings')) with check (app.can('can_edit_settings'));

create policy read on profiles for select to authenticated using (user_id = auth.uid() or app.can('can_manage_users'));
create policy write on profiles for all to authenticated using (app.can('can_manage_users')) with check (app.can('can_manage_users'));

create policy read on crews for select to authenticated using (app.sees_crew(id));
create policy write on crews for all to authenticated using (app.can('can_create_pos')) with check (app.can('can_create_pos'));
create policy read on crew_pos for select to authenticated using (app.sees_crew(crew_id) and app.sees_po(po_id));
create policy write on crew_pos for all to authenticated using (app.can('can_create_pos')) with check (app.can('can_create_pos'));

create policy read on pos for select to authenticated using (app.sees_po(id));
create policy write on pos for all to authenticated using (app.can('can_create_pos')) with check (app.can('can_create_pos'));
create policy read on ptl_versions for select to authenticated using (app.sees_po(po_id));
create policy add on ptl_versions for insert to authenticated with check (app.can('can_create_pos'));
create policy read on po_milestones for select to authenticated using (app.sees_po(po_id));
create policy add on po_milestones for insert to authenticated with check (app.can('can_create_pos'));

create policy read on delay_events for select to authenticated using (app.sees_po(po_id));
create policy add on delay_events for insert to authenticated with check (app.can('can_submit_field') and app.sees_po(po_id));
create policy edit on delay_events for update to authenticated using (app.can('can_submit_field') and app.sees_po(po_id)) with check (app.sees_po(po_id));

create policy read on field_updates for select to authenticated using (app.sees_po(po_id));
-- Crews send for themselves; managers may send as one of their own crews (field.switchCrew).
create policy add on field_updates for insert to authenticated with check (
  app.can('can_submit_field') and app.sees_po(po_id) and app.sees_crew(crew_id)
  and (crew_id = app.my_crew() or app.can('can_switch_crew'))
);

create policy read on segments for select to authenticated using (app.sees_po(po_id));
create policy write on segments for all to authenticated
  using (app.can('can_edit_network') or app.can('can_create_pos')) with check (app.can('can_edit_network') or app.can('can_create_pos'));

create policy read on incidents for select to authenticated using (
  app.scope() = 'all' or (po_id is not null and app.sees_po(po_id)) or (app.scope() = 'contractor' and witnessing_msp = app.my_contractor())
);
create policy add on incidents for insert to authenticated with check (app.can('can_submit_field') and (po_id is null or app.sees_po(po_id)));
create policy edit on incidents for update to authenticated using (
  (app.can('can_edit_bom') or app.can('can_award_incidents'))
  and (app.scope() = 'all' or (po_id is not null and app.sees_po(po_id)) or (app.scope() = 'contractor' and witnessing_msp = app.my_contractor()))
);

create policy read on month_closes for select to authenticated using (app.scope() in ('all', 'contractor'));
create policy write on month_closes for all to authenticated using (app.can('can_run_close')) with check (app.can('can_run_close'));
create policy read on close_gaps for select to authenticated using (app.scope() in ('all', 'contractor') and app.sees_po(po_id));
create policy write on close_gaps for all to authenticated using (app.can('can_run_close')) with check (app.can('can_run_close'));
create policy read on close_waivers for select to authenticated using (app.scope() in ('all', 'contractor') and app.sees_po(po_id));
create policy write on close_waivers for all to authenticated using (app.can('can_run_close')) with check (app.can('can_run_close'));
-- Contractors see a notice only once it is issued.
create policy read on ld_notices for select to authenticated using (
  app.scope() = 'all' or (contractor_id = app.my_contractor() and sent_at is not null)
);
create policy issue on ld_notices for all to authenticated using (app.can('can_issue_notices')) with check (app.can('can_issue_notices'));
create policy acknowledge on ld_notices for update to authenticated
  using (app.can('can_acknowledge_notices') and contractor_id = app.my_contractor() and sent_at is not null)
  with check (contractor_id = app.my_contractor());

create policy read on audit_log for select to authenticated using (app.can('can_read_audit'));

-- ═════════════ Server functions (one transaction each, caller's RLS applies) ═════════════
-- New PO with its PTL v1, milestones, optional crew and drawn route.
create function create_po(po jsonb, ptl jsonb, milestones jsonb, crew_id text default null, segment jsonb default null)
returns void language plpgsql set search_path = public as $$
begin
  insert into pos select * from jsonb_populate_record(null::pos, po || jsonb_build_object('created_at', now()));
  insert into ptl_versions select * from jsonb_populate_record(null::ptl_versions, ptl);
  insert into po_milestones select * from jsonb_populate_recordset(null::po_milestones, milestones);
  if crew_id is not null then insert into crew_pos values (crew_id, po ->> 'id'); end if;
  if segment is not null then
    insert into segments (id, po_id, tier, corridor, origin, path)
    values (segment ->> 'id', segment ->> 'po_id', segment ->> 'tier', coalesce(segment ->> 'corridor', ''), 'drawn',
            st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', segment -> 'path')), 4326)::geography);
  end if;
end $$;

-- Settings page save: values, reason codes (removed = inactive) and holidays together.
create function save_settings(value jsonb, reasons jsonb, holiday_days date[])
returns void language plpgsql set search_path = public as $$
begin
  update settings set value = save_settings.value where id = 1;
  update reason_codes set active = false where code not in (select r ->> 'code' from jsonb_array_elements(reasons) r);
  insert into reason_codes (code, label, description, ld_eligible, sort, active)
    select r ->> 'code', r ->> 'label', r ->> 'description', (r ->> 'ld_eligible')::boolean, (ord - 1)::int, true
    from jsonb_array_elements(reasons) with ordinality as x(r, ord)
  on conflict (code) do update set label = excluded.label, description = excluded.description,
    ld_eligible = excluded.ld_eligible, sort = excluded.sort, active = true;
  delete from holidays where day <> all (holiday_days);
  insert into holidays select unnest(holiday_days) on conflict do nothing;
end $$;

-- Route import: replace assumed/imported routes (hand-drawn ones stay). source null = back to the assumed file.
create function replace_network(segs jsonb, nodes jsonb, source text, origin text)
returns void language plpgsql set search_path = public as $$
begin
  delete from segments where segments.origin in ('assumed', 'imported');
  insert into segments (id, po_id, tier, corridor, origin, path)
    select s ->> 'id', s ->> 'po_id', s ->> 'tier', coalesce(s ->> 'corridor', ''), replace_network.origin,
           st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', s -> 'path')), 4326)::geography
    from jsonb_array_elements(segs) s
  on conflict (id) do nothing;
  -- A route file without node points keeps the current nodes.
  if jsonb_array_length(nodes) > 0 then
    delete from network_nodes where network_nodes.origin in ('assumed', 'imported');
    insert into network_nodes (id, name, core, origin, lng, lat)
      select n ->> 'id', n ->> 'name', (n ->> 'core')::boolean, replace_network.origin, (n ->> 'lng')::float8, (n ->> 'lat')::float8
      from jsonb_array_elements(nodes) n
    on conflict (id) do nothing;
  end if;
  update settings set network_source = source where id = 1;
end $$;

-- QR signing page: anyone holding the link's token may read the summary and sign once. Nothing else is exposed.
create function ack_incident(incident_id text, token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'responsible_party', responsible_party, 'received_at', received_at,
    'fault_location', fault_location, 'affected_link', affected_link, 'description', description, 'bom', bom, 'undertaking', undertaking)
  from incidents where id = incident_id and ack_token = token
$$;
-- The signer has no account, so the signature image (a small PNG data URL) is kept inline, not in Storage.
create function sign_undertaking(incident_id text, token uuid, signer_name text, signer_position text, signature text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if length(signature) > 300000 then raise exception 'Signature image too large'; end if;
  update incidents set undertaking_signed = true, undertaking = jsonb_build_object(
    'name', signer_name, 'position', signer_position, 'signature', signature, 'at', now(), 'via', 'qr-link')
  where id = incident_id and ack_token = token and undertaking is null;
  return found;
end $$;
grant execute on function ack_incident(text, uuid), sign_undertaking(text, uuid, text, text, text) to anon, authenticated;
grant execute on function create_po(jsonb, jsonb, jsonb, text, jsonb), save_settings(jsonb, jsonb, date[]), replace_network(jsonb, jsonb, text, text) to authenticated;
revoke execute on function create_po(jsonb, jsonb, jsonb, text, jsonb), save_settings(jsonb, jsonb, date[]), replace_network(jsonb, jsonb, text, text) from anon, public;

-- Seed script only (service role): wipe all business data so the demo can be reloaded with fresh relative dates.
-- TRUNCATE skips row triggers, so this is the one path that removes signed PTL versions. Not callable from the app.
create function reset_demo_data() returns void language plpgsql security definer set search_path = public as $$
begin
  truncate contractors, programs, categories, clusters, reason_codes, holidays, settings, crews, profiles, pos, crew_pos,
    ptl_versions, po_milestones, delay_events, field_updates, segments, network_nodes, incidents,
    month_closes, close_gaps, close_waivers, ld_notices, audit_log restart identity cascade;
end $$;
revoke execute on function reset_demo_data() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function reset_demo_data() to service_role; end if;
end $$;

-- ═════════════ Realtime (map and inbox refresh) ═════════════
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table field_updates, delay_events, incidents, crews, pos, ld_notices;
  end if;
end $$;
