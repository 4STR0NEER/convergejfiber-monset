import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { Check, CircleDashed, Clock, FileText, Send, TriangleAlert } from 'lucide-react'
import { repo } from '../../data/repo'
import { addMonths, fmtDate, monthEnd, monthOf, peso } from '../../domain/dates'
import {
  CLOSE_STEPS, closeDayIndex, closeSchedule, docsReport, draftGapAnalysis, emptyClose, falloutList, ldRecommendations,
  type CloseStepKey, type FalloutItem, type MonthClose,
} from '../../domain/monthEnd'
import { evaluateAll, STATUS_LABEL } from '../../domain/status'
import { currentPtl } from '../../domain/types'
import { useData } from '../../state'
import { Panel } from '../../ui/Panel'
import { StatusBadge } from '../../ui/status'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const periodName = (p: string) => `${MONTHS[+p.slice(5) - 1]} ${p.slice(0, 4)}`
const ME = 'Backbone PM (demo user)'

/** Loads and saves one period's close record. */
export function useClose(period: string) {
  const [close, setClose] = useState<MonthClose>(emptyClose(period))
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(false); repo.getClose(period).then(c => { setClose(c); setLoaded(true) }) }, [period])
  const update = useCallback((fn: (c: MonthClose) => MonthClose) => setClose(c => { const n = fn(c); repo.saveClose(n); return n }), [])
  return { close, update, loaded }
}

/** Everything a close needs, evaluated as of the period's last day. */
export function useCloseData(period: string) {
  const { snap, settings } = useData()
  return useMemo(() => {
    const evals = evaluateAll(snap, settings, monthEnd(period))
    const fallout = falloutList(evals, period)
    return { evals, fallout, recs: ldRecommendations(fallout), docs: docsReport(evals, period, settings.holidays) }
  }, [snap, settings, period])
}

