import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Camera, Crosshair, ImagePlus, LocateFixed, MapPinOff, ShieldAlert, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { outbox } from '../../data/outbox'
import { fmtDate } from '../../domain/dates'
import { distanceToRoute, reasonImpact, validateUpdate } from '../../domain/field'
import { MILESTONE_LABEL, MILESTONES, type Crew, type MilestoneKey } from '../../domain/types'
import { useData } from '../../state'
import { CheckDraw } from '../../ui/CheckDraw'
import { compressPhoto, photoSrc } from '../../ui/photo'
import { SignaturePad } from '../../ui/SignaturePad'
import { SlideToConfirm } from '../../ui/SlideToConfirm'
import { nowManila, shortId, useGps, type Fix } from './proof'

export type FormKind = 'update' | 'blocker' | 'incident'
interface FormProps { crew: Crew; poId: string; online: boolean; onDone: () => void }

const field = 'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]'

// ---------------------------------------------------------------- shared pieces

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium">{children}{hint && <span className="text-xs font-normal text-muted">{hint}</span>}</span>
}

function PoPicker({ crew, value, onChange }: { crew: Crew; value: string; onChange: (id: string) => void }) {
  const { byId } = useData()
  return (
    <label className="block">
      <Label>PO / WO</Label>
      <select value={value} onChange={e => onChange(e.target.value)} className={field}>
        {crew.poIds.map(id => <option key={id} value={id}>{id} · {byId.get(id)?.po.title}</option>)}
      </select>
    </label>
  )
}

function Photos({ value, onChange, required = true, label = 'Photos' }: { value: string[]; onChange: (v: string[]) => void; required?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try { onChange([...value, ...(await Promise.all([...files].slice(0, 4).map(f => compressPhoto(f))))]) } finally { setBusy(false) }
  }
  return (
    <div>
      <Label hint={required ? 'at least one' : 'optional'}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={i} className="relative">
            <img src={photoSrc(p, 'sample photo')} alt={`Photo ${i + 1}`} className="h-20 w-24 rounded-lg object-cover" />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border border-border bg-surface"><Trash2 size={13} /></button>
          </div>
        ))}
        <label className="grid h-20 w-24 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted hover:text-text focus-within:border-[var(--accent)]">
          <span className="flex flex-col items-center gap-1 text-[11px]"><Camera size={20} />{busy ? 'Saving…' : 'Take photo'}</span>
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={e => add(e.target.files)} />
        </label>
      </div>
      <button type="button" onClick={() => onChange([...value, `demo-${Date.now()}`])} className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
        <ImagePlus size={12} />No camera here? Add a sample photo (demo)
      </button>
    </div>
  )
}

function GpsProof({ poId, fix, state, locate, useRoutePoint }: { poId: string } & ReturnType<typeof useGps>) {
  const { network } = useData()
  const dist = fix ? distanceToRoute(network, poId, fix.gps) : null
  const [now, setNow] = useState(nowManila())
  useEffect(() => { const t = setInterval(() => setNow(nowManila()), 15_000); return () => clearInterval(t) }, [])
  return (
    <div className="rounded-xl border border-border bg-bg p-3 text-[13px]">
      <div className="flex items-start gap-2.5">
        {state === 'ok' ? <LocateFixed size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--st-ontrack)' }} />
          : state === 'locating' ? <Crosshair size={18} className="mt-0.5 shrink-0 animate-pulse text-muted" />
          : <MapPinOff size={18} className="mt-0.5 shrink-0 text-bad" />}
        <div className="min-w-0 flex-1">
          {state === 'ok' && fix ? (
            <>
              <p className="font-medium">{fix.gps[1].toFixed(5)}, {fix.gps[0].toFixed(5)}{fix.accuracyM ? ` · ±${fix.accuracyM} m` : ''}</p>
              {fix.source === 'route-demo' && <p className="text-xs text-[var(--st-atrisk)]">Placed on the route (demo, no device GPS). The office sees this flag.</p>}
              {dist !== null && fix.source === 'device' && (
                <p className={`text-xs ${dist > 0.5 ? 'text-[var(--st-atrisk)]' : 'text-muted'}`}>
                  {dist > 0.5 ? `${dist.toFixed(1)} km from this PO's route. The office will see this flag.` : `${Math.round(dist * 1000)} m from the PO route`}
                </p>
              )}
            </>
          ) : state === 'locating' ? <p>Getting a GPS fix…</p> : (
            <>
              <p className="font-medium">No GPS fix</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <button type="button" onClick={locate} className="font-medium text-accent">Try again</button>
                <button type="button" onClick={useRoutePoint} className="text-muted underline">Use route point (demo)</button>
              </div>
            </>
          )}
          <p className="mt-0.5 text-xs text-muted">Timestamp {now.slice(0, 16).replace('T', ' ')} (added automatically)</p>
        </div>
      </div>
    </div>
  )
}

