import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, RotateCcw, TriangleAlert } from 'lucide-react'
import { repo } from '../../data/repo'
import { addDays, fmtDate, peso } from '../../domain/dates'
import { cumulativeKm } from '../../domain/geo'
import { buildPo, defaultMilestones, validateNewPo } from '../../domain/po'
import { MILESTONE_LABEL, MILESTONES, type LngLat, type PtlVersion } from '../../domain/types'
import { useData } from '../../state'
import { Panel } from '../../ui/Panel'

// The map stack only loads if someone opens this form.
const MapPicker = lazy(() => import('../../ui/MapPicker').then(m => ({ default: m.MapPicker })))
const field = 'h-10 w-full rounded-lg border border-border bg-bg px-3 text-[14px] outline-none focus:border-[var(--accent)]'

export function NewPo() {
  const { snap, can, refresh, network } = useData()
  const navigate = useNavigate()
  const ids = useMemo(() => new Set(snap.pos.map(p => p.id)), [snap.pos])
  const nextId = (kind: 'PO' | 'WO') => {
    if (kind === 'PO') return String(Math.max(...snap.pos.filter(p => p.kind === 'PO').map(p => +p.id)) + 1)
    const n = Math.max(0, ...snap.pos.filter(p => p.kind === 'WO').map(p => +p.id.slice(-4))) + 1
    return `WO-SR-${snap.asOf.slice(2, 4)}-${String(n).padStart(4, '0')}`
  }
  const start0 = addDays(snap.asOf, 7), target0 = addDays(start0, 120)
  const [f, setF] = useState({
    programId: '', id: nextId('PO'), title: '', clusterId: '', categoryId: '', contractorId: '',
    cost: '', lengthKm: '', start: start0, targetPat: target0, crewId: '', tier: 'sub' as 'sub' | 'mainline',
  })
  const [milestones, setMilestones] = useState<PtlVersion['milestones']>(defaultMilestones(start0, target0))
  const [touchedMs, setTouchedMs] = useState(false)
  const [route, setRoute] = useState<LngLat[]>([])
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)

  if (!can('po.create')) return <p className="mx-auto max-w-xl px-6 py-24 text-muted">Only Converge-J Fiber admins can add POs.</p>

  const program = snap.programs.find(p => p.id === f.programId)
  const kind = program?.unit ?? 'PO'
  const routeKm = route.length > 1 ? cumulativeKm(route).at(-1)! : 0
  const set = (k: keyof typeof f, v: string) => setF(prev => {
    const next = { ...prev, [k]: v }
    if (k === 'programId') next.id = nextId(snap.programs.find(p => p.id === v)?.unit ?? 'PO')
    if (k === 'contractorId') next.crewId = ''
    return next
  })
  // Milestones follow the PTL dates until someone edits them by hand.
  const setDates = (k: 'start' | 'targetPat', v: string) => {
    set(k, v)
    const s = k === 'start' ? v : f.start, t = k === 'targetPat' ? v : f.targetPat
    if (!touchedMs && s && t && t > s) setMilestones(defaultMilestones(s, t))
  }
  const input = {
    id: f.id, kind, title: f.title, programId: f.programId, clusterId: f.clusterId, categoryId: f.categoryId, contractorId: f.contractorId,
    costOfWorks: +f.cost, lengthKm: routeKm ? +routeKm.toFixed(2) : +f.lengthKm || 0, start: f.start, targetPat: f.targetPat, milestones, signedAt: snap.asOf,
  }
  const problems = validateNewPo(input, ids)
  const crews = snap.crews.filter(c => c.contractorId === f.contractorId)
  const center = snap.clusters.find(c => c.id === f.clusterId)?.center

  const save = async () => {
    setTried(true)
    if (problems.length) return
    setSaving(true)
    const po = buildPo(input)
    await repo.createPo(po, {
      crewId: f.crewId || undefined,
      segment: route.length > 1 ? { segmentId: `SEG-${po.id}`, poId: po.id, tier: f.tier, corridor: f.title.trim(), path: route } : undefined,
    })
    await refresh()
    navigate(`/po/${po.id}`)
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-5 md:px-6">
      <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={15} />Portfolio</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New PO / WO</h1>
      <p className="mt-1 text-sm text-muted">Add work from a signed PTL. It starts as Not Started and shows up on the map, the portfolio and the assigned crew's Field App.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Order">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <label className="col-span-2">Program
              <select value={f.programId} onChange={e => set('programId', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>{snap.programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
              </select>
            </label>
            <label>{kind} number<input value={f.id} onChange={e => set('id', e.target.value)} className={`${field} mt-1 font-mono`} /></label>
            <label>Cost of works (₱)<input type="number" min="0" step="1000" value={f.cost} onChange={e => set('cost', e.target.value)} className={`${field} mt-1`} placeholder="2,500,000" /></label>
            <label className="col-span-2">Route name<input value={f.title} onChange={e => set('title', e.target.value)} className={`${field} mt-1`} placeholder="Aerial FOC build, Pajo to Ibo" /></label>
            <label>Cluster
              <select value={f.clusterId} onChange={e => set('clusterId', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>{snap.clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Category
              <select value={f.categoryId} onChange={e => set('categoryId', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>{snap.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Contractor (MSP)
              <select value={f.contractorId} onChange={e => set('contractorId', e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose…</option>{snap.contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Assign a crew <span className="text-muted">(optional)</span>
              <select value={f.crewId} onChange={e => set('crewId', e.target.value)} disabled={!f.contractorId} className={`${field} mt-1`}>
                <option value="">{f.contractorId ? 'Not yet' : 'Choose a contractor first'}</option>
                {crews.map(c => <option key={c.id} value={c.id}>{c.lead} · Crew {c.id}</option>)}
              </select>
            </label>
          </div>
        </Panel>

        <Panel title="PTL" sub="Signed baseline. Milestones are split the standard way; adjust any date.">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <label>PTL start<input type="date" value={f.start} onChange={e => setDates('start', e.target.value)} className={`${field} mt-1`} /></label>
            <label>Target PAT<input type="date" value={f.targetPat} onChange={e => setDates('targetPat', e.target.value)} className={`${field} mt-1`} /></label>
          </div>
          <table className="mt-4 w-full text-left text-[13px]">
            <thead className="text-xs text-muted"><tr><th className="pb-1 font-medium">Milestone</th><th className="pb-1 font-medium">Planned start</th><th className="pb-1 font-medium">Planned end</th></tr></thead>
            <tbody>
              {MILESTONES.map(k => (
                <tr key={k}>
                  <th scope="row" className="py-1 pr-2 font-medium">{MILESTONE_LABEL[k]}</th>
                  {(['plannedStart', 'plannedEnd'] as const).map(side => (
                    <td key={side} className="py-1 pr-2">
                      <input type="date" aria-label={`${MILESTONE_LABEL[k]} ${side === 'plannedStart' ? 'start' : 'end'}`} value={milestones[k][side]}
                        onChange={e => { setTouchedMs(true); setMilestones(m => ({ ...m, [k]: { ...m[k], [side]: e.target.value } })) }} className={`${field} h-9`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => { setTouchedMs(false); if (f.targetPat > f.start) setMilestones(defaultMilestones(f.start, f.targetPat)) }}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-text"><RotateCcw size={12} />Standard split</button>
          {+f.cost > 0 && <p className="mt-3 text-xs text-muted">LD if late: {peso(+f.cost * 0.005)} per started week, capped at {peso(+f.cost * 0.5)}. Target {f.targetPat ? fmtDate(f.targetPat) : '–'}.</p>}
        </Panel>
      </div>

      <Panel className="mt-4" title="Route" sub="Click along the road to draw it. Grey lines are the existing network. You can also save now and add the route later from a KMZ.">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-[13px]">
          {(['sub', 'mainline'] as const).map(t => (
            <label key={t} className="flex items-center gap-2"><input type="radio" name="tier" checked={f.tier === t} onChange={() => set('tier', t)} className="accent-[var(--brand-orange)]" />{t === 'sub' ? 'Barangay sub line' : 'Mainline backbone'}</label>
          ))}
          <span className="text-muted">Length {routeKm ? `${routeKm.toFixed(2)} km, measured from the drawing` : ''}</span>
          {!routeKm && <input type="number" min="0" step="0.1" aria-label="Length in km" value={f.lengthKm} onChange={e => set('lengthKm', e.target.value)} placeholder="km" className={`${field} h-8 w-24`} />}
        </div>
        <Suspense fallback={<div className="grid h-80 place-items-center rounded-xl border border-border text-sm text-muted">Loading map…</div>}>
          <MapPicker key={f.clusterId} mode="line" value={route} onChange={setRoute} center={center} />
        </Suspense>
        {network.source && <p className="mt-2 text-xs text-muted">Showing routes from {network.source}.</p>}
      </Panel>

      <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-[var(--shadow)] backdrop-blur">
        {tried && problems.length ? (
          <ul className="text-[13px] text-bad" role="alert">{problems.map(p => <li key={p} className="flex items-center gap-1.5"><TriangleAlert size={13} />{p}</li>)}</ul>
        ) : <p className="text-[13px] text-muted">{route.length > 1 ? 'Route drawn.' : 'No route yet.'} {f.crewId ? 'Crew assigned.' : 'No crew yet.'}</p>}
        <div className="flex gap-2">
          <Link to="/portfolio" className="rounded-lg border border-border px-4 py-2 text-[13px]">Cancel</Link>
          <button onClick={save} disabled={saving} className="rounded-lg bg-text px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-50">{saving ? 'Saving…' : `Add ${kind}`}</button>
        </div>
      </div>
    </div>
  )
}
