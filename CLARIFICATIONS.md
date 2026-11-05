# Clarifications and assumptions log

Living file. Updated at the end of every phase. Three parts:
1. **Open questions** for the client (Converge-J Fiber) that we still need answered.
2. **Decisions made** (answered by Monset, with date).
3. **Assumptions** we made about process and data, so nothing assumed gets mistaken for confirmed.

Last updated: 2026-11-05 (Phase 4)

---

## 1. Open questions for the client

| # | Topic | Question | What we assumed meanwhile |
|---|---|---|---|
| Q1 | Delay codes | What do **RTA** and **ALO** stand for? | Stored as labels with "meaning to be confirmed"; both treated as contractor attributable (subject to LD), as the brief lists them. |
| Q2 | LD clock | Is LD counted from the **target PAT date** or from the **date the PO was flagged** in the fallout list? | From the day after the (extended) target PAT date. |
| Q3 | LD basis | Is "cost of works" VAT inclusive or exclusive? Does it change with variation orders? | Single fixed amount per PO, VAT treatment not modelled. |
| Q4 | Concurrent delay | If a contractor-attributable delay and an excused delay overlap on the same days, who carries those days? | Excused wins: overlapping days extend the target and carry no LD. |
| Q5 | Untagged lateness | If a PO is late and no reason was tagged, is it automatically contractor attributable? | Yes. Any late day not covered by an excused reason counts toward LD. |
| Q6 | Rebaselining | Who can approve a revised PTL, and does a revision reset LD already accrued? | The latest signed PTL version is the baseline for status and LD; older versions are kept as history only. |
| Q7 | Fallout list | Does PMO's fallout list include POs that were already late in earlier months (carry-overs), or only new misses for the month? | Both, flagged "new this month" vs "carried over". POs accepted late within the month are included too. |
| Q8 | LD exposure | When does LD stop being "exposure" and become "claimed"? | Exposure = LD on open POs plus POs accepted in a month whose Day 10 (notice deadline) has not passed. |
| Q9 | Holidays | Which holidays should skip a month-end day? | PH regular holidays only (New Year, Maundy Thursday, Good Friday, Araw ng Kagitingan, Labor Day, Independence Day, National Heroes Day, All Saints' Day, Bonifacio Day, Christmas, Rizal Day). Editable in Settings. Cebu local holidays not included. |
| Q10 | Docs lateness | Is the documentation deadline Day 1 midnight for all POs, including WOs? | Yes, Day 1 23:59:59 Manila time for every PO/WO accepted that month. |
| Q11 | Milestone weights | Are weights the same for every category (e.g. UG Verification has almost no civil works)? | One weight set for all (Eng 15, ROW 25, Civil 35, FOC 25), editable globally. |
| Q12 | Status windows | Are "31+ days" and "within 30 days" calendar days counted from today inclusive? | Exactly 30 days to target = At Risk; 31 = On Track; target day itself = At Risk; day after = Delayed. |
| Q13 | Data sources | What format do PO lists, PTLs and route maps come in today (Excel, SAP export, KMZ)? | Not yet known; repository interface ready for an import. |
| Q14 | Users | Who logs in: Backbone PMs, PMO, contractors, crew leads? Does each MSP see only its own POs? | Single demo user sees everything. |
| Q15 | Branding | Final logo and exact brand hex codes for Converge-J Fiber? | Orange / violet / violet-black palette with ember, magenta, plum in between. Placeholder "J fiber strand" mark. |
| Q16 | Route files | In the client's KMZ/KML, where is the PO/WO number stored (Placemark name, ExtendedData field, folder name)? | Import stub reads ExtendedData `PO` / `PO_NO` / `WO`, else a 10-digit or WO-number pattern in the name. |
| Q17 | Segments | Can one PO cover several disconnected route pieces, or can one route piece be shared by two POs? | Each drawn segment belongs to exactly one PO, one segment per PO in the seed. Multiple segments per PO already supported. |
| Q18 | Network nodes | Real location of the core node / NOC and the hub sites? | Mandaue NOC placeholder at 10.3236, 123.9223 plus hubs at city centres. |
| Q19 | Crew location | Do crews report position only with field updates, or is there a check-in app / vehicle GPS? How often? | Crew pin = location of their latest field update. Map says "last check-in X ago", never implies live GPS. |
| Q21 | Target vs actual | Manila's month-over-month chart: is "target" the POs whose PTL target PAT falls in the month, and "actual" the PATs accepted in that month (regardless of when they were due)? | Yes to both. We also split actual into on time vs late. |
| Q22 | Milestone progress | Is portfolio milestone progress a simple average per PO, or weighted by cost or route length? | Simple average per PO; completed POs count as 100%. Plan line is the average PTL-planned % for today. |
| Q23 | Health score | Does the client want a single 0-100 schedule health number, and is our formula acceptable? | 100 minus points behind plan, minus contractor-attributable late days (max 50). |
| Q24 | Crew phones | Do crews have company phones (Android / iPhone), mobile data, and can we require camera + location permission? | Any modern phone browser; installable as an app (PWA). Works offline, syncs when there is signal. |
| Q25 | Who submits | Only crew leads, or any lineman? Does a Backbone PM approve progress before it counts? | Crew lead submits; progress counts as soon as it syncs. No approval step yet. |
| Q26 | GPS rule | Should a GPS fix far from the PO route block the update, or only flag it? What distance? | Flag only, above 500 m. With no device GPS, the crew can place it on the route; that is flagged too. |
| Q27 | Undertaking text | Exact legal wording of the Incident Acknowledgment and Undertaking, and is an e-signature on a phone acceptable? | Placeholder wording, clearly marked. Finger signature on the crew's phone or on the party's own phone via QR. |
| Q28 | BOM rates | Is there a standard rate card for restoration items, and who prepares/approves the BOM (MSP, PM, PMO)? | Office fills the BOM from a preset list with editable unit costs. |
| Q29 | Blockers | Who closes a blocker: the crew, or the Backbone PM? Can a blocker be back-dated? | Crew taps "Cleared today". Start date can be back-dated, not future-dated. |
| Q20 | Map provider | Is a free OpenStreetMap basemap acceptable for production, or does Converge have a licensed basemap / GIS server? | OpenFreeMap (no API key), with attribution shown. |

## 2. Decisions made

| Date | Decision |
|---|---|
| 2026-11-05 | Excused (non-LD) delays **extend the target date day for day** (extension of time). Status and LD both use the extended target. |
| 2026-11-05 | Keep **PTL version history**; latest signed version is the live baseline. |
| 2026-11-05 | Month-end Day 1..10 are **calendar days**, skipping **major holidays** only. |
| 2026-11-05 | SUNRISE gets **30 WOs** on top of ~150 POs. WOs carry LD the same way as POs. |
| 2026-11-05 | Documentation is late if submitted after **Day 1 midnight**. |
| 2026-11-05 | Seed dates are **relative to today**, with a fixed random seed, so the demo looks the same any day. |
| 2026-11-05 | Branding: **Converge-J Fiber**, orange + violet + black. |
| 2026-11-05 | Own GitHub repo, pushed after each phase. |
| 2026-11-05 | Command Center defaults to the **dark** theme; light theme via toggle (remembered per browser). |
| 2026-11-05 | "Wedge" and "fluid" motion goes on the **main nav tabs**. Motion Studio not installed. |

## 3. Assumptions

### Business rules (Phase 1, all in `src/domain`, all unit tested)

- **Status priority:** Completed > Delayed > At Risk > Trending Late > On Track. Ongoing / Not Started is a separate flag, so both partitions add up to the total.
- **Completed** = PAT date on or before today.
- **Not Started** = start date in the future, or no progress and no milestone start yet.
- **Weighted progress** = sum(milestone % x weight) / sum(weights).
- **% timeline elapsed** = days since PTL start / days from PTL start to the extended target, capped at 100.
- **Trending Late** = Manila would say On Track, but elapsed % minus progress % is more than 20 points.
- **Schedule health (0-100)** = 100 - points behind schedule - contractor-attributable late days (max 50 off for lateness).
- **LD** = 0.5% x cost of works x started weeks late (`ceil(days / 7)`), capped at 50%. Clock stops at PAT.
- **Excused days** are the union of all non-LD blocker periods between PTL start and the stop date (overlaps counted once). An open blocker runs until today.
- **Unknown reason code** (e.g. deleted from Settings) counts as contractor attributable.
- **Month-end Day 0** = last day of the month. Day N = Nth non-holiday calendar day after it.
- **Fallout** = POs whose live target PAT is on or before month end and were either still open at month end, or accepted that month after the target.
- **On-time rate** (scorecards) = completed POs with zero contractor-attributable late days / completed POs.
- **Attributable share** = contractor late days / (contractor late days + excused days).
- **Peso totals** are summed in centavos so breakdowns reconcile exactly.

### Seed data (Phase 1, `src/data/seed.ts`)

All data is invented. Nothing comes from Converge or any real contractor.

- **Portfolio:** 150 POs (BANGIS 60, NEW BUILD 58, VELOCITY 32) + 30 SUNRISE WOs = 180 items, about ₱579M cost of works.
- **Programs to categories:** BANGIS = O&M categories; NEW BUILD = Aerial/UG New Build; VELOCITY = mostly New Build + some Aerial O&M; SUNRISE = O&M.
- **Cost ranges (PHP per km):** Aerial New Build 380k-650k; UG New Build 1.6M-3.2M; Aerial O&M 120k-260k; UG O&M 450k-900k; Handhole Raising 400k-900k; Bridge Attachment 1.2M-2.2M; UG Verification 30k-55k. WOs are about 45% of a PO of the same type. **Needs client validation.**
- **Durations:** 20-210 days depending on category.
- **Milestone windows (share of the timeline):** Engineering 0-20%, ROW 10-45%, Civil 35-80%, FOC 60-100%. They overlap, as on real jobs.
- **Contractors:** 8 fictional MSPs (Bagwis Linecraft, Tanaw Fiberworks, Lantaw Engineering & Construction, Sugbo Linya Builders, Mabuhay Cableways, Habagat Telecom Contractors, Dagat Netlink Services, Kidlat Infra Solutions), each with a hidden quality score so scorecards differ believably.
- **Situations:** each PO is assigned a situation (done, delayed, at risk, trending late, on track, new); weaker contractors are more likely to be late. About 30% of jobs get an excused blocker (DPWH, LGU one pole, OSI, JPA, OLT most common), and slow jobs get a contractor-attributable reason tag (Manpower, Local Permitting, RTA, ALO).
- **About 12% of POs** have a rebaselined PTL (version 2).
- **Current mix (as of any day):** about 80 Completed (28 of them late), 43 On Track, 11 Trending Late, 25 At Risk, 21 Delayed; 87 Ongoing, 13 Not Started.
- **30 crews** with fictional Cebuano lead names, 1-3 open POs each, 2-5 field updates per open PO within the last ~4 weeks.
- **5 third-party damage incidents** with generic responsible parties (no real company names), BOMs with temporary and permanent lines.
- **Cluster centers** are approximate city/district centroids, not surveyed points.

### Hero map (Phase 2)

- **All route geometry is invented** (`src/data/network.geo.json`, generated by `scripts/build-network.ts`). Five mainline corridors roughly follow: A.S. Fortuna / Banilad / Lahug / Capitol (ring north), M.J. Cuenco coastal (ring south), Mandaue to Consolacion to Liloan, Marcelo Fernan Bridge to Lapu-Lapu and Maribago, and Cebu South Road to Talisay and Minglanilla. Waypoints are approximate, not surveyed.
- Mainline is cut into ~1.6 km segments, each assigned to a New Build PO in the nearest cluster. Every other PO gets a **barangay lateral**: a few laterals per cluster grow inland from the mainline, and consecutive pieces belong to consecutive POs. Laterals are kept inside rough land boxes (Mactan laterals stay south of the airport).
- One drawn segment per PO in the seed.
- **Crew pins** sit at the "work front" of their PO's route (position along the line = weighted progress). **Incident markers** sit 55% along the affected PO's route.
- Hubs: Mandaue NOC (placeholder), Cebu City, Lapu-Lapu, Talisay, Minglanilla, Consolacion, Liloan.
- **Basemap:** OpenFreeMap "dark" and "positron" styles, with our own 3D building extrusions from OpenStreetMap heights (visible from zoom 13, i.e. once you drill in). Basemap labels are dimmed so the network leads.
- **"Last field update X ago"** = newest submitted field update, not live tracking.
- **KPI counts** follow the program / cluster / contractor / category filters; status and activity tiles act as toggles and don't zero themselves out.
- **Map encoding:** colour + dash pattern + glyph. Completed = thin, faded solid; On Track = solid; Trending Late = long dash; At Risk = short dash; Delayed = dotted. Mainline is thicker with a glow; sub lines thinner.
- **Motion:** one intro moment (camera pulls back from the NOC while the network draws outward, anime.js), a pulse travelling along ongoing segments, slow idle orbit that stops on any interaction and resumes after 40 s idle. All of it is off under reduced motion and in 2D mode.
- **Health score dial** in the side panel uses Kokonut UI's Liquid Gauge (MIT), adapted to read-only.

### Portfolio and PO Detail (Phase 3)

- **Every view follows the shared filters**, including status. The reconciliation chip re-checks 15 totals for whatever is filtered.
- **On-time rate** = completed POs with zero contractor-attributable late days / completed POs. **Their share of delay** = contractor-attributable late days / (attributable + excused days).
- **PO register LD column** shows the PO's computed LD whether still accruing or final (accepted late). The "LD exposure" totals only count what is still open or not yet claimed (see Q8).
- **Route length** shown on PO Detail is the seed's planned length, not measured from the drawn (assumed) geometry.
- **Status colours (light theme) were re-stepped** after running the dataviz palette validator: At Risk and Delayed were too close for colour-blind and normal vision. Adjacent pairs now pass in both themes; non-adjacent red/green pairs still rely on the glyph and dash pattern, by design.
- **Chart series:** "Due" is a deliberately muted reference; accepted on time = violet, accepted late = orange (validated for colour-vision separation and contrast in both themes). Every chart has a "View as table".
- **Map intro and KPI count-up play once per browser session.** Coming back to the Command Center (or arriving via "Show on map") goes straight to the map.
- **Theme switch** reveals the new theme as a circle from the toggle (adapted from Skiper UI skiper26, free component; attribution required, will go in the README credits).

### Field App and Incidents (Phase 4)

- **The "server" is mocked.** The outbox (IndexedDB on the phone) sends items in order after a ~1 s delay into the local repository, which replays them over the seed on every load. Nothing leaves the browser. With Supabase this becomes a real upload.
- Consequence for the demo: **the QR signing page only works in the same browser** (e.g. open it from the incident screen). On a real backend the responsible party's own phone would sign.
- **Photos** are compressed to ~1280 px JPEG on the phone and stored in the outbox as data. "Add a sample photo (demo)" and "Use route point (demo)" exist so the flow works on a laptop with no camera or GPS; both are visible in the data (sample photo / `gpsSource: route-demo`).
- **Progress updates take effect when synced**: milestone %, actual start date (first update above 0%) and actual end date (first update at 100%).
- **Blockers are tagged at the source** with a reason code; the form says immediately whether it is subject to LD. An excused blocker moves the target from its start date until it is cleared.
- **Incidents filed from the phone** are pre-filled from the crew (witnessing MSP, attending personnel), the PO and its route (affected link, fault location), with GPS and time. BOM is left empty for the office; permanent restoration defaults to "still for award".
- **Seed incidents** marked "undertaking signed" are treated as signed on paper.
- **Demo switches** in the crew app: switch crew, and "Simulate no signal". The real network state is also respected.
- **Installable app (PWA)**: opens at `/field`, the app shell is cached so it starts with no signal (verified in a browser with the network cut).
- Motion: slide to confirm on every field submit (no accidental sends with gloves or in a pocket), a drawn check on success, spring bottom sheets.
