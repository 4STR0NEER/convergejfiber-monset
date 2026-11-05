# Clarifications and assumptions log

Living file. Updated at the end of every phase. Three parts:
1. **Open questions** for the client (Converge-J Fiber) that we still need answered.
2. **Decisions made** (answered by Monset, with date).
3. **Assumptions** we made about process and data, so nothing assumed gets mistaken for confirmed.

Last updated: 2026-11-05 (Phase 1)

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
| Q15 | Branding | Final logo and exact brand hex codes for Converge-J Fiber? | Orange / violet / violet-black palette with ember, magenta, plum in between. |

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
