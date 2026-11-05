// Creating a PO / WO by hand: validation and the default PTL milestone plan.
import { addDays, diffDays, type ISODate } from './dates'
import { MILESTONES, type MilestoneKey, type PO, type PtlVersion } from './types'

/** Default milestone windows as a share of the PTL (they overlap, as on real fiber jobs). Same as the seed. */
export const DEFAULT_WINDOWS: Record<MilestoneKey, [number, number]> = { ENG: [0, 0.2], ROW: [0.1, 0.45], CIVIL: [0.35, 0.8], FOC: [0.6, 1] }

export function defaultMilestones(start: ISODate, target: ISODate): PtlVersion['milestones'] {
  const d = Math.max(1, diffDays(start, target))
  return Object.fromEntries(MILESTONES.map(k => [k, {
    plannedStart: addDays(start, Math.round(DEFAULT_WINDOWS[k][0] * d)),
    plannedEnd: addDays(start, Math.round(DEFAULT_WINDOWS[k][1] * d)),
  }])) as PtlVersion['milestones']
}

export interface NewPoInput {
  id: string
  kind: 'PO' | 'WO'
  title: string
  programId: string
  clusterId: string
  categoryId: string
  contractorId: string
  costOfWorks: number
  lengthKm: number
  start: ISODate
  targetPat: ISODate
  milestones: PtlVersion['milestones']
  signedAt: ISODate
}

/** Human-readable problems; empty = OK to save. */
export function validateNewPo(i: NewPoInput, existingIds: Set<string>): string[] {
  const errs: string[] = []
  const id = i.id.trim()
  if (!id) errs.push('Enter the PO / WO number.')
  else if (existingIds.has(id)) errs.push(`${id} already exists.`)
  else if (i.kind === 'PO' && !/^\d{10}$/.test(id)) errs.push('A PO number is 10 digits.')
  if (!i.title.trim()) errs.push('Give the route a name.')
  for (const [k, label] of [['programId', 'program'], ['clusterId', 'cluster'], ['categoryId', 'category'], ['contractorId', 'contractor']] as const) {
    if (!i[k]) errs.push(`Choose a ${label}.`)
  }
  if (!(i.costOfWorks > 0)) errs.push('Cost of works must be more than zero (LD is computed on it).')
  if (!i.start || !i.targetPat) errs.push('Enter the PTL start and target PAT dates.')
  else if (i.targetPat <= i.start) errs.push('Target PAT must be after the PTL start.')
  else for (const k of MILESTONES) {
    const m = i.milestones[k]
    if (!m.plannedStart || !m.plannedEnd || m.plannedEnd < m.plannedStart) errs.push(`Check the ${k} milestone dates.`)
    else if (m.plannedStart < i.start || m.plannedEnd > i.targetPat) errs.push(`${k} milestone must sit between PTL start and target PAT.`)
  }
  return errs
}

export function buildPo(i: NewPoInput): PO {
  return {
    id: i.id.trim(), kind: i.kind, title: i.title.trim(),
    programId: i.programId, clusterId: i.clusterId, categoryId: i.categoryId, contractorId: i.contractorId,
    costOfWorks: Math.round(i.costOfWorks * 100) / 100, lengthKm: i.lengthKm,
    ptl: [{ version: 1, signedAt: i.signedAt, start: i.start, targetPat: i.targetPat, milestones: i.milestones }],
    progress: { ENG: 0, ROW: 0, CIVIL: 0, FOC: 0 },
    milestoneActual: {},
  }
}
