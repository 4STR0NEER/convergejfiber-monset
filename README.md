# Converge-J Fiber · Backbone Command

A working prototype of a backbone fiber project tracker for **Converge-J Fiber** (Converge ICT franchise, Metro Cebu), built by **Monset**. It tracks every PO/WO against its signed Project Timeline (PTL), predicts slippage before the due date, computes liquidated damages (LD) live, runs the month-end LD close, and gives crews an offline field app.

**All data is assumed.** POs, contractors, crews, routes and costs are generated. It runs in two modes: **demo mode** (everything in the browser, no backend, for the pitch) and **live mode** on Supabase (shared data, real accounts, row-level security). See [Backend (Supabase)](#backend-supabase). Every open question and assumption is logged in [`CLARIFICATIONS.md`](CLARIFICATIONS.md).

---

## Run it

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: domain rules, LD math, seed, field submissions, database RLS
npm run typecheck  # TypeScript only
npm run lint       # oxlint (ESLint cannot load TypeScript 7)
npm run build      # type-check + production build (+ service worker)
npm run preview    # serve the production build
```

With no `.env` the app runs in **demo mode**. The seed is deterministic (fixed random seed) and its dates are relative to today, so the portfolio looks the same whichever day you demo it.

## Screens

| Route | What it does |
|---|---|
| `/` **Command Center** | 3D map of Metro Cebu (deck.gl over MapLibre): network coloured by status with dash patterns and glyphs, pulse along active work, crews at their last check-in, third-party damage, the NOC pin. Click a line (or use **Find a PO**) to fly there and open the PO panel. KPI strip, shared filters, 2D fallback. |
| `/portfolio` | Milestone progress vs plan, target vs actual PAT month over month, status by cluster and category, LD by program, contractor ranking, searchable PO register. Live reconciliation check. |
| `/po/new` | **Add a PO / WO** (admin): program, cluster, category, contractor, cost of works, PTL dates with an editable milestone split, route drawn by clicking on a map (length measured from it), optional crew. |
| `/po/:id` | PTL baseline vs actual Gantt (with rebaseline ghosts), field update feed with photo proof, LD day strip and formula, delay log, milestone and PTL history. |
| `/scorecards` | Contractors ranked worst first: on-time rate, their share of delay, late documentation, LD exposure, trend; delay days by reason. |
| `/month-end` | Guided Day 0 → Day 10 close: declarations, late docs, auto fallout list, pre-drafted gap analyses, LD recommendations with waivers, printable memo and claim notices, acknowledgment tracking. |
| `/incidents` | Third-party damage claims: report, signed undertaking (or QR for the responsible party to sign), BOM with temporary/permanent totals, award flag, printable claim packet. |
| `/field` | Crew app (installable PWA, works offline): my POs, proof-first progress updates, blockers with reason codes, damage reports. On desktop it shows inside a phone frame. |
| `/settings` | LD rate and cap, risk thresholds, milestone weights, reason codes, holidays, brand colours, **route data import**, **network nodes** (add by clicking the map, rename, remove), with a live what-if before saving. |
| `/ack/:id` | Page the responsible party opens from the QR code to sign the Incident Acknowledgment and Undertaking (no account needed). |

## Business rules

All rules live in `src/domain/` as plain TypeScript with no React or I/O, and are unit tested (`*.test.ts`).

- **Status** (`status.ts`): Completed (PAT done) > Delayed (past target) > At Risk (target within 30 days) > **Trending Late** (target 31+ days away, but % of timeline elapsed minus weighted % complete is above 20 points) > On Track. Ongoing / Not Started is a separate flag. Every status comes with plain-language reasons.
- **Weighted progress**: Engineering 15, ROW 25, Civil 35, FOC 25 (configurable).
- **LD** (`ld.ts`): 0.5% of cost of works per started calendar week of delay, capped at 50%. Excused (non-LD) blockers extend the target day for day (overlaps counted once); every day past that extended target until PAT is contractor attributable. The clock stops at PAT.
- **Month-end** (`monthEnd.ts`): Day N = Nth calendar day after month end, skipping listed holidays. Fallout = missed the live PTL target and still open at month end, or accepted late in the month. Docs are late after Day 1 23:59 Manila time.
- **Metrics** (`metrics.ts`): LD exposure, scorecards, month-over-month series, and the **reconciliation** that re-adds counts, cost of works and LD exposure across every breakdown.
- **Field** (`field.ts`): proof-first validation, distance from GPS fix to the PO route, and how each synced submission changes the portfolio.

## Project layout

```
src/
  domain/      business rules + tests (framework free)
  data/
    repo.ts          Repository interface + LocalRepo (demo: seed + IndexedDB); picks the backend
    supabaseRepo.ts  Repository on Supabase (live mode)
    rows.ts          domain objects <-> database rows (shared by repo, seed script, tests)
    network.ts       route helpers shared by both repos and the seed script
    auth.ts          sign-in: demo accounts or Supabase Auth
    supabase.ts      the mode flag (VITE_DEMO_MODE / Supabase env)
    seed.ts          deterministic assumed data
    network.geo.json ALL route geometry (assumed), one feature per segment
    importRoutes.ts  KMZ / KML / GeoJSON -> Network
    outbox.ts        offline queue for the crew app
  screens/     one folder per screen (each is its own code-split chunk)
  ui/          shared components (status glyphs, panels, sheet, slide to confirm, ...)
  state.tsx    loads data once, shared filters, selection, theme, settings
  theme.css    design tokens (light + dark), brand variables, print styles
scripts/build-network.ts   regenerates the assumed network.geo.json
scripts/seed-supabase.ts   loads the demo portfolio and demo accounts into Supabase
supabase/
  migrations/              schema, roles, RLS, audit log, storage buckets
  functions/invite-user/   Edge Function: admin invites a user
  rls.test.ts              runs the migrations in PGlite and proves each role's access
docs/user-guide.md         how to use the screens (new screens from Phase 7 on)
```

## Adding POs and nodes by hand

Admins can add work without a file: **Portfolio → New PO** creates a PO / WO with PTL version 1 (signed today), milestones split the standard way (Engineering 0-20%, ROW 10-45%, Civil 35-80%, FOC 60-100% of the PTL, all editable), 0% progress, an optional drawn route and an optional crew. It appears at once on the map, in every total and in that crew's Field App. **Settings → Network nodes** adds a core node / NOC or hub by clicking its location. Drawn routes and node edits are stored as edits on top of whichever route file is loaded, so importing real routes later keeps them. Rules: `src/domain/po.ts` (tested).

## Swapping in real route data

**Without code (demo or pilot):** Settings → **Route data** → choose a `.kmz`, `.kml` or `.geojson`. The app shows how many lines matched a PO, how many lines had no PO number and how many POs have no route, then **Use these routes**. Crews and incidents are re-placed on the new lines. **Restore assumed routes** undoes it. The file is kept in the browser only.

Matching rule (until we see the client's files, see Q16 in `CLARIFICATIONS.md`): each LineString needs a PO/WO number in ExtendedData `PO`, `PO_NO` or `WO`, or a 10-digit / `WO-XX-YY-NNNN` number in the Placemark name. Names containing "main", "backbone" or "ring" are drawn as mainline.

**Permanently:** replace `src/data/network.geo.json` with a GeoJSON FeatureCollection of the same shape and delete `scripts/build-network.ts`:

```jsonc
// one per route segment
{ "type": "Feature", "geometry": { "type": "LineString", "coordinates": [[123.92, 10.32], ...] },
  "properties": { "kind": "segment", "segmentId": "SEG-001", "poId": "4500195385", "tier": "mainline", "corridor": "Mandaue to Banilad" } }
// one per node; core = the NOC
{ "type": "Feature", "geometry": { "type": "Point", "coordinates": [123.9223, 10.3236] },
  "properties": { "kind": "node", "id": "NOC-MDE", "name": "Mandaue Core / NOC", "core": true } }
```

A KMZ converts with GDAL: `ogr2ogr -f GeoJSON routes.geojson routes.kmz`, then add the properties above. With a backend, routes come from PostGIS instead (next section).

## Backend (Supabase)

The UI only talks to the `Repository` interface in `src/data/repo.ts`. `LocalRepo` is demo mode; `SupabaseRepo` is live mode. One flag in `src/data/supabase.ts` decides which runs: live mode when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, unless `VITE_DEMO_MODE=true`. The demo build never downloads supabase-js.

### Set up a project

1. Create a Supabase project (region: Singapore is closest to Cebu).
2. In **Authentication > Sign In / Providers**, turn **off** "Allow new users to sign up". Accounts come only from admin invitations.
3. Apply the schema with the CLI (`npx supabase init` once, it keeps `supabase/migrations`; then `npx supabase link --project-ref <ref>`, `npx supabase db push`, `npx supabase functions deploy invite-user`), or paste the files in `supabase/migrations/` into the SQL editor in name order (the Edge Function still needs the CLI).
4. `cp .env.example .env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API). `.env` is git-ignored; the service role key must never go in a `VITE_` variable.
5. `npm run seed:supabase` loads the demo portfolio (dates relative to today) and the demo accounts (password `demo1234`). Re-run it to refresh the dates; it wipes all business data first.
6. `npm run dev`. For a seeded staging demo, `VITE_SHOW_DEMO_ACCOUNTS=true` lists the demo accounts on the sign-in screen. Never set it in production.

