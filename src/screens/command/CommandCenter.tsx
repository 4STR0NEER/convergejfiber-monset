import { useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Box, Map as MapIcon, RotateCcw } from 'lucide-react'
import { STATUS_LABEL, STATUSES } from '../../domain/status'
import { useData } from '../../state'
import { FilterBar } from '../../ui/FilterBar'
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
      <FilterBar><MapControls mode3d={mode3d} setMode3d={setMode3d} onReset={() => setReset(n => n + 1)} /></FilterBar>
      <div className="relative min-h-[68vh] flex-1 md:min-h-0">
        <HeroMap mode3d={mode3d} reduceMotion={reduce} resetSignal={reset} />
        <Legend />
        <AnimatePresence>{selected && <SidePanel key={selected.po.id} ev={selected} />}</AnimatePresence>
      </div>
    </div>
  )
}

function MapControls({ mode3d, setMode3d, onReset }: { mode3d: boolean; setMode3d: (b: boolean) => void; onReset: () => void }) {
  return (
    <>
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
