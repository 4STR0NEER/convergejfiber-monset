import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Box, Map as MapIcon, RotateCcw } from 'lucide-react'
import { STATUS_LABEL, STATUSES } from '../../domain/status'
import { useData } from '../../state'
import { FilterBar } from '../../ui/FilterBar'
import { LineSample, StatusGlyph } from '../../ui/status'
import { KpiStrip } from './KpiStrip'
import { SidePanel } from './SidePanel'

// deck.gl + MapLibre are most of the bundle: let the KPI strip and filters paint first.
const HeroMap = lazy(() => import('./HeroMap').then(m => ({ default: m.HeroMap })))

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
      <FilterBar><MapControls mode3d={mode3d} setMode3d={setMode3d} onReset={() => setReset(n => n + 1)} /></FilterBar>
      <div className="relative min-h-[68vh] flex-1 md:min-h-0">
        <Suspense fallback={<div role="status" className="grid h-full place-items-center text-sm text-muted">Loading the 3D map…</div>}>
          <HeroMap mode3d={mode3d} reduceMotion={reduce} resetSignal={reset} />
        </Suspense>
        <Legend />
        <AnimatePresence>{selected && <SidePanel key={selected.po.id} ev={selected} />}</AnimatePresence>
      </div>
    </div>
  )
}

function MapControls({ mode3d, setMode3d, onReset }: { mode3d: boolean; setMode3d: (b: boolean) => void; onReset: () => void }) {
  const { evals, select } = useData()
  const [q, setQ] = useState('')
  // Keyboard and screen-reader path into the map: pick a PO, the camera flies there and the panel opens.
  const pick = (v: string) => { setQ(v); const id = v.split(' ')[0]; if (evals.some(e => e.po.id === id)) { select(id); setQ('') } }
  return (
    <>
      <label className="relative">
        <span className="sr-only">Find a PO on the map</span>
        <input list="po-list" value={q} onChange={e => pick(e.target.value)} placeholder="Find a PO…"
          className="h-8 w-44 rounded-lg border border-border bg-surface px-2.5 text-[13px] outline-none placeholder:text-muted focus:border-[var(--accent)]" />
        <datalist id="po-list">{evals.map(e => <option key={e.po.id} value={`${e.po.id} ${e.po.title}`} />)}</datalist>
      </label>
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
    </>
  )
}

function Legend() {
  const { network } = useData()
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
        <li className="flex items-center gap-2"><svg width="12" height="16" viewBox="0 0 96 128" aria-hidden="true"><path d="M48 124C48 124 7 79 7 46a41 41 0 1 1 82 0c0 33-41 78-41 78Z" fill="var(--brand-magenta)" /><circle cx="48" cy="46" r="22" fill="#0d0b14" /></svg>Core node / NOC</li>
        <li className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[var(--brand-orange)]" />Hub</li>
      </ul>
      <p className="mt-2 text-[11px] text-muted">{network.source ? `Routes from ${network.source}` : 'Routes are assumed, not surveyed.'}</p>
    </details>
  )
}
