// Phase 1 shell: proves the domain + seed end to end. Replaced by the real screens from Phase 2.
import { useEffect, useState } from 'react'
import { repo } from './data/repo'
import { addMonths, fmtDate, monthOf, peso } from './domain/dates'
import { ldExposure, monthlySeries, reconcile } from './domain/metrics'
import { closeSchedule } from './domain/monthEnd'
import { evaluateAll, STATUS_LABEL, STATUSES } from './domain/status'
import type { Settings, Snapshot } from './domain/types'

export default function App() {
  const [data, setData] = useState<{ snap: Snapshot; s: Settings }>()
  useEffect(() => { Promise.all([repo.getSnapshot(), repo.getSettings()]).then(([snap, s]) => setData({ snap, s })) }, [])
  if (!data) return <p className="p-8 text-muted">Loading portfolio…</p>

  const { snap, s } = data
  const evals = evaluateAll(snap, s)
  const checks = reconcile(snap, evals, s, snap.asOf)
  const count = (f: (e: (typeof evals)[number]) => boolean) => evals.filter(f).length
  const top = [...evals].sort((a, b) => b.ld.amount - a.ld.amount).slice(0, 6)
  const lastPeriod = addMonths(monthOf(snap.asOf), -1)

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <div className="h-1 w-24 rounded-full" style={{ background: 'var(--brand-gradient)' }} />
        <h1 className="mt-3 text-2xl font-semibold">Converge-J Fiber · Backbone Command</h1>
        <p className="text-muted">Phase 1 data check. As of {fmtDate(snap.asOf)} · assumed seed data</p>
      </header>

      <section aria-label="KPIs" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Total PO/WO" value={evals.length} />
        {STATUSES.map(st => <Kpi key={st} label={STATUS_LABEL[st]} value={count(e => e.status === st)} />)}
        <Kpi label="Ongoing" value={count(e => e.activity === 'ONGOING')} />
        <Kpi label="Not Started" value={count(e => e.activity === 'NOT_STARTED')} />
        <Kpi label="LD exposure" value={peso(ldExposure(evals, snap.asOf, s.holidays))} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card title={`Reconciliation · ${checks.every(c => c.ok) ? 'all totals match' : 'MISMATCH'}`}>
          <ul className="space-y-1 text-sm">
            {checks.map(c => (
              <li key={c.label} className="flex justify-between gap-4">
                <span>{c.ok ? '✓' : '✗'} {c.label}</span>
                <span className={c.ok ? 'text-muted' : 'text-bad'}>{c.unit === 'php' ? peso(c.actual) : c.actual}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Month-end close · ${lastPeriod}`}>
          <ol className="space-y-1 text-sm">
            {closeSchedule(lastPeriod, s.holidays).map(st => (
              <li key={st.key} className="flex justify-between gap-4">
                <span>Day {st.from}{st.to !== st.from ? `–${st.to}` : ''}: {st.label}</span>
                <span className="shrink-0 text-muted">{fmtDate(st.start)}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-medium">Target vs actual PAT</h3>
          <ul className="text-sm">
            {monthlySeries(evals, snap.asOf).map(m => (
              <li key={m.period} className="flex justify-between"><span>{m.period}</span><span className="text-muted">target {m.target} · actual {m.actual} · on time {m.onTime}</span></li>
            ))}
          </ul>
        </Card>
      </section>

      <Card title="Highest LD exposure (with plain-language why)">
        <ul className="divide-y divide-border">
          {top.map(e => (
            <li key={e.po.id} className="py-3 text-sm">
              <div className="flex justify-between gap-4 font-medium">
                <span>{e.po.id} · {e.po.title} · {STATUS_LABEL[e.status]}</span>
                <span className="text-accent">{peso(e.ld.amount)}</span>
              </div>
              <ul className="mt-1 list-disc pl-5 text-muted">{e.why.map(w => <li key={w}>{w}</li>)}</ul>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  )
}

const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border bg-surface p-3">
    <div className="text-xs text-muted">{label}</div>
    <div className="text-xl font-semibold">{value}</div>
  </div>
)

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-surface p-5">
    <h2 className="mb-3 font-semibold">{title}</h2>
    {children}
  </section>
)
