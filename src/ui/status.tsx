// Status visual language: colour + dash pattern + glyph + label. Never colour alone.
import type { Status } from '../domain/types'
import { STATUS_LABEL } from '../domain/status'
import type { Theme } from '../state'

/** Mirrors the --st-* tokens in theme.css (deck.gl needs raw values). */
export const STATUS_HEX: Record<Theme, Record<Status, string>> = {
  dark: { COMPLETED: '#8e97ad', ON_TRACK: '#34d399', TRENDING_LATE: '#c084fc', AT_RISK: '#fbbf24', DELAYED: '#fb7185' },
  light: { COMPLETED: '#64748b', ON_TRACK: '#15803d', TRENDING_LATE: '#7e22ce', AT_RISK: '#a16207', DELAYED: '#9f1239' }, // validated (dataviz): adjacent CVD + contrast pass
}
export const STATUS_VAR: Record<Status, string> = {
  COMPLETED: 'var(--st-completed)', ON_TRACK: 'var(--st-ontrack)', TRENDING_LATE: 'var(--st-trending)', AT_RISK: 'var(--st-atrisk)', DELAYED: 'var(--st-delayed)',
}
/** Dash pattern as [dash, gap] in line widths. null = solid. Completed is solid but drawn thin and faded. */
export const STATUS_DASH: Record<Status, [number, number] | null> = {
  COMPLETED: null, ON_TRACK: null, TRENDING_LATE: [5, 2.5], AT_RISK: [2.4, 2], DELAYED: [0.9, 1.6],
}

export const hexToRgb = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

/** 16x16 glyph paths, stroked. */
const GLYPH: Record<Status, string> = {
  COMPLETED: '<circle cx="8" cy="8" r="6.2"/><path d="M5.2 8.3l1.9 1.9 3.8-4.2"/>',
  ON_TRACK: '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="2.4" fill="currentColor"/>',
  TRENDING_LATE: '<path d="M1.8 4.6l4.4 4.4 2.6-2.6 5.4 5.4"/><path d="M10.4 11.8h3.8V8"/>',
  AT_RISK: '<path d="M8 1.9l6.4 11.3H1.6z"/><path d="M8 6.4v3.2"/><circle cx="8" cy="11.4" r=".4" fill="currentColor"/>',
  DELAYED: '<path d="M5.4 1.7h5.2l3.7 3.7v5.2l-3.7 3.7H5.4l-3.7-3.7V5.4z"/><path d="M6 6l4 4M10 6l-4 4"/>',
}

export const glyphSvg = (s: Status, color: string, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[s]}</svg>`

export function StatusGlyph({ status, size = 14 }: { status: Status; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
      style={{ color: STATUS_VAR[status] }} dangerouslySetInnerHTML={{ __html: GLYPH[status] }} />
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: `color-mix(in oklab, ${STATUS_VAR[status]} 50%, transparent)`, color: STATUS_VAR[status] }}>
      <StatusGlyph status={status} size={13} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Short line drawn with the status dash pattern, for legends. */
export function LineSample({ status, width = 28 }: { status: Status; width?: number }) {
  const d = STATUS_DASH[status]
  const w = status === 'COMPLETED' ? 2 : 3
  return (
    <svg width={width} height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2={width - 1} y2="4" stroke={STATUS_VAR[status]} strokeWidth={w} strokeLinecap="round"
        strokeDasharray={d ? `${d[0] * w} ${d[1] * w}` : undefined} opacity={status === 'COMPLETED' ? 0.7 : 1} />
    </svg>
  )
}
