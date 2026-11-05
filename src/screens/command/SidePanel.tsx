import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { diffDays, fmtDate, peso, type ISODate } from '../../domain/dates'
import { plannedMilestonePct, type PoEval } from '../../domain/status'
import { currentPtl, MILESTONE_LABEL, MILESTONES } from '../../domain/types'
import { useData } from '../../state'
import LiquidGauge from '../../ui/kokonut/liquid-gauge'
import { ago } from '../../ui/format'
import { photoUrl } from '../../ui/photo'
import { StatusBadge } from '../../ui/status'

export function SidePanel({ ev }: { ev: PoEval }) {
  const { snap, settings, select } = useData()
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const po = ev.po
  const name = <T extends { id: string; name: string }>(xs: T[], id: string) => xs.find(x => x.id === id)?.name ?? id
  const updates = snap.updates.filter(u => u.poId === po.id).sort((a, b) => b.at.localeCompare(a.at))
  const crewOf = (id: string) => snap.crews.find(c => c.id === id)
  const incidents = snap.incidents.filter(i => i.poId === po.id)
  const now = Date.now()

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') select(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [po.id, select])

  return (
    <motion.aside
      aria-label={`${po.kind} ${po.id} details`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] } }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 20, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
      className="absolute inset-x-2 bottom-2 top-auto z-20 max-h-[70%] overflow-y-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow)]
        md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:w-[420px]"
    >
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-surface/95 px-5 pb-4 pt-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted">{po.kind} {po.id}</p>
          <h2 className="mt-0.5 text-base font-semibold leading-snug [text-wrap:balance]">{po.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {name(snap.programs, po.programId)} · {name(snap.clusters, po.clusterId)} · {name(snap.categories, po.categoryId)}
          </p>
          <p className="text-xs text-muted">{name(snap.contractors, po.contractorId)}</p>
        </div>
        <button ref={closeRef} onClick={() => select(null)} aria-label="Close details"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text">
          <X size={18} />
        </button>
      </header>

      <div className="space-y-6 px-5 py-5">
        <section className="grid grid-cols-[1fr_9.5rem] gap-4">
          <div className="space-y-2">
            <StatusBadge status={ev.status} />
            <ul className="space-y-1.5 text-[13px] leading-snug">
              {ev.why.map(w => <li key={w}>{w}</li>)}
            </ul>
            {ev.manilaStatus !== ev.status && (
              <p className="text-xs text-muted">Manila's calendar rule would still show this as {ev.manilaStatus === 'ON_TRACK' ? 'On Track' : ev.manilaStatus}.</p>
            )}
          </div>
          <LiquidGauge key={po.id} readOnly value={ev.health} label="Schedule health"
            statusText={ev.activity === 'COMPLETED' ? 'Accepted' : ev.gap > 0 ? `${Math.round(ev.gap)} pts behind` : 'On plan'} />
        </section>

        <Section title="PTL timeline">
          <Gantt ev={ev} asOf={snap.asOf} />
          {po.ptl.length > 1 && (
            <p className="mt-2 text-xs text-muted">
              PTL v{currentPtl(po).version} signed {fmtDate(currentPtl(po).signedAt)}. {currentPtl(po).note} Original target {fmtDate(po.ptl[0].targetPat)}.
            </p>
          )}
        </Section>

        <Section title="Latest field photos">
          {updates.length ? (
            <ul className="grid grid-cols-3 gap-2">
              {updates.slice(0, 3).map(u => (
                <li key={u.id}>
                  <img src={photoUrl(u.photoIds[0], `${u.at.slice(0, 16).replace('T', ' ')}  ${u.gps[1].toFixed(4)}, ${u.gps[0].toFixed(4)}`)}
                    alt={`${MILESTONE_LABEL[u.milestone]} update by ${crewOf(u.crewId)?.lead}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <p className="mt-1 text-[11px] leading-tight text-muted">{ago(u.at, now)} · {crewOf(u.crewId)?.lead.split(' ')[0]}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No field updates on file{ev.activity === 'COMPLETED' ? ' (accepted before this tracker).' : '.'}</p>}
          {updates[0]?.note && <p className="mt-2 text-xs text-muted">Latest note: “{updates[0].note}”</p>}
        </Section>

        <Section title="Delay log">
          {ev.ld.periods.length ? (
            <ul className="divide-y divide-border text-[13px]">
              {ev.ld.periods.map(p => (
                <li key={p.reasonCode + p.start} className="flex items-baseline justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted">{fmtDate(p.start)} to {p.end === snap.asOf ? 'today' : fmtDate(p.end)} · {p.days} days</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${p.ldEligible ? 'bg-[color-mix(in_oklab,var(--st-delayed)_16%,transparent)] text-[var(--st-delayed)]' : 'bg-surface-2 text-muted'}`}>
                    {p.ldEligible ? 'Subject to LD' : 'Excused, no LD'}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No blockers reported.</p>}
        </Section>

        <Section title="LD exposure">
          <p className="text-2xl font-semibold tracking-tight">{peso(ev.ld.amount)}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-muted">Cost of works</dt><dd className="text-right">{peso(po.costOfWorks)}</dd>
            <dt className="text-muted">PTL target PAT</dt><dd className="text-right">{fmtDate(ev.ld.baseTarget)}</dd>
            <dt className="text-muted">Excused days</dt><dd className="text-right">+{ev.ld.eotDays}</dd>
            <dt className="text-muted">Extended target</dt><dd className="text-right">{fmtDate(ev.ld.effectiveTarget)}</dd>
            <dt className="text-muted">Contractor days late</dt><dd className="text-right">{ev.ld.lateDays}</dd>
            <dt className="text-muted">Started weeks</dt><dd className="text-right">{ev.ld.weeks} × {settings.ldRatePerWeek * 100}%</dd>
            <dt className="text-muted">Cap (50%)</dt><dd className="text-right">{peso(ev.ld.capAmount)}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted">
            {ev.ld.clockStopped ? `Clock stopped at PAT on ${fmtDate(po.patDate!)}.` : ev.ld.lateDays ? 'Accruing daily until PAT.' : 'Nothing accrued.'}
          </p>
        </Section>

        {incidents.length > 0 && (
          <Section title="Third-party damage">
            <ul className="space-y-2 text-[13px]">
              {incidents.map(i => (
                <li key={i.id}><span className="font-mono text-xs">{i.id}</span> · {i.responsibleParty}. {i.description}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </motion.aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  )
}

/** Planned windows from the live PTL, filled to actual progress, with today and target markers. */
function Gantt({ ev, asOf }: { ev: PoEval; asOf: ISODate }) {
  const ptl = currentPtl(ev.po)
  const end = [ev.effectiveTarget, asOf, ev.po.patDate ?? asOf].sort().at(-1)!
  const span = Math.max(1, diffDays(ptl.start, end))
  const x = (d: ISODate) => `${(diffDays(ptl.start, d) / span) * 100}%`
  const markers = [
    { d: ptl.targetPat, label: 'Target', cls: 'border-dashed border-muted' },
    ...(ev.ld.eotDays ? [{ d: ev.effectiveTarget, label: 'Extended', cls: 'border-dashed border-[var(--accent-2)]' }] : []),
    { d: asOf, label: 'Today', cls: 'border-solid border-[var(--accent)]' },
  ]
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3" role="img"
      aria-label={`Timeline ${fmtDate(ptl.start)} to ${fmtDate(end)}. ${MILESTONES.map(k => `${MILESTONE_LABEL[k]} ${ev.po.progress[k]}%`).join(', ')}.`}>
      <div />
      <div className="relative h-4 text-[10px] text-muted">
        {markers.map((m, i) => (
          <span key={m.label} className={`absolute whitespace-nowrap ${i === markers.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: x(m.d) }}>{m.label}</span>
        ))}
      </div>
      <ul className="contents">
        {MILESTONES.map(k => {
          const m = ptl.milestones[k]
          const p = ev.po.progress[k]
          return (
            <li key={k} className="contents">
              <div className="py-1.5 text-[11px] leading-tight">
                {MILESTONE_LABEL[k]}
                <span className="block text-muted">{p}% · plan {Math.round(plannedMilestonePct(ev.po, k, asOf))}%</span>
              </div>
              <div className="relative">
                {markers.map(mk => <div key={mk.label} className={`absolute inset-y-0 border-l ${mk.cls}`} style={{ left: x(mk.d) }} />)}
                <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-2 ring-1 ring-border" style={{ left: x(m.plannedStart), right: `calc(100% - ${x(m.plannedEnd)})` }}>
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: 'var(--brand-gradient)' }} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div /><p className="mt-1 flex justify-between text-[10px] text-muted"><span>{fmtDate(ptl.start)}</span><span>{fmtDate(end)}</span></p>
    </div>
  )
}
