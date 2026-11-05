// Shared filters (program, cluster, contractor, category, status). Same state on every screen.
import { useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { STATUS_LABEL, STATUSES } from '../domain/status'
import { NO_FILTERS, useData, type Filters } from '../state'

export function FilterBar({ children }: { children?: ReactNode }) {
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
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="shared-filters"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] md:hidden">
        <SlidersHorizontal size={14} />Filters{dirty ? ' (on)' : ''}
      </button>
      <div id="shared-filters" className={`${open ? 'flex' : 'hidden'} w-full flex-wrap gap-2 md:flex md:w-auto`}>
        {sel('program', 'Programs', snap.programs)}
        {sel('cluster', 'Clusters', snap.clusters)}
        {sel('contractor', 'Contractors', snap.contractors)}
        {sel('category', 'Categories', snap.categories)}
        {sel('status', 'Statuses', STATUSES.map(s => ({ id: s, name: STATUS_LABEL[s] })))}
      </div>
      <span className="text-xs text-muted" aria-live="polite">Showing {shown} of {evals.length}</span>
      {dirty && <button onClick={() => setFilters(NO_FILTERS)} className="text-xs font-medium text-accent hover:underline">Clear filters</button>}
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  )
}
