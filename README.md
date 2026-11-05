# Converge-J Fiber · Backbone Command

A working prototype of a backbone fiber project tracker for **Converge-J Fiber** (Converge ICT franchise, Metro Cebu), built by **Monset**. It tracks every PO/WO against its signed Project Timeline (PTL), predicts slippage before the due date, computes liquidated damages (LD) live, runs the month-end LD close, and gives crews an offline field app.

**All data is assumed.** POs, contractors, crews, routes and costs are generated. Real data replaces it later without touching the UI (see below). Every open question and assumption is logged in [`CLARIFICATIONS.md`](CLARIFICATIONS.md).

---

## Run it

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: domain rules, LD math, seed, field submissions
npm run build      # type-check + production build (+ service worker)
npm run preview    # serve the production build
```

The seed is deterministic (fixed random seed) and its dates are relative to today, so the portfolio looks the same whichever day you demo it.

## Screens

| Route | What it does |
|---|---|
| `/` **Command Center** | 3D map of Metro Cebu (deck.gl over MapLibre): network coloured by status with dash patterns and glyphs, pulse along active work, crews at their last check-in, third-party damage, the NOC pin. Click a line (or use **Find a PO**) to fly there and open the PO panel. KPI strip, shared filters, 2D fallback. |
| `/portfolio` | Milestone progress vs plan, target vs actual PAT month over month, status by cluster and category, LD by program, contractor ranking, searchable PO register. Live reconciliation check. |
| `/po/:id` | PTL baseline vs actual Gantt (with rebaseline ghosts), field update feed with photo proof, LD day strip and formula, delay log, milestone and PTL history. |
| `/scorecards` | Contractors ranked worst first: on-time rate, their share of delay, late documentation, LD exposure, trend; delay days by reason. |
| `/month-end` | Guided Day 0 → Day 10 close: declarations, late docs, auto fallout list, pre-drafted gap analyses, LD recommendations with waivers, printable memo and claim notices, acknowledgment tracking. |
| `/incidents` | Third-party damage claims: report, signed undertaking (or QR for the responsible party to sign), BOM with temporary/permanent totals, award flag, printable claim packet. |
| `/field` | Crew app (installable PWA, works offline): my POs, proof-first progress updates, blockers with reason codes, damage reports. On desktop it shows inside a phone frame. |
| `/settings` | LD rate and cap, risk thresholds, milestone weights, reason codes, holidays, brand colours, **route data import**, with a live what-if before saving. |
| `/ack/:id` | Page the responsible party opens from the QR code to sign the Incident Acknowledgment and Undertaking. |

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
    repo.ts          Repository interface + LocalRepo (seed + IndexedDB)
    seed.ts          deterministic assumed data
    network.geo.json ALL route geometry (assumed), one feature per segment
    importRoutes.ts  KMZ / KML / GeoJSON -> Network
    outbox.ts        offline queue for the crew app
  screens/     one folder per screen (each is its own code-split chunk)
  ui/          shared components (status glyphs, panels, sheet, slide to confirm, ...)
  state.tsx    loads data once, shared filters, selection, theme, settings
  theme.css    design tokens (light + dark), brand variables, print styles
scripts/build-network.ts   regenerates the assumed network.geo.json
```

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

## Swapping in a real backend (Supabase + PostGIS)

The UI only talks to the `Repository` interface in `src/data/repo.ts`:

```ts
getSnapshot(), getNetwork(), getSettings(), saveSettings(),
submit(submission), saveIncident(incident), getClose(period), saveClose(close),
saveNetwork(network | null), getNetworkSource()
```

1. Write `SupabaseRepo implements Repository` and change the one line `export const repo: Repository = new LocalRepo()`. No screen changes.
2. `getSnapshot()` returns the same `Snapshot` shape (`src/domain/types.ts`) built from tables; the business rules keep running client-side on it.
3. `submit()` becomes an insert (field update, blocker, incident). Photos move from data URLs to Supabase Storage; store the object path in `photoIds`.
4. The crew outbox (`src/data/outbox.ts`) already queues and retries; only `flushOutbox` changes from the mock delay to the real call.
5. The QR signing page (`/ack/:id`) should take a short-lived signed token (Edge Function) so a third party can sign without an account.

Schema sketch:

```sql
create extension if not exists postgis;
create table contractors (id text primary key, name text not null);
create table programs   (id text primary key, name text, type text, unit text check (unit in ('PO','WO')));
create table clusters   (id text primary key, name text, center geography(point));
create table categories (id text primary key, name text, scope text);
create table pos (
  id text primary key, kind text, title text,
  program_id text references programs, cluster_id text references clusters,
  category_id text references categories, contractor_id text references contractors,
  cost_of_works numeric(14,2) not null, length_km numeric,
  progress jsonb not null default '{"ENG":0,"ROW":0,"CIVIL":0,"FOC":0}',
  milestone_actual jsonb default '{}', pat_date date, docs_submitted_at timestamptz
);
create table ptl_versions (po_id text references pos, version int, signed_at date, start date,
  target_pat date, milestones jsonb, note text, primary key (po_id, version));
create table delay_reasons (code text primary key, label text, description text, ld_eligible boolean);
create table delay_events (id text primary key, po_id text references pos, reason_code text references delay_reasons,
  milestone text, start date not null, "end" date, note text, reported_by text);
create table crews (id text primary key, lead text, contractor_id text references contractors);
create table field_updates (id text primary key, po_id text references pos, crew_id text references crews,
  milestone text, progress int check (progress between 0 and 100), photo_paths text[] not null,
  gps geography(point) not null, gps_source text, at timestamptz not null, note text);
create table segments (id text primary key, po_id text references pos, tier text, corridor text,
  path geography(linestring) not null);
create table hubs (id text primary key, name text, core boolean, location geography(point));
create table incidents (id text primary key, po_id text references pos, report jsonb not null,
  bom jsonb not null default '[]', permanent_restoration text, undertaking jsonb);
create table month_closes (period text primary key, state jsonb not null);
create table settings (id int primary key default 1, value jsonb not null);
```

Row-level security to plan for: MSP users see only their contractor's POs; crews insert updates only for POs they are assigned; PMO/Backbone roles see everything and run the close; settings editable by admins only (see Q14, Q30, Q35).

## Offline and PWA

`vite-plugin-pwa` precaches the app shell, so `/field` opens with no signal once visited (verified with the network cut). Submissions go to an IndexedDB outbox and are sent in order when online; the app has a **Simulate no signal** switch for demos. Map tiles are not cached; the crew app does not need the map.

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
