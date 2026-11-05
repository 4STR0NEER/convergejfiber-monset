import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Check, Search, TriangleAlert } from 'lucide-react'
import { fmtDate, peso } from '../../domain/dates'
import { ldExposure, milestoneSummary, monthlySeries, reconcile, scorecards, statusBy, sumPhp, type StatusRow } from '../../domain/metrics'
import { STATUS_LABEL, STATUSES, type PoEval } from '../../domain/status'
import { MILESTONE_LABEL } from '../../domain/types'
import { useData } from '../../state'
import { FilterBar } from '../../ui/FilterBar'
import { pesoShort } from '../../ui/format'
import { Panel, TableView } from '../../ui/Panel'
import { StatusBadge, StatusGlyph, STATUS_VAR } from '../../ui/status'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (p: string) => `${MONTH[+p.slice(5) - 1]} ${p.slice(2, 4)}`

export function Portfolio() {
  const { snap, evals, matches, can } = useData()
  const view = useMemo(() => evals.filter(matches), [evals, matches])
  const cost = sumPhp(view.map(e => e.po.costOfWorks))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-4 pt-6 md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-sm text-muted">
            {view.length} POs/WOs · {pesoShort(cost)} cost of works · as of {fmtDate(snap.asOf)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReconcileChip view={view} />
          {can('po.create') && <Link to="/po/new" className="inline-flex items-center gap-1.5 rounded-full bg-text px-3.5 py-1.5 text-xs font-semibold text-bg"><Plus size={14} />New PO</Link>}
        </div>
      </div>
      <FilterBar />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Milestone progress" sub="Average % complete vs where the PTLs say we should be today">
          <Milestones view={view} />
        </Panel>
        <Panel className="xl:col-span-7" title="Target vs actual PAT, month over month" sub="POs due each month vs POs accepted that month">
          <MonthChart view={view} />
        </Panel>
        <Panel className="xl:col-span-6" title="Status by cluster" sub="Click a cluster to filter every view">
          <StatusBars rows={statusBy(view, snap.clusters, e => e.po.clusterId)} filterKey="cluster" />
        </Panel>
        <Panel className="xl:col-span-6" title="Status by category">
          <StatusBars rows={statusBy(view, snap.categories, e => e.po.categoryId)} filterKey="category" />
        </Panel>
        <Panel className="xl:col-span-4" title="LD exposure by program" sub="Contractor-attributable delay only, still open or not yet claimed">
          <LdByProgram view={view} />
        </Panel>
        <Panel className="xl:col-span-8" title="Contractors" sub={<>Ranked by LD exposure · <Link to="/scorecards" className="text-accent hover:underline">full scorecards</Link></>}>
          <ContractorTable view={view} />
        </Panel>
        <Panel className="md:col-span-2 xl:col-span-12" title="PO register" sub="Every PO/WO in this view. Open one for the full timeline, update feed and LD breakdown.">
          <Register view={view} />
        </Panel>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ReconcileChip({ view }: { view: PoEval[] }) {
  const { snap, settings } = useData()
  const checks = reconcile(snap, view, settings, snap.asOf)
  const ok = checks.every(c => c.ok)
  return (
    <details className="relative">
      <summary className={`flex cursor-pointer select-none list-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium
        ${ok ? 'border-[color-mix(in_oklab,var(--st-ontrack)_45%,transparent)] text-text' : 'border-bad text-bad'}`}>
        {ok ? <Check size={14} style={{ color: 'var(--st-ontrack)' }} /> : <TriangleAlert size={14} />}
        {ok ? `All ${checks.length} totals reconcile` : `${checks.filter(c => !c.ok).length} totals do not reconcile`}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(92vw,380px)] rounded-xl border border-border bg-surface p-4 text-xs shadow-[var(--shadow)]">
        <p className="mb-2 text-muted">Every breakdown is re-added and compared to the grand total for this view.</p>
        <ul className="space-y-1">
          {checks.map(c => (
            <li key={c.label} className="flex justify-between gap-3">
              <span className="flex items-center gap-1.5">{c.ok ? <Check size={12} style={{ color: 'var(--st-ontrack)' }} /> : <TriangleAlert size={12} className="text-bad" />}{c.label}</span>
              <span className="text-muted">{c.unit === 'php' ? peso(c.actual) : c.actual}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

function Milestones({ view }: { view: PoEval[] }) {
  const { snap } = useData()
  const rows = milestoneSummary(view, snap.asOf)
  return (
    <>
      <ul className="space-y-5">
        {rows.map(m => {
          const gap = m.avgPlanned - m.avgProgress
          return (
            <li key={m.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{MILESTONE_LABEL[m.key]}</span>
                <span className="text-xs text-muted">{m.complete} of {m.total} complete</span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${m.avgProgress}%`, background: 'var(--series-a)' }} />
                <div className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-text" style={{ left: `calc(${m.avgPlanned}% - 1px)` }} title={`Plan ${Math.round(m.avgPlanned)}%`} />
              </div>
              <p className="mt-1 text-xs text-muted">
                <span className="font-medium text-text">{Math.round(m.avgProgress)}%</span> done · plan {Math.round(m.avgPlanned)}%
                {gap >= 1 ? ` · ${Math.round(gap)} pts behind` : ' · on plan'}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-muted"><span className="inline-block h-3 w-0.5 rounded-full bg-text" />Plan by today, from each PO's live PTL</p>
    </>
  )
}

function MonthChart({ view }: { view: PoEval[] }) {
  const { snap } = useData()
  const data = monthlySeries(view, snap.asOf).map(m => ({ ...m, label: monthLabel(m.period), late: m.actual - m.onTime }))
  const series = [
    { key: 'onTime', label: 'Accepted on time', color: 'var(--series-a)' },
    { key: 'late', label: 'Accepted late', color: 'var(--series-b)' },
    { key: 'target', label: 'Due (target PAT)', color: 'var(--series-ref)' },
  ]
  return (
    <>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map(s => <li key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</li>)}
      </ul>
      <div className="h-60">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--text) 6%, transparent)' }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof data)[number]
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow)]">
                  <p className="mb-1 font-semibold">{label}</p>
                  <p>Due: {d.target}</p>
                  <p>Accepted: {d.actual} ({d.onTime} on time, {d.late} late)</p>
                  {d.target > 0 && <p className="text-muted">Hit rate vs due: {Math.round((d.onTime / d.target) * 100)}%</p>}
                </div>
              )
            }} />
            <Bar dataKey="onTime" stackId="acc" fill="var(--series-a)" maxBarSize={24} stroke="var(--surface)" strokeWidth={1} />
            <Bar dataKey="late" stackId="acc" fill="var(--series-b)" radius={[4, 4, 0, 0]} maxBarSize={24} stroke="var(--surface)" strokeWidth={1} />
            <Bar dataKey="target" fill="var(--series-ref)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView head={['Month', 'Due', 'Accepted', 'On time', 'Late']} rows={data.map(d => [d.label, d.target, d.actual, d.onTime, d.late])} />
    </>
  )
}

function StatusBars({ rows, filterKey }: { rows: StatusRow[]; filterKey: 'cluster' | 'category' }) {
  const { filters, setFilters } = useData()
  const max = Math.max(1, ...rows.map(r => r.total))
  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {STATUSES.map(s => <li key={s} className="flex items-center gap-1"><StatusGlyph status={s} size={12} />{STATUS_LABEL[s]}</li>)}
      </ul>
      <ul className="space-y-2.5">
        {rows.map(r => (
          <li key={r.id} className="grid grid-cols-[minmax(7rem,11rem)_1fr_2rem] items-center gap-3">
            <button onClick={() => setFilters({ ...filters, [filterKey]: filters[filterKey] === r.id ? '' : r.id })}
              aria-pressed={filters[filterKey] === r.id}
              className={`truncate text-left text-[13px] hover:underline ${filters[filterKey] === r.id ? 'font-semibold' : ''}`}>{r.name}</button>
            <div className="flex h-5 gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
              {STATUSES.filter(s => r.counts[s]).map((s, i, arr) => (
                <div key={s} tabIndex={0} aria-label={`${r.name}: ${r.counts[s]} ${STATUS_LABEL[s]}`}
                  className={`group relative grid min-w-[3px] place-items-center text-[10px] font-semibold outline-none
                    ${i === arr.length - 1 ? 'rounded-r-[4px]' : ''}`}
                  style={{ flexGrow: r.counts[s], background: STATUS_VAR[s], color: 'var(--on-status)' }}>
                  {r.counts[s] / r.total >= 0.12 && r.counts[s]}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-normal text-text shadow-[var(--shadow)] group-hover:block group-focus-visible:block">
                    {STATUS_LABEL[s]}: {r.counts[s]} of {r.total}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-right text-xs text-muted">{r.total}</span>
          </li>
        ))}
      </ul>
      <TableView head={['Group', ...STATUSES.map(s => STATUS_LABEL[s]), 'Total']} rows={rows.map(r => [r.name, ...STATUSES.map(s => r.counts[s]), r.total])} />
    </>
  )
}

function LdByProgram({ view }: { view: PoEval[] }) {
  const { snap, settings } = useData()
  const rows = snap.programs.map(p => {
    const mine = view.filter(e => e.po.programId === p.id)
    return { name: p.name, amount: ldExposure(mine, snap.asOf, settings.holidays), pos: mine.filter(e => e.ld.amount > 0).length }
  })
  const max = Math.max(1, ...rows.map(r => r.amount))
  const total = sumPhp(rows.map(r => r.amount))
  return (
    <>
      <p className="text-2xl font-semibold tracking-tight">{peso(total)}</p>
      <ul className="mt-4 space-y-3">
        {rows.map(r => (
          <li key={r.name}>
            <div className="flex justify-between text-[13px]"><span>{r.name}</span><span className="text-muted">{peso(r.amount)}</span></div>
            <div className="mt-1 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-r-[4px] rounded-l-full" style={{ width: `${(r.amount / max) * 100}%`, background: 'var(--series-b)' }} />
            </div>
          </li>
        ))}
      </ul>
      <TableView head={['Program', 'LD exposure', 'POs with LD']} rows={rows.map(r => [r.name, peso(r.amount), r.pos])} />
    </>
  )
}

function ContractorTable({ view }: { view: PoEval[] }) {
  const { snap, settings } = useData()
  const cards = scorecards(snap, view, settings, snap.asOf).filter(c => c.total).sort((a, b) => b.ldExposure - a.ldExposure)
  const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
  const name = (id: string) => snap.contractors.find(c => c.id === id)!.name
  const count = (id: string, st: string) => view.filter(e => e.po.contractorId === id && e.status === st).length
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="text-xs text-muted">
          <tr>
            {['Contractor', 'POs', 'On-time rate', 'Delayed', 'Trending late', 'Their share of delay', 'LD exposure'].map((h, i) => (
              <th key={h} scope="col" className={`border-b border-border py-2 pr-3 font-medium ${i ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cards.map(c => (
            <tr key={c.contractorId} className="border-b border-border/60 last:border-0">
              <th scope="row" className="py-2 pr-3 font-medium">{name(c.contractorId)}</th>
              <td className="py-2 pr-3 text-right">{c.total}</td>
              <td className="py-2 pr-3 text-right">{pct(c.onTimeRate)}</td>
              <td className="py-2 pr-3 text-right">{count(c.contractorId, 'DELAYED')}</td>
              <td className="py-2 pr-3 text-right">{count(c.contractorId, 'TRENDING_LATE')}</td>
              <td className="py-2 pr-3 text-right">{pct(c.attributableShare)}</td>
              <td className="py-2 text-right font-medium">{peso(c.ldExposure)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type SortKey = 'id' | 'status' | 'progress' | 'target' | 'ld' | 'health'
const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]))

function Register({ view }: { view: PoEval[] }) {
  const { snap } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ld', dir: -1 })
  const [limit, setLimit] = useState(25)
  const val = (e: PoEval, k: SortKey): number | string => ({
    id: e.po.id, status: STATUS_RANK[e.status], progress: e.progressPct, target: e.effectiveTarget, ld: e.ld.amount, health: e.health,
  })[k]
  const rows = view
    .filter(e => !q || `${e.po.id} ${e.po.title}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (val(a, sort.key) < val(b, sort.key) ? -1 : val(a, sort.key) > val(b, sort.key) ? 1 : 0) * sort.dir)
  const cluster = (id: string) => snap.clusters.find(c => c.id === id)!.name
  const contractor = (id: string) => snap.contractors.find(c => c.id === id)!.short
  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`border-b border-border py-2 pr-3 font-medium ${right ? 'text-right' : ''}`}>
      <button onClick={() => setSort(s => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : -1 }))} className="inline-flex items-center gap-1 hover:text-text">
        {label}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )
  return (
    <>
      <label className="mb-3 flex h-9 max-w-sm items-center gap-2 rounded-lg border border-border bg-bg px-3 text-[13px] focus-within:border-[var(--accent)]">
        <Search size={14} className="text-muted" />
        <span className="sr-only">Search POs</span>
        <input value={q} onChange={e => { setQ(e.target.value); setLimit(25) }} placeholder="Search PO number or route" className="w-full bg-transparent outline-none placeholder:text-muted" />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="text-xs text-muted">
            <tr>
              <Th k="id" label="PO / WO" />
              <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Route</th>
              <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Cluster · MSP</th>
              <Th k="status" label="Status" />
              <Th k="progress" label="Progress" right />
              <Th k="target" label="Target PAT" right />
              <Th k="health" label="Health" right />
              <Th k="ld" label="LD" right />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(e => (
              <tr key={e.po.id} onClick={() => navigate(`/po/${e.po.id}`)} className="cursor-pointer border-b border-border/60 transition-colors duration-100 hover:bg-surface-2">
                <td className="py-2 pr-3 font-mono text-xs"><Link to={`/po/${e.po.id}`} onClick={ev => ev.stopPropagation()} className="hover:underline">{e.po.id}</Link></td>
                <td className="max-w-[260px] truncate py-2 pr-3">{e.po.title}</td>
                <td className="py-2 pr-3 text-muted">{cluster(e.po.clusterId)} · {contractor(e.po.contractorId)}</td>
                <td className="py-2 pr-3"><StatusBadge status={e.status} /></td>
                <td className="py-2 pr-3 text-right">{Math.round(e.progressPct)}%</td>
                <td className="py-2 pr-3 text-right">{fmtDate(e.effectiveTarget)}</td>
                <td className="py-2 pr-3 text-right">{e.health}</td>
                <td className="py-2 text-right">{e.ld.amount ? peso(e.ld.amount) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        Showing {Math.min(limit, rows.length)} of {rows.length}
        {limit < rows.length && <button onClick={() => setLimit(l => l + 50)} className="font-medium text-accent hover:underline">Show more</button>}
      </div>
    </>
  )
}
