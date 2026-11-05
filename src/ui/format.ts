/** "6 min ago", "3 h ago", "2 d ago" */
export function ago(iso: string, nowMs: number) {
  const m = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** ₱1.37M, ₱842K, ₱950 */
export function pesoShort(n: number) {
  if (n >= 1e6) return `₱${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `₱${Math.round(n / 1e3)}K`
  return `₱${Math.round(n).toLocaleString('en-PH')}`
}

export const pct = (n: number) => `${Math.round(n)}%`
