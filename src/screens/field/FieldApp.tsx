// Crew app. Mobile-first, offline-first. On desktop it runs inside a phone frame with a short explainer.
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CircleAlert, CloudOff, CloudUpload, Hammer, Plus, RefreshCw, TriangleAlert, Wifi } from 'lucide-react'
import { fmtDate } from '../../domain/dates'
import { MILESTONE_LABEL, MILESTONES } from '../../domain/types'
import { useData } from '../../state'
import { ago } from '../../ui/format'
import { Qr } from '../../ui/Qr'
import { Sheet } from '../../ui/Sheet'
import { StatusBadge } from '../../ui/status'
import { BlockerForm, IncidentForm, UpdateForm, type FormKind } from './FieldForms'
import { flushOutbox, useOnline, useOutbox } from './proof'
import { outbox } from '../../data/outbox'

const CREW_KEY = 'cjf.field.crew'
const OFFLINE_KEY = 'cjf.field.simOffline'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* not persisted */ } }

export function FieldPage() {
  const frame = useRef<HTMLDivElement>(null)
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null)
  useEffect(() => setFrameEl(frame.current), [])
  return (
    <>
      {/* Phone: the app is the page. */}
      <div className="md:hidden"><FieldApp /></div>
      {/* Desktop: the same app inside a phone frame, plus a short explainer. */}
      <div className="mx-auto hidden max-w-6xl items-start gap-12 px-6 py-8 md:flex">
        <div ref={frame} className="relative h-[820px] w-[400px] shrink-0 overflow-hidden rounded-[44px] border-[10px] border-[var(--brand-black)] bg-bg shadow-[var(--shadow)] ring-1 ring-border">
          {frameEl && <div className="h-full overflow-y-auto"><FieldApp within={frameEl} /></div>}
        </div>
        <Explainer />
      </div>
    </>
  )
}

function Explainer() {
  const url = `${location.origin}/field`
  return (
    <section className="max-w-md pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Field App</h1>
      <p className="mt-2 text-muted">What a crew lead sees on the phone. Installable, and it keeps working with no signal.</p>
      <ul className="mt-6 space-y-3 text-[14px]">
        <li><span className="font-semibold">Proof first.</span> Every update needs a milestone, % progress, at least one photo, a GPS fix and a timestamp. A fix far from the PO's route is flagged to the office.</li>
        <li><span className="font-semibold">Blockers tagged at the source.</span> The crew picks the reason code and sees at once whether it counts toward LD or moves the target.</li>
        <li><span className="font-semibold">Offline outbox.</span> Submissions are saved on the phone first and sent in order when there is signal. Try the "Simulate no signal" switch in the app.</li>
        <li><span className="font-semibold">Incidents pre-filled</span> from the crew, PO and route, with the responsible party signing on the phone.</li>
      </ul>
      <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border p-4">
        <Qr text={url} size={112} label={`QR code to open ${url}`} />
        <p className="text-[13px] text-muted">Scan to open the crew app on a phone on the same network. <span className="block font-mono text-xs text-text">{url}</span></p>
      </div>
    </section>
  )
}