function Problems({ list }: { list: string[] }) {
  if (!list.length) return null
  return <ul className="space-y-0.5 text-xs text-muted" aria-live="polite">{list.map(p => <li key={p} className="flex items-center gap-1.5"><TriangleAlert size={12} />{p}</li>)}</ul>
}

export function Done({ online, what, onDone }: { online: boolean; what: string; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center px-2 pb-4 pt-4 text-center" role="status">
      <CheckDraw />
      <p className="mt-4 text-lg font-semibold">{online ? `${what} queued` : `${what} saved on this phone`}</p>
      <p className="mt-1 max-w-[280px] text-sm text-muted">
        {online ? 'Sending now. You can keep working.' : 'No signal. It will send by itself when you are back online.'}
      </p>
      <button onClick={onDone} className="mt-6 w-full rounded-xl bg-text py-3.5 text-[15px] font-semibold text-bg">Back to my POs</button>
    </div>
  )
}

const proofFields = (fix: Fix | null, poId: string, network: ReturnType<typeof useData>['network']) => fix ? {
  gps: fix.gps, gpsSource: fix.source, gpsAccuracyM: fix.accuracyM,
  distanceToRouteKm: distanceToRoute(network, poId, fix.gps) ?? undefined,
} : { gps: [0, 0] as [number, number] }

// ---------------------------------------------------------------- update

