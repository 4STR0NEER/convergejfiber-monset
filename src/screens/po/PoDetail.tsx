import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Camera, MapPin, Map as MapIcon } from 'lucide-react'
import { addMonths, diffDays, fmtDate, monthOf, monthStart, peso, type ISODate } from '../../domain/dates'
import { type PoEval } from '../../domain/status'
import { currentPtl, MILESTONE_LABEL, MILESTONES } from '../../domain/types'
import { useData } from '../../state'
import { ago } from '../../ui/format'
import LiquidGauge from '../../ui/kokonut/liquid-gauge'
import { Panel } from '../../ui/Panel'
import { photoUrl } from '../../ui/photo'
import { StatusBadge } from '../../ui/status'

export function PoDetail() {
  const { id } = useParams()
  const { byId, snap, settings, select } = useData()
  const navigate = useNavigate()
  const ev = id ? byId.get(id) : undefined
  if (!ev) return (
    <section className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold">PO not found</h1>
      <p className="mt-2 text-muted">No PO or WO numbered “{id}” in this portfolio.</p>
      <Link to="/portfolio" className="mt-4 inline-block text-accent hover:underline">Back to Portfolio</Link>
    </section>
  )
  const po = ev.po
  const name = <T extends { id: string; name: string }>(xs: T[], x: string) => xs.find(i => i.id === x)?.name ?? x
  const updates = snap.updates.filter(u => u.poId === po.id).sort((a, b) => b.at.localeCompare(a.at))
  const incidents = snap.incidents.filter(i => i.poId === po.id)
  const now = Date.now()
  const showOnMap = () => { select(po.id); navigate('/') }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-muted hover:text-text"><ArrowLeft size={15} />Portfolio</Link>
        <button onClick={showOnMap} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-2"><MapIcon size={14} />Show on map</button>
      </div>

      <header className="mt-4 grid gap-6 lg:grid-cols-[1fr_15rem]">
        <div>
          <p className="font-mono text-xs text-muted">{po.kind} {po.id} · PTL v{currentPtl(po).version}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight [text-wrap:balance]">{po.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {name(snap.programs, po.programId)} · {name(snap.clusters, po.clusterId)} · {name(snap.categories, po.categoryId)} · {name(snap.contractors, po.contractorId)}
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3">
            <StatusBadge status={ev.status} />
            <Fact label="Cost of works" value={peso(po.costOfWorks)} />
            <Fact label="Route length" value={`${po.lengthKm.toFixed(2)} km`} />
            <Fact label="Weighted progress" value={`${Math.round(ev.progressPct)}%`} />
            <Fact label={ev.ld.eotDays ? 'Extended target' : 'Target PAT'} value={fmtDate(ev.effectiveTarget)} />
            <Fact label={ev.activity === 'COMPLETED' ? 'PAT accepted' : ev.daysToTarget < 0 ? 'Days late' : 'Days to target'}
              value={ev.activity === 'COMPLETED' ? fmtDate(po.patDate!) : String(Math.abs(ev.daysToTarget))} />
            <Fact label="LD exposure" value={peso(ev.ld.amount)} accent={ev.ld.amount > 0} />
          </div>
          <ul className="mt-4 max-w-3xl space-y-1 text-[14px] leading-snug">{ev.why.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
        <LiquidGauge key={po.id} readOnly value={ev.health} label="Schedule health"
          statusText={ev.activity === 'COMPLETED' ? 'Accepted' : ev.gap > 0 ? `${Math.round(ev.gap)} pts behind plan` : 'On plan'} className="!h-44" />
      </header>

      <Panel className="mt-6" title="PTL baseline vs actual" sub="Outline = live PTL plan · fill = actual (to today if still running) · dashed outline = original PTL before rebaseline">
        <BigGantt ev={ev} asOf={snap.asOf} />
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Field update feed" sub="Every update carries a milestone, % progress, at least one photo, GPS and a timestamp">
          {updates.length ? (
            <ol className="space-y-5">
              {updates.map(u => {
                const crew = snap.crews.find(c => c.id === u.crewId)
                return (
                  <li key={u.id} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-[13px]"><span className="font-semibold">{MILESTONE_LABEL[u.milestone]} {u.progress}%</span> · {crew?.lead} (Crew {crew?.id})</p>
                      {u.note && <p className="mt-0.5 text-[13px] text-muted">“{u.note}”</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                        <span>{u.at.slice(0, 16).replace('T', ' ')} · {ago(u.at, now)}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={11} />{u.gps[1].toFixed(5)}, {u.gps[0].toFixed(5)}</span>
                        <span className="inline-flex items-center gap-1"><Camera size={11} />{u.photoIds.length} photo{u.photoIds.length > 1 ? 's' : ''}</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {u.photoIds.map(pid => (
                        <img key={pid} src={photoUrl(pid, `${u.at.slice(0, 16).replace('T', ' ')}  ${u.gps[1].toFixed(4)}, ${u.gps[0].toFixed(4)}`)}
                          alt={`${MILESTONE_LABEL[u.milestone]} photo, ${u.at.slice(0, 10)}`} className="h-20 w-28 rounded-lg object-cover" />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : <p className="text-sm text-muted">No field updates on file{ev.activity === 'COMPLETED' ? '. This PO was accepted before the tracker went live.' : '.'}</p>}
        </Panel>

        <div className="space-y-4">
          <Panel title="LD calculation" sub={`${settings.ldRatePerWeek * 100}% of cost of works per started week of contractor-attributable delay, capped at ${settings.ldCap * 100}%`}>
            <LdBreakdown ev={ev} />
          </Panel>
          <Panel title="Delay log">
            {ev.ld.periods.length ? (
              <table className="w-full text-left text-[13px]">
                <thead className="text-xs text-muted"><tr>{['Reason', 'From', 'To', 'Days', 'LD'].map(h => <th key={h} scope="col" className="border-b border-border py-1.5 pr-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {ev.ld.periods.map(p => (
                    <tr key={p.reasonCode + p.start} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-2">{p.label}</td>
                      <td className="py-1.5 pr-2">{fmtDate(p.start)}</td>
                      <td className="py-1.5 pr-2">{p.end === snap.asOf && !ev.ld.clockStopped ? 'open' : fmtDate(p.end)}</td>
                      <td className="py-1.5 pr-2">{p.days}</td>
                      <td className="py-1.5">{p.ldEligible ? 'Subject' : 'Excused'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted">No blockers reported.</p>}
            {snap.delays.filter(d => d.poId === po.id && d.note).slice(0, 2).map(d => <p key={d.id} className="mt-2 text-xs text-muted">{d.reportedBy}: “{d.note}”</p>)}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Milestone history">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="text-xs text-muted"><tr>{['Milestone', 'Planned', 'Actual start', 'Actual end', 'Progress'].map(h => <th key={h} scope="col" className="border-b border-border py-1.5 pr-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {MILESTONES.map(k => {
                  const m = currentPtl(po).milestones[k], a = po.milestoneActual[k]
                  return (
                    <tr key={k} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="py-1.5 pr-2 font-medium">{MILESTONE_LABEL[k]}</th>
                      <td className="py-1.5 pr-2 text-muted">{fmtDate(m.plannedStart)} to {fmtDate(m.plannedEnd)}</td>
                      <td className="py-1.5 pr-2">{a?.start ? fmtDate(a.start) : '–'}</td>
                      <td className="py-1.5 pr-2">{a?.end ? fmtDate(a.end) : '–'}</td>
                      <td className="py-1.5">{ev.activity === 'COMPLETED' ? 100 : po.progress[k]}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="PTL versions" sub="Signed baselines; the latest one drives status and LD">
          <ol className="space-y-3 text-[13px]">
            {[...po.ptl].reverse().map(v => (
              <li key={v.version} className="flex gap-3">
                <span className={`mt-0.5 h-fit rounded-md px-1.5 py-0.5 font-mono text-[11px] ${v === currentPtl(po) ? 'bg-surface-2 text-text' : 'text-muted ring-1 ring-border'}`}>v{v.version}</span>
                <div>
                  <p>Signed {fmtDate(v.signedAt)} · start {fmtDate(v.start)} · target PAT <span className="font-medium">{fmtDate(v.targetPat)}</span></p>
                  {v.note && <p className="text-muted">{v.note}</p>}
                </div>
              </li>
            ))}
          </ol>
          {incidents.length > 0 && (
            <div className="mt-4 border-t border-border pt-3 text-[13px]">
              <p className="mb-1 text-xs font-semibold text-muted">Third-party damage on this route</p>
              {incidents.map(i => <p key={i.id}><span className="font-mono text-xs">{i.id}</span> · {i.responsibleParty}. {i.description}</p>)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-[15px] font-semibold ${accent ? 'text-accent' : ''}`}>{value}</p>
    </div>
  )
}

/** Baseline vs actual per milestone, with month ticks and target/today/PAT markers. */
function BigGantt({ ev, asOf }: { ev: PoEval; asOf: ISODate }) {
  const po = ev.po
  const ptl = currentPtl(po), v1 = po.ptl[0]
  const start = [ptl.start, v1.start].sort()[0]
  const end = [ev.effectiveTarget, asOf, po.patDate ?? asOf, ptl.targetPat].sort().at(-1)!
  const span = Math.max(1, diffDays(start, end))
  const pos = (d: ISODate) => (diffDays(start, d) / span) * 100
  const x = (d: ISODate) => `${pos(d)}%`
  const months: ISODate[] = []
  for (let m = addMonths(monthOf(start), 1); monthStart(m) <= end; m = addMonths(m, 1)) months.push(monthStart(m))
  const markers = [
    ...(po.ptl.length > 1 ? [{ d: v1.targetPat, label: 'Original target', cls: 'border-dotted border-muted' }] : []),
    { d: ptl.targetPat, label: 'Target', cls: 'border-dashed border-muted' },
    ...(ev.ld.eotDays ? [{ d: ev.effectiveTarget, label: `Extended +${ev.ld.eotDays}d`, cls: 'border-dashed border-[var(--accent-2)]' }] : []),
    ...(po.patDate && po.patDate <= asOf ? [{ d: po.patDate, label: 'PAT', cls: 'border-solid border-[var(--st-ontrack)]' }] : []),
    { d: asOf, label: 'Today', cls: 'border-solid border-[var(--accent)]' },
  ]
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[8.5rem_1fr] gap-x-4" role="img"
        aria-label={`PTL from ${fmtDate(ptl.start)} to target ${fmtDate(ptl.targetPat)}. ${MILESTONES.map(k => `${MILESTONE_LABEL[k]} ${po.progress[k]}%`).join(', ')}.`}>
        <div />
        <div className="relative h-10 text-[10px] text-muted">
          {months.map(m => <span key={m} className={`absolute top-0 whitespace-nowrap ${pos(m) > 92 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: x(m) }}>{fmtDate(m).split(' ')[1]} ’{m.slice(2, 4)}</span>)}
          {markers.map((m, i) => (
            <span key={m.label} className={`absolute top-4 whitespace-nowrap font-medium text-text ${pos(m.d) > 85 ? '-translate-x-full' : pos(m.d) < 10 ? '' : '-translate-x-1/2'}`}
              style={{ left: x(m.d), top: 16 + (i % 2) * 11 }}>{m.label}</span>
          ))}
        </div>
        {MILESTONES.map(k => {
          const plan = ptl.milestones[k], orig = v1.milestones[k], a = po.milestoneActual[k]
          const p = ev.activity === 'COMPLETED' ? 100 : po.progress[k]
          const actEnd = a?.end ?? (a?.start ? asOf : undefined)
          return (
            <div key={k} className="contents">
              <div className="border-t border-border/60 py-3 text-[13px]">
                <p className="font-medium">{MILESTONE_LABEL[k]}</p>
                <p className="text-xs text-muted">{p}% · plan {Math.round(Math.min(100, Math.max(0, (diffDays(plan.plannedStart, asOf) / Math.max(1, diffDays(plan.plannedStart, plan.plannedEnd))) * 100)))}%</p>
              </div>
              <div className="relative border-t border-border/60">
                {months.map(m => <div key={m} className="absolute inset-y-0 border-l border-border/50" style={{ left: x(m) }} />)}
                {markers.map(m => <div key={m.label} className={`absolute inset-y-0 border-l-2 ${m.cls}`} style={{ left: x(m.d) }} />)}
                {po.ptl.length > 1 && (
                  <div className="absolute top-2 h-3 rounded-[4px] border border-dashed border-muted/70" style={{ left: x(orig.plannedStart), width: `${pos(orig.plannedEnd) - pos(orig.plannedStart)}%` }} title="Original PTL" />
                )}
                <div className="absolute top-[22px] h-3.5 rounded-[4px] bg-surface-2 ring-1 ring-[color-mix(in_oklab,var(--text)_30%,transparent)]"
                  style={{ left: x(plan.plannedStart), width: `${Math.max(0.5, pos(plan.plannedEnd) - pos(plan.plannedStart))}%` }} title="Live PTL plan" />
                {a?.start && actEnd && (
                  <div className="absolute top-[24px] h-2.5 rounded-[3px]" title="Actual"
                    style={{ left: x(a.start), width: `${Math.max(0.6, pos(actEnd) - pos(a.start))}%`, background: 'var(--brand-gradient)' }} />
                )}
              </div>
            </div>
          )
        })}
        <div />
        <div className="flex justify-between border-t border-border/60 pt-1.5 text-[10px] text-muted"><span>{fmtDate(start)}</span><span>{fmtDate(end)}</span></div>
      </div>
    </div>
  )
}

/** Day strip from the PTL target to the stop date: excused days push the target, the rest is charged in started weeks. */
function LdBreakdown({ ev }: { ev: PoEval }) {
  const { settings } = useData()
  const ld = ev.ld
  const total = Math.max(1, ld.eotDays + ld.lateDays)
  return (
    <>
      <p className="text-3xl font-semibold tracking-tight">{peso(ld.amount)}</p>
      <p className="mt-1 text-xs text-muted">
        {ld.clockStopped ? `Final. Clock stopped at PAT on ${fmtDate(ld.stopDate)}.` : ld.lateDays ? `Accruing. Week ${ld.weeks + 1} starts in ${7 * ld.weeks - ld.lateDays + 1} day(s).` : 'Nothing accrued.'}
      </p>
      {(ld.eotDays > 0 || ld.lateDays > 0) && (
        <div className="mt-4">
          <div className="flex h-6 gap-[2px] overflow-hidden rounded-[4px] text-[10px] font-semibold">
            {ld.eotDays > 0 && (
              <div className="grid place-items-center text-muted" title={`${ld.eotDays} excused days`}
                style={{ flexGrow: ld.eotDays, background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 5px, color-mix(in oklab, var(--text) 14%, transparent) 5px 7px)' }}>
                {ld.eotDays / total > 0.18 && `${ld.eotDays}d excused`}
              </div>
            )}
            {Array.from({ length: ld.weeks }, (_, w) => {
              const days = Math.min(7, ld.lateDays - w * 7)
              return (
                <div key={w} className="grid place-items-center" title={`Week ${w + 1}: ${days} day(s)`}
                  style={{ flexGrow: days, background: 'var(--st-delayed)', color: 'var(--on-status)', opacity: days < 7 ? 0.75 : 1 }}>
                  {days / total > 0.06 && `wk ${w + 1}`}
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>Target {fmtDate(ld.baseTarget)}</span><span>{ld.clockStopped ? 'PAT' : 'Today'} {fmtDate(ld.stopDate)}</span></div>
        </div>
      )}
      <dl className="mt-4 space-y-1 text-[13px]">
        <Row k="PTL target PAT" v={fmtDate(ld.baseTarget)} />
        <Row k="+ excused days (not subject to LD)" v={`${ld.eotDays}`} />
        <Row k="= extended target" v={fmtDate(ld.effectiveTarget)} />
        <Row k="Contractor-attributable days late" v={`${ld.lateDays}`} />
        <Row k="Started weeks (part week = full week)" v={`${ld.weeks}`} />
        <Row k={`${ld.weeks} × ${settings.ldRatePerWeek * 100}% × ${peso(ev.po.costOfWorks)}`} v={peso(ld.rawAmount)} />
        <Row k={`Cap at ${settings.ldCap * 100}%`} v={peso(ld.capAmount)} />
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>LD {ld.capped ? '(capped)' : ''}</dt><dd>{peso(ld.amount)}</dd></div>
      </dl>
    </>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
