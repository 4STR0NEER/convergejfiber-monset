// Day math on plain 'YYYY-MM-DD' strings. Everything is whole calendar days (UTC-based, so no DST drift).
export type ISODate = string

const DAY = 86_400_000

export const toDay = (d: ISODate): number => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
export const fromDay = (n: number): ISODate => new Date(n * DAY).toISOString().slice(0, 10)
export const addDays = (d: ISODate, n: number): ISODate => fromDay(toDay(d) + n)
/** b - a in days (positive when b is later). */
export const diffDays = (a: ISODate, b: ISODate): number => toDay(b) - toDay(a)
export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b)

/** Today's date in Manila, regardless of the viewer's machine timezone. */
export const todayManila = (): ISODate => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

/** 'YYYY-MM' of a date. */
export const monthOf = (d: ISODate) => d.slice(0, 7)
export const monthStart = (period: string): ISODate => `${period}-01`
export const monthEnd = (period: string): ISODate => {
  const [y, m] = period.split('-').map(Number)
  return fromDay(Date.UTC(y, m, 1) / DAY - 1)
}
export const addMonths = (period: string, n: number): string => {
  const [y, m] = period.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/**
 * Count of calendar days covered by the union of inclusive [start, end] intervals,
 * clipped to the inclusive window [from, to]. Overlapping intervals are only counted once.
 */
export function coveredDays(intervals: { start: ISODate; end: ISODate }[], from: ISODate, to: ISODate): number {
  const lo = toDay(from), hi = toDay(to)
  if (hi < lo) return 0
  const spans = intervals
    .map(i => [Math.max(toDay(i.start), lo), Math.min(toDay(i.end), hi)] as const)
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0])
  let total = 0, last = -Infinity // last day already counted
  for (const [a, b] of spans) {
    const from = Math.max(a, last + 1)
    if (b >= from) { total += b - from + 1; last = b }
  }
  return total
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** '2026-11-05' -> '5 Nov 2026' */
export const fmtDate = (d: ISODate) => `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`

export const peso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