### What is in the database

`supabase/migrations/20261117000001_core.sql`:

- **Reference data and settings:** `contractors`, `programs`, `categories`, `clusters`, `reason_codes` (removed ones become inactive, old blockers keep their code), `holidays`, `settings` (LD rate, cap, weights, thresholds, brand, network source).
- **Work:** `pos`, `ptl_versions` (a trigger refuses any update or delete: a PTL change is always a new version), `po_milestones` (progress and actual dates), `crews`, `crew_pos`.
- **Field:** `field_updates` (insert only; a trigger moves the milestone and the crew's last check-in, the same rule as `applySubmission`), `delay_events`, `incidents` (with a secret `ack_token` for the QR signing link).
- **Routes (PostGIS):** `segments` (`geography(linestring)`, read through the `segments_api` view as GeoJSON coordinates), `network_nodes`; points are `geography(point)` columns generated from lng/lat.
- **Month-end close:** `month_closes`, `close_gaps`, `close_waivers`, `ld_notices`, split per PO / contractor so RLS can show a contractor only their own rows.
- **People:** `roles` (roles as data, see Sign-in and roles), `profiles` (user, role, contractor, crew).
- **`audit_log`:** a trigger on every business table writes who, when, entity, field, before, after and reason (settings changes included). Readable by roles with `can_read_audit`; nobody can write to it directly.
- **Server functions** (one transaction each, the caller's RLS applies): `create_po`, `save_settings`, `replace_network`; `ack_incident` and `sign_undertaking` for the QR page (anyone holding the link's token); `reset_demo_data` (service role only, used by the seed script).

`20261117000002_storage.sql`: private buckets `field-photos`, `signatures`, `moa-scans`. Object names start with the PO id (`<poId>/<file>`), so who can see a photo follows who can see the PO. The app shows them through one-hour signed URLs.

The database time zone is `Asia/Manila`, so timestamps come back as `+08:00`: the business rules compare timestamp strings.

### Realtime

Field updates, blockers, incidents, crews, POs and LD notices are in the `supabase_realtime` publication. A signed-in app refreshes its data at most every 2 seconds after a change it is allowed to see.

### Proving the security rules

`supabase/rls.test.ts` (part of `npm test`) starts an in-process Postgres with PostGIS ([PGlite](https://pglite.dev)), stands in for Supabase's `auth` and `storage` schemas, runs the real migrations, loads the seed, then signs in as admin, two contractor managers and a crew lead. It checks that each sees exactly what `scopeSnapshot()` gives them, that a contractor cannot read another contractor's rows, that crews can only report on their own POs, that signed PTLs cannot change, that notices stay hidden until issued, that the audit log records changes, that photos in Storage follow PO visibility, and that the whole seed reads back unchanged through the row mapping.

## Sign-in and roles

**Demo mode** signs in with demo accounts (password `demo1234`) listed on the sign-in screen, checked in the browser: it shows how roles behave but is not security. **Live mode** uses Supabase Auth with email and password. Google and Microsoft sign-in for Converge staff is wired but off (`VITE_SSO_PROVIDERS`, Q40); turning it on also needs the provider set up in Supabase. There is no public sign-up: the admin invites people from **Settings > People and access** (Edge Function `invite-user`), and the invitation link signs them in and asks them to choose a password.

| Role | Who | Sees | Can do |
|---|---|---|---|
| Admin | Converge-J Fiber Backbone Build / PMO (`admin@convergej.demo`) | Everything | Everything: add POs and network nodes, settings and route files, run the month-end close, waive, issue notices, decide incident awards, invite users, read the audit log |
| Contractor manager | One per MSP (`pm.mcc@convergej.demo`, ...) | Only their contractor's POs, routes, crews, incidents, scorecard and LD; LD notices once issued | Edit the BOM on their incidents, acknowledge or dispute their LD notice, send field updates as one of their crews. No Settings; the LD recommendation memo is internal. |
| Ground team | Linemen / crew leads (`jun.cabahug@convergej.demo`, ...) | Field App only, their own crew | Progress updates, blockers, damage reports |

**Roles are data.** The `roles` table has one row per role, a `scope` (`all`, `contractor`, `crew`) and one boolean per permission: `can_edit_settings`, `can_run_close`, `can_issue_notices`, `can_acknowledge_notices`, `can_edit_bom`, `can_award_incidents`, `can_submit_field`, `can_switch_crew`, `can_create_pos`, `can_edit_network`, `can_manage_users`, `can_read_audit`, `can_approve_change_requests`. Splitting Admin into PMO, Backbone PM, leadership and system admin (Q37) means adding rows, not code. The app reads the signed-in user's flags; `DEFAULT_ROLES` in `src/domain/access.ts` mirrors the seeded rows for demo mode, and a test keeps them equal.

The rules exist twice on purpose: `src/domain/access.ts` (`can`, `canVisit`, `scopeSnapshot`) shapes the UI, and the RLS policies enforce them on the server. The RLS test compares the two.

## Offline and PWA

`vite-plugin-pwa` precaches the app shell, so `/field` opens with no signal once visited (verified with the network cut). Submissions go to an IndexedDB outbox and are sent in order when online; the app has a **Simulate no signal** switch for demos. In live mode, sending uploads the photos to Storage with the record; a retry after a lost reply is ignored by the server, never applied twice. Each queued item remembers who queued it: unsent items survive sign-out and are sent the next time that same person signs in on the phone (Q39, shared phones). Map tiles are not cached; the crew app does not need the map.

## Accessibility and motion

- Status is never colour alone: every status has a glyph, a label and (on the map) a dash pattern. Status and chart palettes were run through a colour-vision validator in both themes.
- Keyboard: skip link, visible focus, keyboard path into the map (Find a PO), slide-to-confirm accepts Enter, sheets trap focus and close on Escape. Every chart has a table view.
- `prefers-reduced-motion` turns off the map intro, orbit and pulse, and makes springs instant. The 2D toggle is the low-power mode.
- Motion budget: one hero moment (the map intro, once per session); everything else is short UI feedback.

## Performance

Each screen is its own chunk. The entry bundle is about 130 KB gzipped; the map stack (deck.gl + MapLibre, about 490 KB gzipped) loads after the Command Center's KPI strip has painted; Recharts loads only on chart screens. The frame loop only runs in 3D with motion on, and pauses with the tab.

## Credits

| Used for | Library / source | Licence |
|---|---|---|
| Map rendering | deck.gl, MapLibre GL JS, react-map-gl | MIT, BSD-3, MIT |
| Basemap | OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors (attribution shown on the map) | ODbL / CC-BY |
| Charts | Recharts | MIT |
| Motion | Motion, anime.js | MIT |
| Schedule health dial | Kokonut UI "Liquid Gauge" by @dorianbaffier, adapted | MIT |
| Theme switch reveal | Skiper UI "skiper26" (skiper-ui.com), idea adapted; free component, attribution required | Skiper UI free licence |
| Bottom sheet mechanics, local QR approach | VengeanceUI "ShareSheet" (github.com/Ashutoshx7/VengeanceUI), adapted | MIT |
| QR codes | qrcode-generator by Kazuhiko Arase | MIT |
| Offline storage | idb-keyval | Apache-2.0 |
| KMZ unzip | JSZip | MIT |
| Icons | Lucide | ISC |
| Type | Archivo, JetBrains Mono (Fontsource) | OFL |
| Slide to confirm, check draw | Monset motionbook patterns B12, D1 | internal |

Contractor names, crew names and incident parties are fictional.
