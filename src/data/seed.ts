// Deterministic assumed data. Same seed -> same portfolio. Dates are offsets from `asOf`,
// so the status mix looks the same whichever day the demo runs.
import { addDays, diffDays, type ISODate } from '../domain/dates'
import {
  MILESTONES,
  type Category, type Cluster, type Contractor, type Crew, type DelayEvent, type FieldUpdate,
  type Incident, type MilestoneKey, type PO, type Program, type PtlVersion, type Snapshot,
} from '../domain/types'

export const SEED = 0x5eb0_2026

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const PROGRAMS: Program[] = [
  { id: 'BANGIS', name: 'BANGIS', type: 'Operations', unit: 'PO' },
  { id: 'NEWBUILD', name: 'NEW BUILD', type: 'Build', unit: 'PO' },
  { id: 'VELOCITY', name: 'VELOCITY', type: 'Augmentation, Build', unit: 'PO' },
  { id: 'SUNRISE', name: 'SUNRISE', type: 'Capacity, Operations', unit: 'WO' },
]

export const CLUSTERS: Cluster[] = [
  { id: 'CEB-N', name: 'Cebu City North', center: [123.899, 10.335] },
  { id: 'CEB-S', name: 'Cebu City South', center: [123.881, 10.295] },
  { id: 'MDE', name: 'Mandaue', center: [123.935, 10.333] },
  { id: 'LLC', name: 'Lapu-Lapu / Mactan', center: [123.97, 10.31] },
  { id: 'TAL', name: 'Talisay / Minglanilla', center: [123.825, 10.245] },
  { id: 'CNL', name: 'Consolacion / Liloan', center: [123.975, 10.388] },
]

const BARANGAYS: Record<string, string[]> = {
  'CEB-N': ['Banilad', 'Talamban', 'Lahug', 'Apas', 'Busay', 'Kasambagan', 'Mabolo', 'Guadalupe'],
  'CEB-S': ['Pardo', 'Basak San Nicolas', 'Mambaling', 'Punta Princesa', 'Labangon', 'Inayawan', 'Quiot', 'Bulacao'],
  MDE: ['Cabancalan', 'Bakilid', 'Maguikay', 'Centro', 'Tabok', 'Casuntingan', 'Looc', 'Alang-alang'],
  LLC: ['Pusok', 'Basak', 'Marigondon', 'Agus', 'Maribago', 'Mactan', 'Gun-ob', 'Babag'],
  TAL: ['Tabunok', 'Lawaan', 'Linao', 'Poblacion Ward II', 'Tunghaan', 'Calajo-an', 'Pakigne', 'Tulay'],
  CNL: ['Pitogo', 'Tayud', 'Lamac', 'Yati', 'Jubay', 'Poblacion Liloan', 'Catarman', 'Tilhaong'],
}

export const CATEGORIES: Category[] = [
  { id: 'AER-NB', name: 'Aerial FOC (New Build)', scope: 'New Build' },
  { id: 'UG-NB', name: 'Underground FOC (New Build)', scope: 'New Build' },
  { id: 'AER-OM', name: 'Aerial FOC (O&M)', scope: 'O&M' },
  { id: 'UG-OM', name: 'Underground FOC (O&M)', scope: 'O&M' },
  { id: 'HH', name: 'Handhole Raising (O&M)', scope: 'O&M' },
  { id: 'BRG', name: 'Bridge Attachment (O&M)', scope: 'O&M' },
  { id: 'UGV', name: 'UG Verification (O&M)', scope: 'O&M' },
]