export function MonthEnd() {
  const { snap, settings, can } = useData()
  const navigate = useNavigate()
  const params = useParams()
  const current = addMonths(monthOf(snap.asOf), -1)
  const period = params.period ?? current
  const { close, update, loaded } = useClose(period)
  const data = useCloseData(period)
  const schedule = closeSchedule(period, settings.holidays)
  const today = closeDayIndex(period, settings.holidays, snap.asOf)
  const legacy = today === 11 && !Object.keys(close.steps).length
  const stepOfToday = CLOSE_STEPS.findLast(s => s.from <= Math.min(10, Math.max(0, today)))!.key
  const [sel, setSel] = useState<CloseStepKey>(stepOfToday)
  useEffect(() => setSel(stepOfToday), [period]) // eslint-disable-line react-hooks/exhaustive-deps
  const markDone = (k: CloseStepKey) => update(c => ({ ...c, steps: { ...c.steps, [k]: { doneAt: new Date().toISOString(), by: ME } } }))
  const done = (k: CloseStepKey) => legacy || !!close.steps[k]

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Month-End Close</h1>
          <p className="mt-1 text-sm text-muted">
            {periodName(period)} · {today < 0 ? 'month still running' : today > 10 ? 'close window over' : `today is Day ${today}`}
            {' · '}{data.fallout.length} fallout POs · {peso(data.recs.reduce((a, r) => a + r.total, 0))} LD recommended
          </p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Close period</span>
          <select value={period} onChange={e => navigate(`/month-end/${e.target.value}`)} className="h-9 rounded-lg border border-border bg-surface px-3">
            {Array.from({ length: 6 }, (_, i) => addMonths(current, -i)).map(p => <option key={p} value={p}>{periodName(p)}{p === current ? ' (this close)' : ''}</option>)}
          </select>
        </label>
      </div>

      {legacy && <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted">This month was closed before the tracker went live. Lists and documents are rebuilt from the data so you can compare.</p>}

      <Stepper schedule={schedule} today={today} sel={sel} onSelect={setSel} done={done} />

      {!loaded ? <p className="mt-6 text-muted">Loading…</p> : (
        <div className="mt-6">
          {sel === 'declare' && <Declarations period={period} data={data} />}
          {sel === 'docs' && <Docs data={data} />}
          {sel === 'fallout' && <Fallout data={data} />}
          {sel === 'gap' && <Gap data={data} close={close} update={update} />}
          {sel === 'recommend' && <Recommend period={period} data={data} close={close} update={update} />}
          {sel === 'notice' && <Notices period={period} data={data} close={close} update={update} />}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
            <p className="text-[13px] text-muted">
              {done(sel) ? (close.steps[sel] ? `Done ${new Date(close.steps[sel]!.doneAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} by ${close.steps[sel]!.by}.` : 'Done before the tracker went live.')
                : `Due ${fmtDate(schedule.find(s => s.key === sel)!.end)}${schedule.find(s => s.key === sel)!.end < snap.asOf ? ' (overdue)' : ''}.${can('close.run') ? '' : ' Run by Converge-J Fiber Backbone Build / PMO.'}`}
            </p>
            {!done(sel) && can('close.run') && <button onClick={() => markDone(sel)} className="inline-flex items-center gap-1.5 rounded-lg bg-text px-4 py-2 text-[13px] font-semibold text-bg"><Check size={15} />Mark “{CLOSE_STEPS.find(s => s.key === sel)!.label.split(' ').slice(0, 3).join(' ')}…” done</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ schedule, today, sel, onSelect, done }: { schedule: ReturnType<typeof closeSchedule>; today: number; sel: CloseStepKey; onSelect: (k: CloseStepKey) => void; done: (k: CloseStepKey) => boolean }) {
  const { snap } = useData()
  const reduce = useReducedMotion()
  return (
    <ol className="mt-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Close steps">
      {schedule.map(s => {
        const active = sel === s.key
        const isToday = today >= s.from && today <= s.to
        const overdue = !done(s.key) && s.end < snap.asOf
        return (
          <li key={s.key} className="relative">
            <button onClick={() => onSelect(s.key)} aria-current={active ? 'step' : undefined}
              className={`relative h-full w-full rounded-2xl border p-3.5 text-left transition-colors duration-150 ${active ? 'border-[var(--accent)] bg-surface' : 'border-border bg-surface hover:bg-surface-2'}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Day {s.from}{s.to !== s.from ? `–${s.to}` : ''}</span>
                {done(s.key) ? <Check size={15} style={{ color: 'var(--st-ontrack)' }} aria-label="Done" />
                  : overdue ? <TriangleAlert size={15} style={{ color: 'var(--st-atrisk)' }} aria-label="Overdue" />
                  : isToday ? <Clock size={15} className="text-accent" aria-label="Today" />
                  : <CircleDashed size={15} className="text-muted" aria-label="Not started" />}
              </div>
              <p className="mt-1.5 text-[13px] font-medium leading-snug">{s.label}</p>
              <p className="mt-1 text-[11px] text-muted">{s.start === s.end ? fmtDate(s.start) : `${fmtDate(s.start)} to ${fmtDate(s.end)}`}</p>
            </button>
            {/* the brand wedge marks today's step, same language as the main nav */}
            {isToday && (
              <motion.span layoutId="close-today" aria-hidden="true" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute -top-[9px] left-1/2 h-[9px] w-[18px] -translate-x-1/2" style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 0)', background: 'var(--brand-gradient)' }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

type Data = ReturnType<typeof useCloseData>
const th = 'border-b border-border py-2 pr-3 text-xs font-medium text-muted'
const td = 'border-b border-border/60 py-2 pr-3'

function Declarations({ period, data }: { period: string; data: Data }) {
  const { snap } = useData()
  const accepted = data.evals.filter(e => e.po.patDate && monthOf(e.po.patDate) === period)
  return (
    <Panel title="Contractors declare actual PAT completions" sub={`${accepted.length} POs accepted in ${periodName(period)}, all documents ready`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead><tr>{['PO / WO', 'Route', 'Contractor', 'Target PAT', 'PAT', 'Result'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {accepted.map(e => (
              <tr key={e.po.id}>
                <td className={`${td} font-mono text-xs`}><Link to={`/po/${e.po.id}`} className="hover:underline">{e.po.id}</Link></td>
                <td className={td}>{e.po.title}</td>
                <td className={td}>{snap.contractors.find(c => c.id === e.po.contractorId)?.short}</td>
                <td className={td}>{fmtDate(e.effectiveTarget)}</td>
                <td className={td}>{fmtDate(e.po.patDate!)}</td>
                <td className={td}>{e.ld.lateDays ? `${e.ld.lateDays} days late` : 'On time'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accepted.length && <p className="py-4 text-sm text-muted">No completions declared for this month.</p>}
      </div>
    </Panel>
  )
}

function Docs({ data }: { data: Data }) {
  const { snap } = useData()
  const late = data.docs.filter(d => d.late)
  return (
    <Panel title="Late as-built documentation" sub={`Cutoff ${data.docs[0] ? new Date(data.docs[0].deadline).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) : 'Day 1, 11:59 PM'} · ${late.length} of ${data.docs.length} late. Feeds the contractor scorecards.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead><tr>{['PO / WO', 'Contractor', 'PAT', 'Docs submitted', 'Status'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {[...data.docs].sort((a, b) => Number(b.late) - Number(a.late)).map(d => (
              <tr key={d.ev.po.id}>
                <td className={`${td} font-mono text-xs`}>{d.ev.po.id}</td>
                <td className={td}>{snap.contractors.find(c => c.id === d.ev.po.contractorId)?.name}</td>
                <td className={td}>{fmtDate(d.ev.po.patDate!)}</td>
                <td className={td}>{d.ev.po.docsSubmittedAt ? `${fmtDate(d.ev.po.docsSubmittedAt.slice(0, 10))} ${d.ev.po.docsSubmittedAt.slice(11, 16)}` : '–'}</td>
                <td className={td}>{d.missing ? <Flag bad>Missing</Flag> : d.late ? <Flag bad>Late</Flag> : <Flag>On time</Flag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Flag({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${bad ? 'border-[color-mix(in_oklab,var(--st-delayed)_50%,transparent)] text-text' : 'border-border text-muted'}`}>
    {bad ? <TriangleAlert size={11} style={{ color: 'var(--st-delayed)' }} /> : <Check size={11} />}{children}</span>
}

function Fallout({ data }: { data: Data }) {
  const { snap } = useData()
  return (
    <Panel title="Fallout list" sub="Built automatically: POs that missed the target PAT on their live PTL, still open at month end or accepted late this month">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead><tr>{['PO / WO', 'Route', 'Contractor', 'Target PAT', 'At month end', 'Excused days', 'Their days', 'LD at month end', ''].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data.fallout.map(({ ev, newThisMonth, completedLate }) => (
              <tr key={ev.po.id}>
                <td className={`${td} font-mono text-xs`}><Link to={`/po/${ev.po.id}`} className="hover:underline">{ev.po.id}</Link></td>
                <td className={`${td} max-w-[220px] truncate`}>{ev.po.title}</td>
                <td className={td}>{snap.contractors.find(c => c.id === ev.po.contractorId)?.short}</td>
                <td className={td}>{fmtDate(currentPtl(ev.po).targetPat)}</td>
                <td className={td}>{completedLate ? `Accepted ${fmtDate(ev.po.patDate!)}` : <StatusBadge status={ev.status} />}</td>
                <td className={td}>{ev.ld.eotDays}</td>
                <td className={td}>{ev.ld.lateDays}</td>
                <td className={`${td} font-medium`}>{ev.ld.amount ? peso(ev.ld.amount) : 'No LD'}</td>
                <td className={`${td} text-xs text-muted`}>{newThisMonth ? 'New' : 'Carried over'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.fallout.length && <p className="py-4 text-sm text-muted">No fallout this month.</p>}
      </div>
    </Panel>
  )
}

function Gap({ data, close, update }: { data: Data; close: MonthClose; update: (fn: (c: MonthClose) => MonthClose) => void }) {
  const { snap, settings, can } = useData()
  const run = can('close.run')
  const reviewed = data.fallout.filter(f => close.gap[f.ev.po.id]?.reviewed).length
  const draft = (f: FalloutItem) => draftGapAnalysis(f, snap.updates, settings).lines.join('\n')
  const setGap = (id: string, p: Partial<{ text: string; reviewed: boolean }>, f: FalloutItem) =>
    update(c => ({ ...c, gap: { ...c.gap, [id]: { text: c.gap[id]?.text ?? draft(f), reviewed: c.gap[id]?.reviewed ?? false, ...p } } }))
  return (
    <Panel title="Gap analysis per fallout PO" sub={`Pre-drafted from field updates, the delay log and the LD engine. Edit, then mark reviewed with the contractor · ${reviewed} of ${data.fallout.length} reviewed`}>
      <ul className="space-y-4">
        {data.fallout.map(f => {
          const g = close.gap[f.ev.po.id]
          return (
            <li key={f.ev.po.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px]"><span className="font-mono text-xs text-muted">{f.ev.po.id}</span> · <span className="font-medium">{f.ev.po.title}</span> · {snap.contractors.find(c => c.id === f.ev.po.contractorId)?.short} · {STATUS_LABEL[f.ev.status]}</p>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" disabled={!run} checked={!!g?.reviewed} onChange={e => setGap(f.ev.po.id, { reviewed: e.target.checked }, f)} className="h-4 w-4 accent-[var(--brand-orange)]" />
                  Reviewed with contractor
                </label>
              </div>
              <textarea aria-label={`Gap analysis for ${f.ev.po.id}`} defaultValue={g?.text ?? draft(f)} rows={(g?.text ?? draft(f)).split(String.fromCharCode(10)).length + 1} readOnly={!run}
                onBlur={e => e.target.value !== (g?.text ?? draft(f)) && setGap(f.ev.po.id, { text: e.target.value }, f)}
                className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-[13px] leading-relaxed outline-none focus:border-[var(--accent)]" />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function Recommend({ period, data, close, update }: { period: string; data: Data; close: MonthClose; update: (fn: (c: MonthClose) => MonthClose) => void }) {
  const { snap, can } = useData()
  const run = can('close.run')
  const [waiving, setWaiving] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const total = data.recs.reduce((a, r) => a + r.items.filter(i => !close.waived[i.poId]).reduce((x, i) => x + i.amount, 0), 0)
  return (
    <Panel title="LD recommendations to PMO" sub={`Only contractor-attributable days are charged · ${peso(total)} across ${data.recs.length} contractors`}
      action={run && <Link to={`/month-end/${period}/recommendation`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-2"><FileText size={14} />Open document</Link>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.recs.map(r => {
          const sub = r.items.filter(i => !close.waived[i.poId]).reduce((a, i) => a + i.amount, 0)
          return (
            <section key={r.contractorId} className="rounded-xl border border-border p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[14px] font-semibold">{snap.contractors.find(c => c.id === r.contractorId)?.name}</h3>
                <span className="text-[15px] font-semibold">{peso(sub)}</span>
              </div>
              <ul className="mt-2 divide-y divide-border/60 text-[13px]">
                {r.items.map(i => (
                  <li key={i.poId} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={close.waived[i.poId] ? 'text-muted line-through' : ''}><span className="font-mono text-xs">{i.poId}</span> · {i.lateDays} day{i.lateDays === 1 ? '' : 's'} · {i.weeks} wk</span>
                      <span className="flex items-center gap-3">
                        <span className={close.waived[i.poId] ? 'text-muted line-through' : ''}>{peso(i.amount)}</span>
                        {!run ? null : close.waived[i.poId]
                          ? <button onClick={() => update(c => { const w = { ...c.waived }; delete w[i.poId]; return { ...c, waived: w } })} className="text-xs text-accent hover:underline">Charge</button>
                          : <button onClick={() => { setWaiving(i.poId); setReason('') }} className="text-xs text-muted hover:text-text">Waive…</button>}
                      </span>
                    </div>
                    {close.waived[i.poId] && <p className="mt-0.5 text-xs text-muted">Waived: {close.waived[i.poId]}</p>}
                    {waiving === i.poId && (
                      <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); if (!reason.trim()) return; update(c => ({ ...c, waived: { ...c.waived, [i.poId]: reason.trim() } })); setWaiving(null) }}>
                        <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (shown on the recommendation)" aria-label="Waiver reason" className="h-8 flex-1 rounded-lg border border-border bg-bg px-2 text-[13px]" />
                        <button className="rounded-lg bg-text px-3 text-xs font-medium text-bg">Waive</button>
                        <button type="button" onClick={() => setWaiving(null)} className="text-xs text-muted">Cancel</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {!data.recs.length && <p className="text-sm text-muted">No LD to recommend this month.</p>}
    </Panel>
  )
}

function Notices({ period, data, close, update }: { period: string; data: Data; close: MonthClose; update: (fn: (c: MonthClose) => MonthClose) => void }) {
  const { snap, can } = useData()
  const run = can('close.run'), mayAck = can('close.acknowledge')
  const [acking, setAcking] = useState<{ id: string; mode: 'ack' | 'dispute' } | null>(null)
  const [name, setName] = useState('')
  const recs = data.recs.map(r => ({ ...r, amount: r.items.filter(i => !close.waived[i.poId]).reduce((a, i) => a + i.amount, 0) })).filter(r => r.amount > 0)
  const acked = recs.filter(r => close.notices[r.contractorId]?.ack).length
  const setNotice = (id: string, p: MonthClose['notices'][string]) => update(c => ({ ...c, notices: { ...c.notices, [id]: { ...c.notices[id], ...p } } }))
  return (
    <Panel title="LD claim notices and acknowledgment" sub={`${acked} of ${recs.length} contractors have acknowledged`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead><tr>{['Contractor', 'LD claim', 'Notice', 'Acknowledgment', ''].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {recs.map(r => {
              const n = close.notices[r.contractorId] ?? {}
              const cname = snap.contractors.find(c => c.id === r.contractorId)?.name
              return (
                <tr key={r.contractorId}>
                  <th scope="row" className={`${td} font-medium`}>{cname}</th>
                  <td className={`${td} font-semibold`}>{peso(r.amount)}</td>
                  <td className={td}>{n.sentAt ? `Issued ${fmtDate(n.sentAt.slice(0, 10))}` : <span className="text-muted">Not issued</span>}</td>
                  <td className={td}>
                    {n.ack ? <Flag>{`${n.ack.name}, ${fmtDate(n.ack.at.slice(0, 10))}`}</Flag> : n.disputed ? <Flag bad>{`Disputed: ${n.disputed}`}</Flag> : <span className="text-muted">{n.sentAt ? 'Waiting' : '–'}</span>}
                    {acking?.id === r.contractorId && (
                      <form className="mt-2 flex gap-2" onSubmit={e => {
                        e.preventDefault(); if (!name.trim()) return
                        setNotice(r.contractorId, acking.mode === 'ack' ? { ack: { name: name.trim(), at: new Date().toISOString() }, disputed: undefined } : { disputed: name.trim() })
                        setAcking(null)
                      }}>
                        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={acking.mode === 'ack' ? 'Acknowledged by' : 'Dispute reason'} aria-label={acking.mode === 'ack' ? 'Acknowledged by' : 'Dispute reason'} className="h-8 w-48 rounded-lg border border-border bg-bg px-2 text-[13px]" />
                        <button className="rounded-lg bg-text px-3 text-xs font-medium text-bg">Save</button>
                      </form>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Link to={`/month-end/${period}/notice/${r.contractorId}`} className="mr-3 text-xs text-muted hover:text-text">Open notice</Link>
                    {!n.sentAt
                      ? run && <button onClick={() => setNotice(r.contractorId, { sentAt: new Date().toISOString() })} className="inline-flex items-center gap-1 rounded-lg bg-text px-2.5 py-1 text-xs font-medium text-bg"><Send size={12} />Issue</button>
                      : !n.ack && mayAck && <>
                        <button onClick={() => { setAcking({ id: r.contractorId, mode: 'ack' }); setName('') }} className="mr-2 text-xs font-medium text-accent">Record ack</button>
                        <button onClick={() => { setAcking({ id: r.contractorId, mode: 'dispute' }); setName('') }} className="text-xs text-muted">Dispute</button>
                      </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!recs.length && <p className="py-4 text-sm text-muted">No notices to issue.</p>}
      </div>
    </Panel>
  )
}