export function UpdateForm({ crew, poId: initial, online, onDone }: FormProps) {
  const { byId, network } = useData()
  const [poId, setPoId] = useState(initial)
  const po = byId.get(poId)!.po
  const current = ([...MILESTONES].reverse().find(k => po.progress[k] > 0 && po.progress[k] < 100) ?? MILESTONES.find(k => po.progress[k] < 100) ?? 'FOC') as MilestoneKey
  const [milestone, setMilestone] = useState<MilestoneKey>(current)
  const [progress, setProgress] = useState(po.progress[current])
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const gps = useGps(network, poId)
  useEffect(() => { setProgress(po.progress[milestone]) }, [milestone, poId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = { id: shortId('UP'), poId, crewId: crew.id, milestone, progress, photoIds: photos, at: nowManila(), note: note.trim() || undefined, ...proofFields(gps.fix, poId, network) }
  const problems = validateUpdate(update)
  if (sent) return <Done online={online} what="Update" onDone={onDone} />

  return (
    <form className="space-y-5 pb-4" onSubmit={e => e.preventDefault()}>
      <PoPicker crew={crew} value={poId} onChange={setPoId} />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Milestone</legend>
        <div className="grid grid-cols-2 gap-2">
          {MILESTONES.map(k => (
            <label key={k} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-[14px] ${milestone === k ? 'border-[var(--accent)] bg-surface-2 font-semibold' : 'border-border'}`}>
              <input type="radio" name="milestone" value={k} checked={milestone === k} onChange={() => setMilestone(k)} className="sr-only" />
              {MILESTONE_LABEL[k]}<span className="block text-xs font-normal text-muted">now {po.progress[k]}%</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <Label hint={`was ${po.progress[milestone]}%`}>Progress</Label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={100} step={5} value={progress} onChange={e => setProgress(+e.target.value)} className="h-2 flex-1 accent-[var(--brand-orange)]" />
          <span className="w-16 text-right text-2xl font-semibold tabular-nums">{progress}%</span>
        </div>
        {progress < po.progress[milestone] && <p className="mt-1 text-xs text-[var(--st-atrisk)]">Lower than the last report. Add a note saying why.</p>}
      </label>
      <Photos value={photos} onChange={setPhotos} />
      <GpsProof poId={poId} {...gps} />
      <label className="block">
        <Label hint="optional">Note</Label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={field} placeholder="What was done today" />
      </label>
      <Problems list={problems} />
      <SlideToConfirm label="Slide to send update" disabled={problems.length > 0}
        onConfirm={async () => { await outbox.add({ kind: 'update', update }); setSent(true) }} />
    </form>
  )
}

// ---------------------------------------------------------------- blocker

export function BlockerForm({ crew, poId: initial, online, onDone }: FormProps) {
  const { network, settings, byId } = useData()
  const [poId, setPoId] = useState(initial)
  const [code, setCode] = useState('')
  const [milestone, setMilestone] = useState<MilestoneKey>('ROW')
  const [start, setStart] = useState(nowManila().slice(0, 10))
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const gps = useGps(network, poId)
  const impact = code ? reasonImpact(code, settings) : null
  const groups = useMemo(() => [
    { title: 'Not the contractor’s fault (no LD)', items: settings.reasons.filter(r => !r.ldEligible) },
    { title: 'Contractor side (counts toward LD)', items: settings.reasons.filter(r => r.ldEligible) },
  ], [settings])
  const problems = [!code && 'Pick a reason.', !photos.length && 'Add at least one photo.', !gps.fix && 'No GPS fix yet.'].filter(Boolean) as string[]
  if (sent) return <Done online={online} what="Blocker" onDone={onDone} />

  return (
    <form className="space-y-5 pb-4" onSubmit={e => e.preventDefault()}>
      <PoPicker crew={crew} value={poId} onChange={setPoId} />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">What is blocking the work?</legend>
        {groups.map(g => (
          <div key={g.title} className="mb-3">
            <p className="mb-1.5 text-xs text-muted">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map(r => (
                <label key={r.code} className={`cursor-pointer rounded-full border px-3 py-2 text-[13px] ${code === r.code ? 'border-[var(--accent)] bg-surface-2 font-semibold' : 'border-border'}`}>
                  <input type="radio" name="reason" value={r.code} checked={code === r.code} onChange={() => setCode(r.code)} className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {impact && (
        <div role="status" className={`flex gap-2.5 rounded-xl border p-3 text-[13px] ${impact.ldEligible ? 'border-[color-mix(in_oklab,var(--st-delayed)_45%,transparent)]' : 'border-[color-mix(in_oklab,var(--st-ontrack)_45%,transparent)]'}`}>
          {impact.ldEligible ? <ShieldAlert size={18} className="shrink-0" style={{ color: 'var(--st-delayed)' }} /> : <ShieldCheck size={18} className="shrink-0" style={{ color: 'var(--st-ontrack)' }} />}
          <div>
            <p className="font-semibold">{impact.ldEligible ? 'Subject to LD' : 'Not subject to LD'}</p>
            <p className="text-muted">{impact.text}</p>
            {!impact.ldEligible && <p className="mt-1 text-xs text-muted">Current target {fmtDate(byId.get(poId)!.effectiveTarget)}. It moves out one day for each day this stays open.</p>}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><Label>Milestone</Label>
          <select value={milestone} onChange={e => setMilestone(e.target.value as MilestoneKey)} className={field}>
            {MILESTONES.map(k => <option key={k} value={k}>{MILESTONE_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="block"><Label>Blocked since</Label>
          <input type="date" value={start} max={nowManila().slice(0, 10)} onChange={e => setStart(e.target.value)} className={field} />
        </label>
      </div>
      <Photos value={photos} onChange={setPhotos} />
      <GpsProof poId={poId} {...gps} />
      <label className="block"><Label hint="optional">Details</Label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={field} placeholder="Who, what, permit numbers" />
      </label>
      <Problems list={problems} />
      <SlideToConfirm label="Slide to report blocker" disabled={problems.length > 0}
        onConfirm={async () => {
          await outbox.add({ kind: 'blocker', delay: { id: shortId('DL'), poId, reasonCode: code, milestone, start, note: note.trim(), reportedBy: crew.lead } })
          setSent(true)
        }} />
    </form>
  )
}

// ---------------------------------------------------------------- incident

export function IncidentForm({ crew, poId: initial, online, onDone }: FormProps) {
  const { network, snap, byId } = useData()
  const [poId, setPoId] = useState(initial)
  const ev = byId.get(poId)!
  const seg = network.segments.find(s => s.poId === poId)
  const local = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 16)
  const [f, setF] = useState({
    responsibleParty: '', description: '', ticketRef: '', relatedTickets: '',
    affectedLink: seg?.corridor ?? '', faultLocation: ev.po.title.split(', ')[1] ?? '',
    receivedAt: local, restoredAt: '', restorationStatus: 'ongoing' as 'ongoing' | 'temporary' | 'permanent',
    attName: crew.lead, attPosition: 'Crew Leader', attContact: '',
    signName: '', signPosition: '', signature: undefined as string | undefined,
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [blotter, setBlotter] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const gps = useGps(network, poId)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const msp = snap.contractors.find(c => c.id === crew.contractorId)!
  const problems = [
    !f.responsibleParty.trim() && 'Name the responsible party.',
    !f.description.trim() && 'Describe what happened.',
    !photos.length && 'Add at least one photo of the damage.',
    !gps.fix && 'No GPS fix yet.',
  ].filter(Boolean) as string[]
  if (sent) return <Done online={online} what="Incident report" onDone={onDone} />

  const toTs = (v: string) => (v ? `${v}:00+08:00` : undefined)
  const submit = async () => {
    await outbox.add({
      kind: 'incident', incident: {
        id: `INC-26-${String(Date.now()).slice(-4)}`, poId, clusterId: ev.po.clusterId,
        responsibleParty: f.responsibleParty.trim(), witnessingMsp: crew.contractorId,
        attending: { name: f.attName, position: f.attPosition, contact: f.attContact },
        ticketRef: f.ticketRef.trim(), relatedTickets: f.relatedTickets.split(',').map(s => s.trim()).filter(Boolean),
        affectedLink: f.affectedLink, faultLocation: f.faultLocation, gps: gps.fix!.gps,
        receivedAt: toTs(f.receivedAt)!, restoredAt: toTs(f.restoredAt), restorationStatus: f.restorationStatus,
        description: f.description.trim(), undertakingSigned: !!f.signature, blotterAttached: blotter.length > 0,
        bom: [], permanentRestoration: 'for-award', photoIds: photos, blotterPhotoId: blotter[0], reportedByCrew: crew.id,
        undertaking: f.signature ? { name: f.signName, position: f.signPosition, signature: f.signature, at: nowManila(), via: 'crew-phone' } : undefined,
      },
    })
    setSent(true)
  }

  return (
    <form className="space-y-5 pb-4" onSubmit={e => e.preventDefault()}>
      <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">Pre-filled from your crew, PO and route. Witnessing MSP: <span className="font-medium text-text">{msp.name}</span></p>
      <PoPicker crew={crew} value={poId} onChange={setPoId} />
      <label className="block"><Label>Responsible party</Label><input value={f.responsibleParty} onChange={set('responsibleParty')} className={field} placeholder="e.g. DPWH road widening subcontractor" /></label>
      <label className="block"><Label>What happened</Label><textarea value={f.description} onChange={set('description')} rows={3} className={field} placeholder="Backhoe hooked the aerial span near pole 14…" /></label>
      <Photos value={photos} onChange={setPhotos} />
      <GpsProof poId={poId} {...gps} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><Label>Ticket ref</Label><input value={f.ticketRef} onChange={set('ticketRef')} className={field} placeholder="TT-…" /></label>
        <label className="block"><Label>Related tickets</Label><input value={f.relatedTickets} onChange={set('relatedTickets')} className={field} placeholder="TT-…, TT-…" /></label>
      </div>
      <label className="block"><Label>Affected node / link</Label><input value={f.affectedLink} onChange={set('affectedLink')} className={field} /></label>
      <label className="block"><Label>Fault location</Label><input value={f.faultLocation} onChange={set('faultLocation')} className={field} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><Label>Received</Label><input type="datetime-local" value={f.receivedAt} onChange={set('receivedAt')} className={field} /></label>
        <label className="block"><Label hint="if done">Restored</Label><input type="datetime-local" value={f.restoredAt} onChange={set('restoredAt')} className={field} /></label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Restoration</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['ongoing', 'temporary', 'permanent'] as const).map(s => (
            <label key={s} className={`cursor-pointer rounded-xl border px-2 py-2.5 text-center text-[13px] capitalize ${f.restorationStatus === s ? 'border-[var(--accent)] bg-surface-2 font-semibold' : 'border-border'}`}>
              <input type="radio" name="restoration" checked={f.restorationStatus === s} onChange={() => setF({ ...f, restorationStatus: s })} className="sr-only" />{s}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-[13px] font-medium">Attending personnel</legend>
        <input aria-label="Name" value={f.attName} onChange={set('attName')} className={field} />
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Position" value={f.attPosition} onChange={set('attPosition')} className={field} />
          <input aria-label="Contact number" value={f.attContact} onChange={set('attContact')} className={field} placeholder="09xx xxx xxxx" inputMode="tel" />
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-[13px] font-medium">Acknowledgment and Undertaking <span className="font-normal text-muted">(sign now, or later by QR)</span></legend>
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Responsible party representative" value={f.signName} onChange={set('signName')} className={field} placeholder="Representative" />
          <input aria-label="Representative position" value={f.signPosition} onChange={set('signPosition')} className={field} placeholder="Position" />
        </div>
        <SignaturePad label="Signature of the responsible party" value={f.signature} onChange={v => setF(s => ({ ...s, signature: v }))} />
      </fieldset>
      <Photos value={blotter} onChange={setBlotter} required={false} label="Blotter / police certification" />
      <p className="-mt-3 text-xs text-muted">Barangay blotter or police certification: preferred, not required.</p>
      <Problems list={problems} />
      <SlideToConfirm label="Slide to file incident" disabled={problems.length > 0} onConfirm={submit} />
    </form>
  )
}