/** Fictional MSPs. `q` = delivery quality used only by the generator (1 = on plan). */
const CONTRACTOR_SPECS = [
  { id: 'BLC', name: 'Bagwis Linecraft Corp.', q: 1.04 },
  { id: 'TFI', name: 'Tanaw Fiberworks Inc.', q: 1.0 },
  { id: 'LEC', name: 'Lantaw Engineering & Construction', q: 0.99 },
  { id: 'SLB', name: 'Sugbo Linya Builders', q: 0.97 },
  { id: 'MCC', name: 'Mabuhay Cableways Corp.', q: 0.95 },
  { id: 'HTC', name: 'Habagat Telecom Contractors', q: 0.92 },
  { id: 'DNL', name: 'Dagat Netlink Services', q: 0.88 },
  { id: 'KIS', name: 'Kidlat Infra Solutions', q: 0.85 },
]
export const CONTRACTORS: Contractor[] = CONTRACTOR_SPECS.map(({ id, name }) => ({ id, name, short: id }))

// Program mix: ~150 POs (BANGIS 40%, NEW BUILD 39%, VELOCITY 21%) + 30 SUNRISE WOs on top.
const PROGRAM_PLAN: { id: string; count: number; cats: [string, number][] }[] = [
  { id: 'BANGIS', count: 60, cats: [['AER-OM', 35], ['UG-OM', 20], ['HH', 20], ['BRG', 10], ['UGV', 15]] },
  { id: 'NEWBUILD', count: 58, cats: [['AER-NB', 60], ['UG-NB', 40]] },
  { id: 'VELOCITY', count: 32, cats: [['AER-NB', 50], ['UG-NB', 30], ['AER-OM', 20]] },
  { id: 'SUNRISE', count: 30, cats: [['AER-OM', 30], ['HH', 30], ['UGV', 25], ['BRG', 15]] },
]

/** km range, PHP per km range, duration range (days). Fiber backbone ballpark, Metro Cebu. */
const CAT_SPEC: Record<string, { km: [number, number]; perKm: [number, number]; days: [number, number]; short: string }> = {
  'AER-NB': { km: [3, 18], perKm: [380_000, 650_000], days: [90, 180], short: 'Aerial FOC build' },
  'UG-NB': { km: [1, 6], perKm: [1_600_000, 3_200_000], days: [120, 210], short: 'UG FOC build' },
  'AER-OM': { km: [1, 8], perKm: [120_000, 260_000], days: [45, 100], short: 'Aerial FOC rehab' },
  'UG-OM': { km: [0.5, 3], perKm: [450_000, 900_000], days: [60, 120], short: 'UG FOC rehab' },
  HH: { km: [0.2, 1.5], perKm: [400_000, 900_000], days: [30, 75], short: 'Handhole raising' },
  BRG: { km: [0.3, 1.2], perKm: [1_200_000, 2_200_000], days: [45, 90], short: 'Bridge attachment' },
  UGV: { km: [2, 10], perKm: [30_000, 55_000], days: [20, 45], short: 'UG verification' },
}

/** Normalised milestone windows (fraction of the timeline). They overlap like real fiber jobs. */
const WINDOWS: Record<MilestoneKey, [number, number]> = { ENG: [0, 0.2], ROW: [0.1, 0.45], CIVIL: [0.35, 0.8], FOC: [0.6, 1] }

const NON_LD: [string, number][] = [['DPWH', 22], ['LGU_POLE', 18], ['OSI', 16], ['JPA', 14], ['OLT', 12], ['LGU_CANAL', 8], ['DENR', 4], ['NCIP', 3], ['FM', 3]]
const LD_CODES: [string, number][] = [['MANPOWER', 40], ['PERMIT', 35], ['RTA', 15], ['ALO', 10]]

const NOTES: Record<string, string> = {
  DPWH: 'DPWH road widening along the route; poles to be relocated after clearing.',
  LGU_POLE: 'LGU enforcing one pole policy; waiting for shared pole assignment.',
  OSI: 'Owner supplied cable and closures not yet delivered to site.',
  JPA: 'Joint pole attachment approval pending with pole owner.',
  OLT: 'Node rack space / ODF ports not yet available.',
  LGU_CANAL: 'LGU one canal policy; shared duct route under review.',
  DENR: 'Route passes protected area; PAMB clearance pending.',
  NCIP: 'NCIP certification required for portion of route.',
  FM: 'Typhoon signal raised; works suspended.',
  MANPOWER: 'Crew pulled out to another site; only one team on this PO.',
  PERMIT: 'Barangay and excavation permits filed late by contractor.',
  RTA: 'RTA pending on contractor side.',
  ALO: 'ALO issue on contractor side.',
}

