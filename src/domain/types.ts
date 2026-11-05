import type { ISODate } from './dates'

export type MilestoneKey = 'ENG' | 'ROW' | 'CIVIL' | 'FOC'
export const MILESTONES: MilestoneKey[] = ['ENG', 'ROW', 'CIVIL', 'FOC']
export const MILESTONE_LABEL: Record<MilestoneKey, string> = {
  ENG: 'Engineering', ROW: 'Right of Way', CIVIL: 'Civil Works', FOC: 'FOC Works',
}

export type LngLat = [number, number]
/** ISO timestamp with offset, e.g. 2026-11-05T09:14:00+08:00 */
export type Timestamp = string

export interface Program { id: string; name: string; type: string; unit: 'PO' | 'WO' }
export interface Cluster { id: string; name: string; center: LngLat }
export interface Category { id: string; name: string; scope: 'New Build' | 'O&M' }
export interface Contractor { id: string; name: string; short: string }

export interface DelayReason {
  code: string
  label: string
  description?: string
  /** true = contractor attributable, counts toward LD. false = excusable, extends the target day for day. */
  ldEligible: boolean
}

/** One signed Project Timeline. A PO keeps every version; the last one is the live baseline. */
export interface PtlVersion {
  version: number
  signedAt: ISODate
  start: ISODate
  targetPat: ISODate
  milestones: Record<MilestoneKey, { plannedStart: ISODate; plannedEnd: ISODate }>
  note?: string
}

export interface PO {
  id: string
  kind: 'PO' | 'WO'
  title: string
  programId: string
  clusterId: string
  categoryId: string
  contractorId: string
  /** Cost of works in PHP. LD is computed on this. */
  costOfWorks: number
  lengthKm: number
  ptl: PtlVersion[]
  /** 0-100 per milestone. */
  progress: Record<MilestoneKey, number>
  milestoneActual: Partial<Record<MilestoneKey, { start?: ISODate; end?: ISODate }>>
  /** Set once PAT is done. Stops the LD clock. */
  patDate?: ISODate
  /** When the as-built documentation was handed in (month-end lateness check). */
  docsSubmittedAt?: Timestamp
}

export interface DelayEvent {
  id: string
  poId: string
  reasonCode: string
  milestone: MilestoneKey
  start: ISODate
  /** Open-ended blockers have no end yet; they run to today (or PAT). */
  end?: ISODate
  note: string
  reportedBy: string
}

export interface FieldUpdate {
  id: string
  poId: string
  crewId: string
  milestone: MilestoneKey
  progress: number
  photoIds: string[]
  gps: LngLat
  at: Timestamp
  note?: string
}

export interface Crew {
  id: string
  lead: string
  contractorId: string
  poIds: string[]
  lastCheckIn: { gps: LngLat; at: Timestamp }
}

export interface BomLine { item: string; unit: string; qty: number; unitCost: number; phase: 'temporary' | 'permanent' }

export interface Incident {
  id: string
  poId?: string
  clusterId: string
  responsibleParty: string
  witnessingMsp: string
  attending: { name: string; position: string; contact: string }
  ticketRef: string
  relatedTickets: string[]
  affectedLink: string
  faultLocation: string
  gps: LngLat
  receivedAt: Timestamp
  restoredAt?: Timestamp
  restorationStatus: 'temporary' | 'permanent' | 'ongoing'
  description: string
  undertakingSigned: boolean
  blotterAttached: boolean
  bom: BomLine[]
  permanentRestoration: 'same-contractor' | 'for-award'
}

export interface Settings {
  weights: Record<MilestoneKey, number>
  /** Trending Late fires when (% timeline elapsed - % weighted progress) exceeds this many points. */
  trendingLateGap: number
  /** At Risk window in calendar days (Manila rule: 30). */
  atRiskDays: number
  /** LD per started week of delay, as a fraction of cost of works (0.005 = 0.5%). */
  ldRatePerWeek: number
  /** LD cap as a fraction of cost of works (0.5 = 50%). */
  ldCap: number
  reasons: DelayReason[]
  /** Holidays skipped when counting month-end Day 1..10. */
  holidays: ISODate[]
}

export type Status = 'COMPLETED' | 'ON_TRACK' | 'TRENDING_LATE' | 'AT_RISK' | 'DELAYED'
export type Activity = 'NOT_STARTED' | 'ONGOING' | 'COMPLETED'

export interface Snapshot {
  asOf: ISODate
  programs: Program[]
  clusters: Cluster[]
  categories: Category[]
  contractors: Contractor[]
  pos: PO[]
  delays: DelayEvent[]
  crews: Crew[]
  updates: FieldUpdate[]
  incidents: Incident[]
}

export const currentPtl = (po: PO): PtlVersion => po.ptl[po.ptl.length - 1]

/** One drawn piece of fiber route. Each segment belongs to exactly one PO. */
export interface Segment { segmentId: string; poId: string; tier: 'mainline' | 'sub'; corridor: string; path: LngLat[] }
export interface Hub { id: string; name: string; coord: LngLat; core: boolean }
export interface Network { segments: Segment[]; hubs: Hub[] }
