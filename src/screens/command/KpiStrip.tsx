import { useEffect, useRef } from 'react'
import { animate, createScope, stagger } from 'animejs'
import { ldExposure } from '../../domain/metrics'
import { STATUS_LABEL, STATUSES } from '../../domain/status'
import type { Activity, Status } from '../../domain/types'
import { useData } from '../../state'
import { pesoShort } from '../../ui/format'
import { StatusGlyph, STATUS_VAR } from '../../ui/status'

/** One instrument strip, not nine cards. Counts respect program/cluster/contractor/category filters;
 *  clicking a status or activity toggles it as a filter. */
export function KpiStrip() {
  const { evals, matchesScope, filters, setFilters, snap, settings } = useData()
  const scoped = evals.filter(matchesScope)
  const count = (st: Status) => scoped.filter(e => e.status === st).length
  const act = (a: Activity) => scoped.filter(e => e.activity === a).length
  const ld = ldExposure(scoped, snap.asOf, settings.holidays)
  const accruing = scoped.filter(e => e.ld.amount > 0 && e.activity !== 'COMPLETED').length
  const root = useRef<HTMLDivElement>(null)

  // First paint only: numbers count up and the mix bar fills (part of the intro moment).
  useEffect(() => {
    const scope = createScope({ root, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } }).add(self => {
      if (self?.matches.reduce) return
      root.current!.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
        const target = { v: 0 }
        const final = Number(el.dataset.count)
        const fmt = el.dataset.peso ? pesoShort : (n: number) => String(Math.round(n))
        animate(target, { v: final, duration: 1100, delay: 300 + i * 45, ease: 'out(4)', onUpdate: () => { el.textContent = fmt(target.v) } })
      })
      animate('.mix-seg', { scaleX: [0, 1], duration: 900, delay: stagger(60, { start: 400 }), ease: 'out(4)' })
    })
    return () => scope.revert()
  }, [])

  const toggleStatus = (st: Status) => setFilters({ ...filters, status: filters.status === st ? '' : st, activity: '' })
  const toggleAct = (a: Activity) => setFilters({ ...filters, activity: filters.activity === a ? '' : a, status: '' })

  return (
    <div ref={root} className="flex flex-wrap items-stretch gap-x-6 gap-y-3 border-b border-border bg-surface px-4 py-3 md:px-6">
      <Figure label="Total PO / WO" value={scoped.length} />

      <div className="min-w-0 flex-[3_1_480px]">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(st => (
            <button key={st} onClick={() => toggleStatus(st)} aria-pressed={filters.status === st}
              className={`flex min-w-[96px] flex-1 flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors duration-150
                ${filters.status === st ? 'bg-surface-2 ring-1 ring-[color-mix(in_oklab,var(--text)_25%,transparent)]' : 'hover:bg-surface-2'}`}>
              <span className="flex items-center gap-1.5 text-[11px] text-muted"><StatusGlyph status={st} size={12} />{STATUS_LABEL[st]}</span>
              <span className="text-xl font-semibold leading-tight" data-count={count(st)}>{count(st)}</span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden="true">
          {STATUSES.map(st => (
            <div key={st} className="mix-seg h-full origin-left" style={{ flexGrow: count(st), background: STATUS_VAR[st], opacity: filters.status && filters.status !== st ? 0.3 : 1 }} />
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        {(['ONGOING', 'NOT_STARTED'] as Activity[]).map(a => (
          <button key={a} onClick={() => toggleAct(a)} aria-pressed={filters.activity === a}
            className={`flex flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors duration-150 ${filters.activity === a ? 'bg-surface-2 ring-1 ring-[color-mix(in_oklab,var(--text)_25%,transparent)]' : 'hover:bg-surface-2'}`}>
            <span className="text-[11px] text-muted">{a === 'ONGOING' ? 'Ongoing' : 'Not Started'}</span>
            <span className="text-xl font-semibold leading-tight" data-count={act(a)}>{act(a)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-center border-l border-border pl-6">
        <span className="text-[11px] text-muted">Total LD exposure</span>
        <span className="text-xl font-semibold leading-tight text-accent" data-count={ld} data-peso="1">{pesoShort(ld)}</span>
        <span className="text-[11px] text-muted">accruing on {accruing} open PO{accruing === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col justify-center pr-2">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-3xl font-semibold leading-none tracking-tight" data-count={value}>{value}</span>
    </div>
  )
}