export function FieldApp({ within }: { within?: HTMLElement | null }) {
  const { snap, byId, setSnap, settings, session, can, signOut } = useData()
  const reduce = useReducedMotion()
  // Ground team are locked to their own crew; managers can view their contractor's crews, admin any crew.
  const crews = snap.crews
  const switchable = can('field.switchCrew')
  const busiest = [...crews].sort((a, b) => b.poIds.filter(id => !byId.get(id)?.po.patDate).length - a.poIds.filter(id => !byId.get(id)?.po.patDate).length)[0]
  const [crewId, setCrewId] = useState(() => (switchable ? read(CREW_KEY) : session?.crewId) ?? busiest?.id)
  const crew = crews.find(c => c.id === crewId) ?? busiest
  const [simOffline, setSimOffline] = useState(() => read(OFFLINE_KEY) === '1')
  const netOnline = useOnline()
  const online = netOnline && !simOffline
  const items = useOutbox()
  const [form, setForm] = useState<{ kind: FormKind; poId: string } | null>(null)
  const [sheet, setSheet] = useState<'actions' | 'outbox' | 'menu' | null>(null)
  const onlineRef = useRef(online)
  onlineRef.current = online
  const closeForm = useCallback(() => setForm(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const flush = useCallback(() => flushOutbox(() => onlineRef.current, setSnap), [setSnap])
  const pending = items.filter(i => i.status !== 'sent')
  useEffect(() => { if (online && pending.some(i => i.status === 'queued' || i.status === 'failed')) flush() }, [online, pending.length, flush]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastSent = items.filter(i => i.sentAt).map(i => i.sentAt!).sort().at(-1)
  const sending = items.find(i => i.status === 'sending')
  const now = Date.now()
  if (!crew) return <p className="p-6 text-sm text-muted">No crew is linked to this account yet. Ask Backbone Build to assign you to a crew.</p>
  const mine = crew.poIds.map(id => byId.get(id)!).filter(Boolean)
  const msp = snap.contractors.find(c => c.id === crew.contractorId)!
  const open = (kind: FormKind, poId = mine[0].po.id) => { setSheet(null); setForm({ kind, poId }) }

  return (
    <div className="relative min-h-full bg-bg pb-28">
      {/* app bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => setSheet('menu')} aria-label="Account and settings"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: 'var(--brand-gradient)' }}>
            {crew.lead.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-semibold">{crew.lead}</p>
            <p className="truncate text-xs text-muted">Crew {crew.id} · {msp.name}</p>
          </div>
          <button onClick={() => setSheet('outbox')} aria-label="Outbox"
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${online ? 'border-border' : 'border-[var(--st-atrisk)] text-[var(--st-atrisk)]'}`}>
            {!online ? <CloudOff size={14} /> : sending ? <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" /> : pending.length ? <CloudUpload size={14} /> : <Wifi size={14} style={{ color: 'var(--st-ontrack)' }} />}
            {!online ? `No signal${pending.length ? ` · ${pending.length}` : ''}` : sending ? 'Sending…' : pending.length ? `${pending.length} to send` : 'All sent'}
          </button>
        </div>
      </header>

      <main className="px-4 pt-4">
        <h2 className="text-lg font-semibold tracking-tight">My POs</h2>
        <p className="text-xs text-muted">
          {mine.length} assigned{lastSent ? ` · last sent ${ago(lastSent, now)}` : ''}{!online && ' · working offline'}
        </p>
        <ul className="mt-3 space-y-3">
          {mine.map((ev, i) => {
            const k = [...MILESTONES].reverse().find(m => ev.po.progress[m] > 0) ?? 'ENG'
            return (
              <motion.li key={ev.po.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted">{ev.po.kind} {ev.po.id}</p>
                    <p className="text-[15px] font-semibold leading-snug">{ev.po.title}</p>
                  </div>
                  <StatusBadge status={ev.status} />
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs"><span>{MILESTONE_LABEL[k]}</span><span className="font-semibold">{ev.po.progress[k]}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${ev.po.progress[k]}%`, background: 'var(--brand-gradient)' }} /></div>
                  <p className="mt-1.5 text-xs text-muted">
                    {ev.activity === 'COMPLETED' ? `Accepted ${fmtDate(ev.po.patDate!)}` : ev.daysToTarget < 0 ? `${-ev.daysToTarget} days past target` : `${ev.daysToTarget} days to target (${fmtDate(ev.effectiveTarget)})`}
                  </p>
                  {ev.openBlockers.map(b => (
                    <div key={b.id} className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-[var(--st-atrisk)]"><TriangleAlert size={12} />Blocked: {settings.reasons.find(r => r.code === b.reasonCode)?.label ?? b.reasonCode} since {fmtDate(b.start)}</span>
                      <button onClick={() => outbox.add({ kind: 'blocker', delay: { ...b, end: new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10) } })}
                        className="shrink-0 rounded-full border border-border px-2.5 py-1 font-medium text-text">Cleared today</button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
                  <button onClick={() => open('update', ev.po.id)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-text text-[14px] font-semibold text-bg"><Hammer size={16} />Update</button>
                  <button onClick={() => open('blocker', ev.po.id)} className="h-11 rounded-xl border border-border px-3 text-[13px] font-medium">Blocker</button>
                  <button onClick={() => open('incident', ev.po.id)} className="h-11 rounded-xl border border-border px-3 text-[13px] font-medium">Damage</button>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </main>

      <button onClick={() => setSheet('actions')} aria-label="Report"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-20 flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-white shadow-[var(--shadow)] md:absolute"
        style={{ background: 'var(--brand-gradient)' }}>
        <Plus size={20} />Report
      </button>

      <Sheet within={within} open={sheet === 'actions'} title="Report" onClose={closeSheet}>
        <div className="space-y-2 pb-2">
          {([['update', 'Progress update', 'Milestone, %, photos'], ['blocker', 'Blocker', 'Something stopping the work'], ['incident', 'Third-party damage', 'Someone else damaged the line']] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => open(k)} className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3.5 text-left hover:bg-surface-2">
              <span><span className="block text-[15px] font-semibold">{t}</span><span className="text-xs text-muted">{d}</span></span>
              <CircleAlert size={18} className={k === 'incident' ? 'text-bad' : 'text-muted'} />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet within={within} open={sheet === 'outbox'} title="Outbox" onClose={closeSheet}>
        <p className="text-[13px] text-muted">Everything is saved on this phone first, then sent in order when there is signal.</p>
        {online && pending.length > 0 && <button onClick={flush} className="mt-3 w-full rounded-xl border border-border py-2.5 text-sm font-medium">Send now</button>}
        <ul className="mt-3 divide-y divide-border pb-2 text-[13px]">
          {[...items].reverse().map(i => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.sub.kind === 'update' ? `Update ${MILESTONE_LABEL[i.sub.update.milestone]} ${i.sub.update.progress}%` : i.sub.kind === 'blocker' ? `Blocker ${i.sub.delay.end ? 'cleared' : 'reported'}: ${i.sub.delay.reasonCode}` : `Incident ${i.sub.incident.id}`}</span>
                <span className="text-xs text-muted">{i.sub.kind === 'update' ? i.sub.update.poId : i.sub.kind === 'blocker' ? i.sub.delay.poId : i.sub.incident.poId} · saved {ago(i.createdAt, now)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${i.status === 'sent' ? 'bg-surface-2 text-muted' : i.status === 'failed' ? 'text-bad' : 'text-[var(--st-atrisk)]'}`}>
                {i.status === 'sent' ? 'Sent' : i.status === 'sending' ? 'Sending…' : i.status === 'failed' ? 'Failed, will retry' : 'Waiting for signal'}
              </span>
            </li>
          ))}
          {!items.length && <li className="py-6 text-center text-muted">Nothing sent from this phone yet.</li>}
        </ul>
      </Sheet>

      <Sheet within={within} open={sheet === 'menu'} title="Account and settings" onClose={closeSheet}>
        <p className="text-[13px] text-muted">Signed in as <span className="font-medium text-text">{session?.name}</span></p>
        {switchable && (
          <label className="mt-3 block text-[13px] font-medium">Viewing crew
            <select value={crew.id} onChange={e => { setCrewId(e.target.value); write(CREW_KEY, e.target.value) }} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[15px]">
              {crews.map(c => <option key={c.id} value={c.id}>{c.lead} · Crew {c.id} · {snap.contractors.find(x => x.id === c.contractorId)?.short}</option>)}
            </select>
          </label>
        )}
        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3 pb-3 text-[14px]">
          <span><span className="block font-medium">Simulate no signal</span><span className="text-xs text-muted">Demo: submissions wait in the outbox until you turn this off.</span></span>
          <input type="checkbox" role="switch" checked={simOffline} onChange={e => { setSimOffline(e.target.checked); write(OFFLINE_KEY, e.target.checked ? '1' : '0') }} className="h-6 w-6 accent-[var(--brand-orange)]" />
        </label>
        {!netOnline && <p className="mt-2 text-xs text-[var(--st-atrisk)]">This device is actually offline right now.</p>}
        <button onClick={signOut} className="mt-4 w-full rounded-xl border border-border py-3 text-[15px] font-medium">Sign out</button>
        {pending.length > 0 && <p className="mt-2 text-xs text-muted">{pending.length} item{pending.length > 1 ? 's' : ''} still waiting to send stay on this phone and send after the next sign-in.</p>}
        <div className="h-4" />
      </Sheet>

      <Sheet within={within} open={!!form} title={form?.kind === 'update' ? 'Progress update' : form?.kind === 'blocker' ? 'Report a blocker' : 'Third-party damage'} onClose={closeForm}>
        {form?.kind === 'update' && <UpdateForm key={form.poId} crew={crew} poId={form.poId} online={online} onDone={closeForm} />}
        {form?.kind === 'blocker' && <BlockerForm key={form.poId} crew={crew} poId={form.poId} online={online} onDone={closeForm} />}
        {form?.kind === 'incident' && <IncidentForm key={form.poId} crew={crew} poId={form.poId} online={online} onDone={closeForm} />}
      </Sheet>
    </div>
  )
}
