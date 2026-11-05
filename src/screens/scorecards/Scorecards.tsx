import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addMonths, fmtDate, monthOf, peso } from '../../domain/dates'
import { delaysByReason, scorecards, type Scorecard } from '../../domain/metrics'
import { docsDeadline, isDocsLate } from '../../domain/monthEnd'
import { STATUS_LABEL, STATUSES } from '../../domain/status'
import { useData } from '../../state'
import { Panel, TableView } from '../../ui/Panel'
import { StatusBadge, StatusGlyph, STATUS_VAR } from '../../ui/status'

const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
type SortKey = 'ldExposure' | 'onTimeRate' | 'attributableShare' | 'docsLateRate'
const SORTS: { key: SortKey; label: string; desc: boolean }[] = [
  { key: 'ldExposure', label: 'LD exposure', desc: true },
  { key: 'onTimeRate', label: 'On-time rate', desc: false },
  { key: 'attributableShare', label: 'Share of delay that is theirs', desc: true },
  { key: 'docsLateRate', label: 'Late documentation', desc: true },
]

export function Scorecards() {
  const { snap, settings, evals } = useData()
  const { id } = useParams()
  const navigate = useNavigate()
  const [sort, setSort] = useState<SortKey>('ldExposure')
  const cards = useMemo(() => scorecards(snap, evals, settings, snap.asOf), [snap, evals, settings])
  const s = SORTS.find(x => x.key === sort)!
  // Worst first: the contractor that needs attention is at the top.
  const ranked = [...cards].sort((a, b) => ((b[sort] ?? -1) - (a[sort] ?? -1)) * (s.desc ? 1 : -1))
  const sel = cards.find(c => c.contractorId === id)
  const name = (cid: string) => snap.contractors.find(c => c.id === cid)!.name

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contractor Scorecards</h1>
          <p className="mt-1 text-sm text-muted">{cards.length} MSPs · ranked worst first by the measure you pick · as of {fmtDate(snap.asOf)}</p>
        </div>
        <label className="text-sm">Rank by{' '}
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="ml-1 h-9 rounded-lg border border-border bg-surface px-3">
            {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="text-xs text-muted">
            <tr>{['#', 'Contractor', 'POs', 'Status mix', 'On-time', 'Their share of delay', 'Docs late', 'On-time, last 3 full months', 'LD exposure'].map((h, i) => (
              <th key={h} scope="col" className={`border-b border-border px-3 py-3 font-medium ${i === 8 ? 'text-right' : ''}`}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {ranked.map((c, i) => (
              <tr key={c.contractorId} onClick={() => navigate(`/scorecards/${c.contractorId}`)} aria-selected={c.contractorId === id}
                className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2 ${c.contractorId === id ? 'bg-surface-2' : ''}`}>
                <td className="px-3 py-3 text-muted">{i + 1}</td>
                <th scope="row" className="px-3 py-3 font-medium"><Link to={`/scorecards/${c.contractorId}`} onClick={e => e.stopPropagation()} className="hover:underline">{name(c.contractorId)}</Link></th>
                <td className="px-3 py-3">{c.total}</td>
                <td className="px-3 py-3"><MixBar id={c.contractorId} /></td>
                <td className="px-3 py-3"><Meter v={c.onTimeRate} good /></td>
                <td className="px-3 py-3"><Meter v={c.attributableShare} /></td>
                <td className="px-3 py-3"><Meter v={c.docsLateRate} /></td>
                <td className="px-3 py-3"><Trend c={c} /></td>
                <td className="px-3 py-3 text-right font-semibold">{peso(c.ldExposure)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">On-time = accepted with zero contractor-attributable late days. Their share of delay = attributable late days ÷ all delay days (attributable + excused). Docs late = as-built documents after the Day 1 midnight cutoff.</p>

      {sel ? <Detail c={sel} /> : <p className="mt-8 text-sm text-muted">Pick a contractor to see their delays by reason, monthly trend and open POs.</p>}
    </div>
  )
}

/** Bar meter with the number; "good" meters read higher-is-better, others higher-is-worse. */
function Meter({ v, good }: { v: number | null; good?: boolean }) {
  if (v === null) return <span className="text-muted">–</span>
  const bad = good ? v < 0.6 : v > 0.5
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: bad ? 'var(--st-delayed)' : 'var(--series-a)' }} /></div>
      <span className={`w-9 tabular-nums ${bad ? 'font-semibold' : ''}`}>{pct(v)}</span>
    </div>
  )
}

function MixBar({ id }: { id: string }) {
  const { evals } = useData()
  const mine = evals.filter(e => e.po.contractorId === id)
  return (
    <div className="flex h-2.5 w-36 gap-[2px] overflow-hidden rounded-[3px]" role="img"
      aria-label={STATUSES.map(s => `${mine.filter(e => e.status === s).length} ${STATUS_LABEL[s]}`).join(', ')}>
      {STATUSES.map(s => { const n = mine.filter(e => e.status === s).length; return n ? <div key={s} style={{ flexGrow: n, background: STATUS_VAR[s] }} title={`${STATUS_LABEL[s]}: ${n}`} /> : null })}
    </div>
  )
}

function Trend({ c }: { c: Scorecard }) {
  return (
    <ol className="flex items-end gap-2" aria-label="On-time rate by month">
      {c.trend.map(t => (
        <li key={t.period} className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
          <span className="flex h-6 w-5 items-end rounded-sm bg-surface-2">
            {t.rate !== null && <span className="w-full rounded-sm" style={{ height: `${Math.max(8, t.rate * 100)}%`, background: 'var(--series-a)' }} />}
          </span>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+t.period.slice(5) - 1]} {pct(t.rate)}
        </li>
      ))}
    </ol>
  )
}

function Detail({ c }: { c: Scorecard }) {
  const { snap, settings, evals } = useData()
  const mine = evals.filter(e => e.po.contractorId === c.contractorId)
  const reasons = delaysByReason(mine)
  const maxDays = Math.max(1, ...reasons.map(r => r.days))
  const now = monthOf(snap.asOf)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(now, i - 5)).map(p => {
    const done = mine.filter(e => e.po.patDate && monthOf(e.po.patDate) === p)
    return { label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p.slice(5) - 1], accepted: done.length, onTime: done.filter(e => !e.ld.lateDays).length, docsLate: done.filter(e => isDocsLate(e.po.docsSubmittedAt, docsDeadline(p, settings.holidays))).length }
  })
  const open = mine.filter(e => e.activity !== 'COMPLETED').sort((a, b) => b.ld.amount - a.ld.amount || a.daysToTarget - b.daysToTarget)
  return (
    <section className="mt-8" aria-labelledby="sc-detail">
      <h2 id="sc-detail" className="text-xl font-semibold tracking-tight">{snap.contractors.find(x => x.id === c.contractorId)?.name}</h2>
      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
        {([['POs', String(c.total)], ['Completed', String(c.completed)], ['On-time rate', pct(c.onTimeRate)], ['Their late days', String(c.attributableDays)], ['Excused days', String(c.excusedDays)], ['LD exposure', peso(c.ldExposure)]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-[11px] text-muted">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Delay days by reason" sub="Their side counts toward LD; excused reasons move the target">
          <ul className="mb-3 flex gap-4 text-[11px] text-muted">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--st-delayed)' }} />Contractor side</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg, var(--muted) 0 2px, transparent 2px 4px)' }} />Excused</li>
          </ul>
          <ul className="space-y-2.5">
            {reasons.map(r => (
              <li key={r.code} className="grid grid-cols-[9.5rem_1fr_4.5rem] items-center gap-3 text-[13px]">
                <span className="truncate">{r.label}</span>
                <div className="h-3 rounded-r-[4px]" style={{ width: `${(r.days / maxDays) * 100}%`, background: r.ldEligible ? 'var(--st-delayed)' : 'repeating-linear-gradient(135deg, var(--muted) 0 2px, transparent 2px 5px)' }} />
                <span className="text-right text-xs text-muted">{r.days} d · {r.pos} PO{r.pos > 1 ? 's' : ''}</span>
              </li>
            ))}
            {!reasons.length && <li className="text-sm text-muted">No blockers reported.</li>}
          </ul>
          <TableView head={['Reason', 'LD', 'Days', 'POs']} rows={reasons.map(r => [r.label, r.ldEligible ? 'Subject' : 'Excused', r.days, r.pos])} />
        </Panel>
        <Panel title="Accepted per month, on time vs late" sub="Last 6 months">
          <ul className="mb-2 flex gap-4 text-xs text-muted">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-a)' }} />On time</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-b)' }} />Late</li>
          </ul>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={months.map(m => ({ ...m, late: m.accepted - m.onTime }))} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--text) 6%, transparent)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--text)' }} />
                <Bar dataKey="onTime" name="On time" stackId="a" fill="var(--series-a)" maxBarSize={24} stroke="var(--surface)" strokeWidth={1} />
                <Bar dataKey="late" name="Late" stackId="a" fill="var(--series-b)" radius={[4, 4, 0, 0]} maxBarSize={24} stroke="var(--surface)" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TableView head={['Month', 'Accepted', 'On time', 'Docs late']} rows={months.map(m => [m.label, m.accepted, m.onTime, m.docsLate])} />
        </Panel>
      </div>
      <Panel className="mt-4" title="Open POs" sub="Highest LD first">
        <ul className="divide-y divide-border/60 text-[13px]">
          {open.map(e => (
            <li key={e.po.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0"><Link to={`/po/${e.po.id}`} className="font-mono text-xs hover:underline">{e.po.id}</Link> · {e.po.title}</span>
              <span className="flex items-center gap-4">
                <StatusBadge status={e.status} />
                <span className="w-32 text-right text-xs text-muted">{e.daysToTarget < 0 ? `${-e.daysToTarget} d late` : `${e.daysToTarget} d to target`}</span>
                <span className="w-24 text-right font-medium">{e.ld.amount ? peso(e.ld.amount) : '–'}</span>
              </span>
            </li>
          ))}
          {!open.length && <li className="py-3 text-muted">No open POs.</li>}
        </ul>
        <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">{STATUSES.map(s => <span key={s} className="flex items-center gap-1"><StatusGlyph status={s} size={11} />{STATUS_LABEL[s]}</span>)}</p>
      </Panel>
    </section>
  )
}