const LEADS = [
  'Rodel Abellana', 'Jun Cabahug', 'Rey Sanchez', 'Arnel Pepito', 'Dodong Ybañez', 'Ramil Gonzaga', 'Ronnie Alcoseba',
  'Joel Tecson', 'Marlon Cuizon', 'Elmer Lapitan', 'Nonoy Bacalso', 'Ricky Ouano', 'Bong Rosales', 'Edgar Paras',
  'Jessie Labra', 'Ariel Cañete', 'Winston Del Rosario', 'Romeo Seno', 'Danilo Basubas', 'Allan Tumulak',
  'Jonathan Mendoza', 'Ruel Alesna', 'Benjie Sumalinog', 'Noel Cabatingan', 'Gerry Lim', 'Toto Villamor',
  'Randy Ompad', 'Gilbert Enad', 'Lito Sevilla', 'Jojo Mercado',
]

const UPDATE_NOTES: Record<MilestoneKey, string[]> = {
  ENG: ['Route survey done, pole tagging in progress.', 'Engineering drawings submitted for review.', 'Site survey with Converge engineer.'],
  ROW: ['Barangay clearance secured.', 'Pole owner coordination ongoing.', 'Permit follow-up at city hall.'],
  CIVIL: ['Pole erection ongoing.', 'Duct laying and backfill on 120 m stretch.', 'Handhole installed and cured.', 'Guying and anchoring done.'],
  FOC: ['Cable pulling done on two spans.', 'Splicing at closure, OTDR test next.', 'Strand and lashing ongoing.'],
}

export interface SeedOptions { asOf: ISODate; nowMs: number }

/** Manila ISO timestamp for a moment in ms. */
export const manilaIso = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 19) + '+08:00'

