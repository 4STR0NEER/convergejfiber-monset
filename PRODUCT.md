# Converge-J Fiber · Backbone Command

## What it is
Project tracking platform for backbone fiber build and O&M work run by Converge-J Fiber, a Converge ICT franchise in Metro Cebu. Built by Monset as a pitch prototype; it must clearly outclass the internal "Backbone Dashboard" run by the parent company in Manila.

## Who uses it
- **Backbone PMs and PMO** (office laptops, mid-range): portfolio status, month-end LD close, contractor performance.
- **Backbone Build leadership**: LD exposure in pesos, which contractors to penalize, where the network is at risk.
- **Crew leads and linemen** (phones, outdoors, patchy signal): field updates with photo proof, blockers, incidents.

## Usage scene
Ops-room screen and office laptops during weekly reviews and the month-end close; phones in the field under sun. Dark is the default for the Command Center (glowing network on a dark city); light theme must be equally complete.

## Product truths
- Work is tracked per PO/WO against a signed PTL with four milestones: Engineering, ROW, Civil Works, FOC Works.
- Status: Completed, On Track, Trending Late (ours, predictive), At Risk, Delayed; plus Ongoing / Not Started.
- Liquidated damages: 0.5% of cost of works per started week of contractor-attributable delay, capped at 50%.
- Every number must reconcile across views. Manila's doesn't; ours shows the check.
- "Live" is honest: show time since last field update, never imply real-time GPS.

## Tone
Premium operations instrument. Confident, precise, calm under pressure. Brand lives in the orange → magenta → violet energy of the network itself, not in decoration.

## Brand
Converge-J Fiber: orange, violet, black, with ember, magenta and plum in between. Franchise branding is configurable via CSS variables.

## Constraints
- Keyboard navigable, readable contrast, never color alone (dash patterns + icons + labels).
- Smooth on a mid-range office laptop; 2D fallback; respects prefers-reduced-motion.
- All data is assumed until the client supplies real POs, PTLs and KMZ routes.
