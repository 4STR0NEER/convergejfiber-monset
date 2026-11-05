import { useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Box, Map as MapIcon, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { STATUS_LABEL, STATUSES } from '../../domain/status'
import { NO_FILTERS, useData, type Filters } from '../../state'
import { LineSample, StatusGlyph } from '../../ui/status'
import { HeroMap } from './HeroMap'
import { KpiStrip } from './KpiStrip'
import { SidePanel } from './SidePanel'

export function CommandCenter() {
  const { byId, selectedId } = useData()
  const reduce = !!useReducedMotion()
  const [mode3d, setMode3d] = useState(true)
  const [reset, setReset] = useState(0)
  const selected = selectedId ? byId.get(selectedId) : undefined

  return (
    <div className="flex min-h-full flex-col md:h-full md:min-h-0">
      <h1 className="sr-only">Command Center</h1>
      <KpiStrip />
      <FilterBar mode3d={mode3d} setMode3d={setMode3d} onReset={() => setReset(n => n + 1)} />
      <div className="relative min-h-[68vh] flex-1 md:min-h-0">
        <HeroMap mode3d={mode3d} reduceMotion={reduce} resetSignal={reset} />
        <Legend />
        <AnimatePresence>{selected && <SidePanel key={selected.po.id} ev={selected} />}</AnimatePresence>
      </div>
    </div>
  )
}

function FilterBar({ mode3d, setMode3d, onReset }: { mode3d: boolean; setMode3d: (b: boolean) => void; onReset: () => void }) {
  const { snap, filters, setFilters, evals, matches } = useData()
  const shown = evals.filter(matches).length
  const [open, setOpen] = useState(false)
  const dirty = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)
  const sel = (key: keyof Filters, label: string, opts: { id: string; name: string }[]) => (
    <select aria-label={label} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}
      className={`h-8 rounded-lg border bg-surface px-2 text-[13px] transition-colors duration-150
        ${filters[key] ? 'border-[var(--accent)] text-text' : 'border-border text-muted hover:text-text'}`}>
      <option value="">All {label.toLowerCase()}</option>
      {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2 md:px-6">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="map-filters"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] md:hidden">
        <SlidersHorizontal size={14} />Filters{dirty ? ' (on)' : ''}
      </button>
      <div id="map-filters" className={`${open ? 'flex' : 'hidden'} w-full flex-wrap gap-2 md:flex md:w-auto`}>
        {sel('program', 'Programs', snap.programs)}
        {sel('cluster', 'Clusters', snap.clusters)}
        {sel('contractor', 'Contractors', snap.contractors)}
        {sel('category', 'Categories', snap.categories)}
        {sel('status', 'Statuses', STATUSES.map(s => ({ id: s, name: STATUS_LABEL[s] })))}
      </div>
      <span className="text-xs text-muted" aria-live="polite">Showing {shown} of {evals.length}</span>
      {dirty && <button onClick={() => setFilters(NO_FILTERS)} className="text-xs font-medium text-accent hover:underline">Clear filters</button>}
      <div className="ml-auto flex items-center gap-1">
        <div role="group" aria-label="Map mode" className="flex rounded-lg border border-border p-0.5">
          {[{ v: true, label: '3D', Icon: Box }, { v: false, label: '2D', Icon: MapIcon }].map(({ v, label, Icon }) => (
            <button key={label} aria-pressed={mode3d === v} onClick={() => setMode3d(v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-150 ${mode3d === v ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
        <button onClick={onReset} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:text-text">
          <RotateCcw size={13} />Reset view
        </button>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <details open={typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches} className="group absolute bottom-3 left-3 z-10 max-w-[230px] rounded-xl border border-border bg-[var(--map-veil)] px-3 py-2 text-[12px] shadow-[var(--shadow)]">
      <summary className="cursor-pointer select-none text-xs font-semibold">Legend</summary>
      <ul className="mt-2 space-y-1">
        {STATUSES.map(s => (
          <li key={s} className="flex items-center gap-2"><LineSample status={s} /><StatusGlyph status={s} size={12} />{STATUS_LABEL[s]}</li>
        ))}
      </ul>
      <ul className="mt-2 space-y-1 border-t border-border pt-2 text-muted">
        <li className="flex items-center gap-2"><span className="inline-block h-[5px] w-7 rounded-full bg-text/70" />Mainline backbone</li>
        <li className="flex items-center gap-2"><span className="inline-block h-[2.5px] w-7 rounded-full bg-text/70" />Barangay sub line</li>
        <li className="flex items-center gap-2"><svg width="12" height="15" viewBox="0 0 64 80" aria-hidden="true"><path d="M32 78C32 78 6 50 6 31a26 26 0 1 1 52 0c0 19-26 47-26 47Z" fill="#7c3aed" /></svg>Crew, last check-in</li>
        <li className="flex items-center gap-2"><svg width="13" height="13" viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="40" height="40" rx="6" transform="rotate(45 32 32)" fill="#e11d48" /></svg>Third-party damage</li>
        <li className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[var(--brand-orange)]" />Hub / NOC</li>
      </ul>
      <p className="mt-2 text-[11px] text-muted">Routes are assumed, not surveyed.</p>
    </details>
  )
}