export function generateSeed({ asOf, nowMs }: SeedOptions): Snapshot {
  const r = mulberry32(SEED)
  const between = (a: number, b: number) => a + r() * (b - a)
  const int = (a: number, b: number) => Math.floor(between(a, b + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const weighted = <T,>(pairs: [T, number][]) => {
    let x = r() * pairs.reduce((a, [, w]) => a + w, 0)
    for (const [v, w] of pairs) if ((x -= w) < 0) return v
    return pairs[pairs.length - 1][0]
  }
  const jitter = ([lng, lat]: [number, number], d = 0.012): [number, number] =>
    [+(lng + between(-d, d)).toFixed(5), +(lat + between(-d, d)).toFixed(5)]

  const pos: PO[] = []
  const delays: DelayEvent[] = []
  const clusterWeights: [string, number][] = [['CEB-N', 20], ['CEB-S', 18], ['MDE', 18], ['LLC', 16], ['TAL', 15], ['CNL', 13]]
  let poSeq = 0, woSeq = 0, delaySeq = 0

  for (const plan of PROGRAM_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      const catId = weighted(plan.cats)
      const spec = CAT_SPEC[catId]
      const clusterId = weighted(clusterWeights)
      const contractor = pick(CONTRACTOR_SPECS)
      const isWo = plan.id === 'SUNRISE'
      const km = +between(...spec.km).toFixed(2)
      const cost = Math.round((km * between(...spec.perKm) * (isWo ? 0.45 : 1)) / 1000) * 1000
      const D = int(...spec.days)
      // Pick the situation first, then place the timeline so the simulation lands there.
      // Weaker contractors are more likely to be the late ones.
      const lateBias = (1.04 - contractor.q) * 60
      const arche = weighted<string>([['done', 46], ['delayed', 13 + lateBias], ['risk', 7], ['trend', 8 + lateBias / 2], ['track', 16], ['new', 6]])
      const noise = (r() - 0.5) * 0.2
      const perf = arche === 'delayed' ? contractor.q * between(0.5, 0.75)
        : arche === 'trend' ? between(0.45, 0.65)
        : arche === 'track' ? Math.max(0.97, contractor.q + noise)
        : arche === 'risk' ? Math.min(0.98, contractor.q + noise)
        : Math.min(1.12, contractor.q + 0.07 + noise)
      const work = Math.round(D / perf)
      const start = addDays(asOf, -(
        arche === 'done' ? work + 46 + int(0, 200)
        : arche === 'delayed' ? D + int(5, Math.max(6, Math.min(110, work - D - 5)))
        : arche === 'risk' ? D - int(0, 30)
        : arche === 'trend' ? Math.round(D * between(0.35, 0.65))
        : arche === 'track' ? Math.round(D * between(0.05, 0.6))
        : -int(1, 30)))
      const [a, b] = [pick(BARANGAYS[clusterId]), pick(BARANGAYS[clusterId])]
      const id = isWo ? `WO-SR-26-${String(101 + woSeq++).padStart(4, '0')}` : `4500${String(193_017 + 37 * poSeq++).padStart(6, '0')}`

      const ptlFor = (version: number, s: ISODate, days: number, signedAt: ISODate, note?: string): PtlVersion => ({
        version, signedAt, start: s, targetPat: addDays(s, days), note,
        milestones: Object.fromEntries(MILESTONES.map(k => [k, {
          plannedStart: addDays(s, Math.round(WINDOWS[k][0] * days)),
          plannedEnd: addDays(s, Math.round(WINDOWS[k][1] * days)),
        }])) as PtlVersion['milestones'],
      })
      const ptl: PtlVersion[] = []
      const rebaseAt = addDays(start, Math.round(D * 0.3))
      if (r() < 0.12 && rebaseAt <= asOf) {
        ptl.push(ptlFor(1, start, D - int(20, 45), addDays(start, -7)))
        ptl.push(ptlFor(2, start, D, rebaseAt, pick([
          'Rebaselined: route deviation added after survey.', 'Rebaselined: scope increase approved by Backbone PM.', 'Rebaselined: node relocation.',
        ])))
      } else ptl.push(ptlFor(1, start, D, addDays(start, -7)))

      // Simulate how the job actually runs.
      const workDur = Math.round(D / perf)
      let actualDur = workDur
      let blockedSoFar = 0
      if (r() < 0.3) {
        const code = weighted(NON_LD)
        const bStart = addDays(start, Math.round(D * between(0.15, 0.6)))
        const len = int(7, 45)
        if (bStart <= asOf) {
          const bEnd = addDays(bStart, len - 1)
          const open = bEnd >= asOf && r() < 0.6
          delays.push({
            id: `DL-${++delaySeq}`, poId: id, reasonCode: code, milestone: code === 'OSI' || code === 'OLT' ? 'FOC' : 'ROW',
            start: bStart, end: open ? undefined : bEnd, note: NOTES[code], reportedBy: pick(LEADS),
          })
          actualDur += len
          blockedSoFar = Math.max(0, Math.min(len, diffDays(bStart, asOf) + 1))
        }
      }
      if (perf < 0.92 && r() < 0.8) {
        const code = weighted(LD_CODES)
        const bStart = addDays(start, Math.round(D * between(0.3, 0.8)))
        if (bStart <= asOf) {
          const len = int(7, 30)
          const bEnd = addDays(bStart, len - 1)
          delays.push({
            id: `DL-${++delaySeq}`, poId: id, reasonCode: code, milestone: pick(['ROW', 'CIVIL', 'FOC'] as MilestoneKey[]),
            start: bStart, end: bEnd >= asOf ? undefined : bEnd, note: NOTES[code], reportedBy: pick(LEADS),
          })
        }
      }

      const finish = addDays(start, actualDur)
      const done = finish <= asOf
      const frac = done ? 1 : Math.max(0, Math.min(0.97, (diffDays(start, asOf) - blockedSoFar) / workDur))
      const progress = Object.fromEntries(MILESTONES.map(k => {
        const [w0, w1] = WINDOWS[k]
        return [k, Math.round(Math.min(1, Math.max(0, (frac - w0) / (w1 - w0))) * 100)]
      })) as PO['progress']
      const scale = actualDur / D
      const milestoneActual: PO['milestoneActual'] = {}
      for (const k of MILESTONES) {
        if (progress[k] > 0) milestoneActual[k] = {
          start: addDays(start, Math.round(WINDOWS[k][0] * D * scale)),
          end: progress[k] === 100 ? addDays(start, Math.round(WINDOWS[k][1] * D * scale)) : undefined,
        }
      }
      const docsLag = int(0, 3) + (contractor.q < 0.93 ? int(0, 6) : 0)

      pos.push({
        id, kind: isWo ? 'WO' : 'PO',
        title: `${spec.short}, ${a}${a !== b ? ` to ${b}` : ''}`,
        programId: plan.id, clusterId, categoryId: catId, contractorId: contractor.id,
        costOfWorks: cost, lengthKm: km, ptl, progress, milestoneActual,
        patDate: done ? finish : undefined,
        docsSubmittedAt: done ? `${addDays(finish, docsLag)}T${String(int(8, 23)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00+08:00` : undefined,
      })
    }
  }

  // Crews: spread across contractors, each holding 1-3 of that contractor's open POs.
  const crews: Crew[] = LEADS.map((lead, i) => ({
    id: `CR-${String(i + 1).padStart(2, '0')}`, lead, contractorId: CONTRACTOR_SPECS[i % CONTRACTOR_SPECS.length].id, poIds: [],
    lastCheckIn: { gps: [0, 0], at: '' },
  }))
  const open = pos.filter(p => !p.patDate && p.ptl[0].start <= asOf)
  for (const p of open) {
    const mine = crews.filter(c => c.contractorId === p.contractorId).sort((x, y) => x.poIds.length - y.poIds.length)
    if (mine[0] && mine[0].poIds.length < 3) mine[0].poIds.push(p.id)
  }
  const center = (poId: string) => CLUSTERS.find(c => c.id === pos.find(p => p.id === poId)!.clusterId)!.center

  const updates: FieldUpdate[] = []
  let upSeq = 0
  for (const crew of crews) {
    if (!crew.poIds.length) crew.poIds.push(pos.filter(p => p.contractorId === crew.contractorId).at(-1)!.id)
    for (const poId of crew.poIds) {
      const po = pos.find(p => p.id === poId)!
      if (po.patDate) continue
      const k = [...MILESTONES].reverse().find(m => po.progress[m] > 0) ?? 'ENG'
      const n = int(2, 5)
      for (let j = 0; j < n; j++) {
        const minsAgo = j * int(1500, 8000) + int(5, 600)
        updates.push({
          id: `UP-${++upSeq}`, poId, crewId: crew.id, milestone: k,
          progress: Math.max(0, po.progress[k] - j * int(3, 8)),
          photoIds: Array.from({ length: int(1, 3) }, (_, x) => `UP-${upSeq}-${x}`),
          gps: jitter(center(poId)), at: manilaIso(nowMs - minsAgo * 60_000), note: pick(UPDATE_NOTES[k]),
        })
      }
    }
    const latest = updates.filter(u => u.crewId === crew.id).sort((a, b) => b.at.localeCompare(a.at))[0]
    crew.lastCheckIn = latest
      ? { gps: latest.gps, at: latest.at }
      : { gps: jitter(center(crew.poIds[0])), at: manilaIso(nowMs - int(60, 3000) * 60_000) }
  }

  // Third-party damage incidents (generic parties, no real company names).
  const incidentSpecs = [
    { party: 'DPWH road widening subcontractor (backhoe)', cluster: 'TAL', desc: 'Backhoe hooked aerial span during road widening; 48-core cable cut near pole.' },
    { party: 'Power distribution utility line crew', cluster: 'MDE', desc: 'Utility crew replacing transformer cut messenger wire; cable sagging over road.' },
    { party: 'Unidentified truck (hit and run)', cluster: 'CNL', desc: 'Over-height truck snagged cable at crossing; two spans down.' },
    { party: 'Water district pipe-laying contractor', cluster: 'CEB-S', desc: 'Excavation for pipe laying damaged UG duct and 24-core cable.' },
    { party: 'Barangay drainage project contractor', cluster: 'LLC', desc: 'Canal excavation exposed and cut duct bank near handhole.' },
  ]
  const incidents: Incident[] = incidentSpecs.map((sp, i) => {
    const po = pick(pos.filter(p => p.clusterId === sp.cluster))
    const received = nowMs - int(2, 40) * 86_400_000 - int(0, 600) * 60_000
    const hours = int(4, 30)
    const restored = i === 2 ? undefined : received + hours * 3_600_000
    const ug = sp.cluster === 'CEB-S' || sp.cluster === 'LLC'
    return {
      id: `INC-26-${String(41 + i).padStart(4, '0')}`, poId: po.id, clusterId: sp.cluster, responsibleParty: sp.party,
      witnessingMsp: po.contractorId,
      attending: { name: pick(LEADS), position: 'Crew Leader', contact: `09${int(17, 99)} ${int(100, 999)} ${int(1000, 9999)}` },
      ticketRef: `TT-${int(800000, 899999)}`, relatedTickets: [`TT-${int(800000, 899999)}`],
      affectedLink: `${pick(BARANGAYS[sp.cluster])} node to ${pick(BARANGAYS[sp.cluster])} node`,
      faultLocation: `Along ${pick(BARANGAYS[sp.cluster])} road`,
      gps: jitter(CLUSTERS.find(c => c.id === sp.cluster)!.center),
      receivedAt: manilaIso(received), restoredAt: restored ? manilaIso(restored) : undefined,
      restorationStatus: restored ? (i % 2 ? 'permanent' : 'temporary') : 'ongoing',
      description: sp.desc, undertakingSigned: i !== 2, blotterAttached: i % 2 === 0,
      permanentRestoration: i % 2 ? 'same-contractor' : 'for-award',
      bom: ug ? [
        { item: 'Excavation and backfill', unit: 'm', qty: int(10, 40), unitCost: 1100, phase: 'permanent' },
        { item: 'HDPE duct 40 mm', unit: 'm', qty: int(20, 60), unitCost: 120, phase: 'permanent' },
        { item: 'FOC 24-core UG cable', unit: 'm', qty: int(80, 200), unitCost: 110, phase: 'permanent' },
        { item: 'Temporary aerial bypass', unit: 'lot', qty: 1, unitCost: 18_000, phase: 'temporary' },
        { item: 'Splicing per core', unit: 'core', qty: 48, unitCost: 450, phase: 'temporary' },
        { item: 'Restoration crew', unit: 'day', qty: int(1, 3), unitCost: 14_000, phase: 'temporary' },
      ] : [
        { item: 'FOC 48-core aerial cable', unit: 'm', qty: int(100, 400), unitCost: 95, phase: 'permanent' },
        { item: 'Steel pole 9 m', unit: 'pc', qty: int(0, 2), unitCost: 18_000, phase: 'permanent' },
        { item: 'Splice closure 48c', unit: 'pc', qty: 2, unitCost: 6500, phase: 'permanent' },
        { item: 'Dead-end hardware set', unit: 'set', qty: int(2, 6), unitCost: 1200, phase: 'temporary' },
        { item: 'Splicing per core', unit: 'core', qty: 96, unitCost: 450, phase: 'temporary' },
        { item: 'Restoration crew', unit: 'day', qty: int(1, 2), unitCost: 14_000, phase: 'temporary' },
      ],
    }
  })

  return {
    asOf, programs: PROGRAMS, clusters: CLUSTERS, categories: CATEGORIES, contractors: CONTRACTORS,
    pos, delays, crews, updates, incidents,
  }
}

