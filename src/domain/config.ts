import type { DelayReason, Settings } from './types'

export const DEFAULT_REASONS: DelayReason[] = [
  // Not subject to LD: outside the contractor's control, extend the target day for day.
  { code: 'OSI', label: 'OSI Delivery', description: 'Owner supplied items not delivered on time', ldEligible: false },
  { code: 'OLT', label: 'OLT/ODF/Node Availability', ldEligible: false },
  { code: 'JPA', label: 'JPA/NTP', description: 'Joint pole attachment / notice to proceed', ldEligible: false },
  { code: 'NCIP', label: 'NCIP', description: 'National Commission on Indigenous Peoples clearance', ldEligible: false },
  { code: 'DPWH', label: 'DPWH', description: 'Road widening / road under warranty', ldEligible: false },
  { code: 'LGU_POLE', label: 'LGU One Pole Policy', ldEligible: false },
  { code: 'LGU_CANAL', label: 'LGU One Canal Policy', ldEligible: false },
  { code: 'DENR', label: 'DENR/PAMB', description: 'Environmental / protected area clearance', ldEligible: false },
  { code: 'FM', label: 'Force Majeure', ldEligible: false },
  // Subject to LD: contractor attributable.
  { code: 'PERMIT', label: 'Local Permitting', ldEligible: true },
  { code: 'RTA', label: 'RTA', description: 'Meaning to be confirmed with client', ldEligible: true },
  { code: 'ALO', label: 'ALO', description: 'Meaning to be confirmed with client', ldEligible: true },
  { code: 'MANPOWER', label: 'Manpower', ldEligible: true },
]

/** Major PH regular holidays skipped when counting month-end days. Editable in Settings. */
export const DEFAULT_HOLIDAYS = [
  '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-09', '2026-05-01', '2026-06-12',
  '2026-08-31', '2026-11-01', '2026-11-30', '2026-12-25', '2026-12-30',
  '2027-01-01', '2027-03-25', '2027-03-26', '2027-04-09', '2027-05-01', '2027-06-12',
  '2027-08-30', '2027-11-01', '2027-11-30', '2027-12-25', '2027-12-30',
]

export const DEFAULT_SETTINGS: Settings = {
  weights: { ENG: 15, ROW: 25, CIVIL: 35, FOC: 25 },
  trendingLateGap: 20,
  atRiskDays: 30,
  ldRatePerWeek: 0.005,
  ldCap: 0.5,
  reasons: DEFAULT_REASONS,
  holidays: DEFAULT_HOLIDAYS,
}
