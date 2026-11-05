import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, FileWarning, Map as MapIcon, Plus, Printer, Save, Trash2 } from 'lucide-react'
import { repo } from '../../data/repo'
import { fmtDate, peso } from '../../domain/dates'
import type { BomLine, Incident } from '../../domain/types'
import { useData } from '../../state'
import { ago } from '../../ui/format'
import { Panel } from '../../ui/Panel'
import { photoSrc } from '../../ui/photo'
import { Qr } from '../../ui/Qr'

const PRESETS: Omit<BomLine, 'qty'>[] = [
  { item: 'FOC 48-core aerial cable', unit: 'm', unitCost: 95, phase: 'permanent' },
  { item: 'FOC 24-core UG cable', unit: 'm', unitCost: 110, phase: 'permanent' },
  { item: 'Steel pole 9 m', unit: 'pc', unitCost: 18_000, phase: 'permanent' },
  { item: 'Splice closure 48c', unit: 'pc', unitCost: 6500, phase: 'permanent' },
  { item: 'HDPE duct 40 mm', unit: 'm', unitCost: 120, phase: 'permanent' },
  { item: 'Excavation and backfill', unit: 'm', unitCost: 1100, phase: 'permanent' },
  { item: 'Splicing per core', unit: 'core', unitCost: 450, phase: 'temporary' },
  { item: 'Temporary aerial bypass', unit: 'lot', unitCost: 18_000, phase: 'temporary' },
  { item: 'Dead-end hardware set', unit: 'set', unitCost: 1200, phase: 'temporary' },
  { item: 'Restoration crew', unit: 'day', unitCost: 14_000, phase: 'temporary' },
]
export const bomTotals = (bom: BomLine[]) => {
  const sum = (ph: BomLine['phase']) => bom.filter(l => l.phase === ph).reduce((a, l) => a + l.qty * l.unitCost, 0)
  return { temporary: sum('temporary'), permanent: sum('permanent'), total: sum('temporary') + sum('permanent') }
}
const hours = (a: string, b?: string) => (b ? Math.round((Date.parse(b) - Date.parse(a)) / 360_000) / 10 : null)

export function Incidents() {
  const { snap } = useData()
  const { id } = useParams()
  const navigate = useNavigate()
  const list = useMemo(() => [...snap.incidents].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), [snap.incidents])
  const selected = list.find(i => i.id === id) ?? list[0]
  const now = Date.now()
  const claim = list.reduce((a, i) => a + bomTotals(i.bom).total, 0)

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident reports</h1>
          <p className="mt-1 text-sm text-muted">Third-party damage claims · {list.length} reports · {peso(claim)} in restoration costs to recover</p>
        </div>
        <ul className="flex gap-6 text-sm">
          <li><span className="block text-xs text-muted">Restoration ongoing</span><span className="text-lg font-semibold">{list.filter(i => i.restorationStatus === 'ongoing').length}</span></li>
          <li><span className="block text-xs text-muted">Undertaking not signed</span><span className="text-lg font-semibold">{list.filter(i => !i.undertakingSigned).length}</span></li>
          <li><span className="block text-xs text-muted">Permanent fix for award</span><span className="text-lg font-semibold">{list.filter(i => i.permanentRestoration === 'for-award').length}</span></li>
        </ul>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <nav aria-label="Incident list" className="no-print">
          <ul className="space-y-2">
            {list.map(i => {
              const active = i.id === selected?.id
              return (
                <li key={i.id}>
                  <button onClick={() => navigate(`/incidents/${i.id}`)} aria-current={active ? 'true' : undefined}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors duration-150 ${active ? 'border-[var(--accent)] bg-surface' : 'border-border bg-surface hover:bg-surface-2'}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-muted">{i.id}</span>
                      <span className="text-xs text-muted">{ago(i.receivedAt, now)}</span>
                    </div>
                    <p className="mt-1 text-[14px] font-semibold leading-snug">{i.responsibleParty}</p>
                    <p className="text-xs text-muted">{snap.clusters.find(c => c.id === i.clusterId)?.name} · {snap.contractors.find(c => c.id === i.witnessingMsp)?.short}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <Chip ok={i.restorationStatus === 'permanent'}>{i.restorationStatus === 'ongoing' ? 'Restoring' : i.restorationStatus === 'permanent' ? 'Permanent fix' : 'Temporary fix'}</Chip>
                      <Chip ok={i.undertakingSigned}>{i.undertakingSigned ? 'Undertaking signed' : 'Not signed'}</Chip>
                      <Chip ok={i.bom.length > 0}>{i.bom.length ? peso(bomTotals(i.bom).total) : 'No BOM yet'}</Chip>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        {selected ? <IncidentDetail key={selected.id} inc={selected} /> : <p className="text-muted">No incidents reported.</p>}
      </div>
    </div>
  )
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${ok ? 'border-border text-muted' : 'border-[color-mix(in_oklab,var(--st-atrisk)_55%,transparent)] text-text'}`}>
      {ok ? <Check size={11} /> : <FileWarning size={11} style={{ color: 'var(--st-atrisk)' }} />}{children}
    </span>
  )
}

function IncidentDetail({ inc }: { inc: Incident }) {
  const { snap, setSnap, select, can } = useData()
  const editBom = can('incident.bom'), mayAward = can('incident.award')
  const navigate = useNavigate()
  const [bom, setBom] = useState<BomLine[]>(inc.bom)
  const [award, setAward] = useState(inc.permanentRestoration)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(bom) !== JSON.stringify(inc.bom) || award !== inc.permanentRestoration
  useEffect(() => { if (dirty) setSaved(false) }, [dirty])
  const t = bomTotals(bom)
  const msp = snap.contractors.find(c => c.id === inc.witnessingMsp)?.name ?? inc.witnessingMsp
  const ackUrl = `${location.origin}/ack/${inc.id}`
  const dur = hours(inc.receivedAt, inc.restoredAt)
  const ts = (v?: string) => (v ? `${fmtDate(v.slice(0, 10))} ${v.slice(11, 16)}` : '–')
  const setLine = (i: number, p: Partial<BomLine>) => setBom(bom.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const save = async () => { setSnap(await repo.saveIncident({ ...inc, bom, permanentRestoration: award })); setSaved(true) }

  return (
    <article className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="font-mono text-xs text-muted">{inc.id}{inc.poId && <> · <Link to={`/po/${inc.poId}`} className="hover:underline">PO {inc.poId}</Link></>}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{inc.responsibleParty}</h2>
          <p className="mt-1 max-w-2xl text-[14px]">{inc.description}</p>
        </div>
        <div className="no-print flex gap-2">
          {inc.poId && <button onClick={() => { select(inc.poId!); navigate('/') }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-2"><MapIcon size={14} />Map</button>}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-surface-2"><Printer size={14} />Print claim packet</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Incident report" sub={inc.reportedByCrew ? `Filed from the Field App by crew ${inc.reportedByCrew}` : 'Filed by the witnessing MSP'}>
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {([
              ['Witnessing MSP', msp],
              ['Attending personnel', `${inc.attending.name}, ${inc.attending.position}`],
              ['Contact', inc.attending.contact || '–'],
              ['Ticket ref', inc.ticketRef || '–'],
              ['Related tickets', inc.relatedTickets.join(', ') || '–'],
              ['Affected node / link', inc.affectedLink],
              ['Fault location', inc.faultLocation],
              ['GPS', `${inc.gps[1].toFixed(5)}, ${inc.gps[0].toFixed(5)}`],
              ['Received', ts(inc.receivedAt)],
              ['Restored', ts(inc.restoredAt)],
              ['Restoration time', dur === null ? 'Still restoring' : `${dur} h`],
              ['Restoration status', inc.restorationStatus[0].toUpperCase() + inc.restorationStatus.slice(1)],
              ['Blotter / police cert.', inc.blotterAttached ? 'Attached' : 'Not attached (optional)'],
            ] as const).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {!!inc.photoIds?.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {inc.photoIds.map(p => <img key={p} src={photoSrc(p, `${inc.id} ${ts(inc.receivedAt)}`)} alt="Damage photo" className="h-24 w-32 rounded-lg object-cover" />)}
            </div>
          )}
        </Panel>

        <Panel title="Acknowledgment and Undertaking" sub="Signed by the responsible party">
          {inc.undertaking ? (
            <div>
              <img src={inc.undertaking.signature} alt={`Signature of ${inc.undertaking.name}`} className="h-28 rounded-lg border border-border bg-white" />
              <p className="mt-2 text-[13px]"><span className="font-semibold">{inc.undertaking.name}</span>, {inc.undertaking.position}</p>
              <p className="text-xs text-muted">Signed {ts(inc.undertaking.at)} {inc.undertaking.via === 'qr-link' ? 'via QR link' : "on the crew's phone"}</p>
            </div>
          ) : inc.undertakingSigned ? (
            <p className="text-[13px]">Signed on paper. Scan on file with the witnessing MSP.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Qr text={ackUrl} size={128} label={`QR code linking to ${ackUrl}`} />
              <div className="max-w-xs text-[13px]">
                <p className="font-semibold">Not signed yet</p>
                <p className="mt-1 text-muted">The responsible party scans this and signs on their own phone. No account needed.</p>
                <Link to={`/ack/${inc.id}`} className="no-print mt-2 inline-block text-xs font-medium text-accent hover:underline">Open the signing page</Link>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Bill of materials" sub="Temporary and permanent restoration, billed to the responsible party"
        action={(editBom || mayAward) && <div className="no-print flex items-center gap-2">
          {saved && !dirty && <span className="text-xs text-muted" role="status">Saved</span>}
          <button disabled={!dirty} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-text px-3 py-1.5 text-[13px] font-medium text-bg disabled:opacity-40"><Save size={14} />Save</button>
        </div>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead className="text-xs text-muted"><tr>{['Item', 'Unit', 'Qty', 'Unit cost', 'Phase', 'Amount', ''].map(h => <th key={h} scope="col" className="border-b border-border py-1.5 pr-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {bom.map((l, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-1 pr-2"><input aria-label="Item" disabled={!editBom} value={l.item} onChange={e => setLine(i, { item: e.target.value })} className="w-full rounded-md bg-transparent px-1 py-1 outline-none focus:bg-surface-2" /></td>
                  <td className="py-1 pr-2"><input aria-label="Unit" disabled={!editBom} value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} className="w-14 rounded-md bg-transparent px-1 py-1 outline-none focus:bg-surface-2" /></td>
                  <td className="py-1 pr-2"><input aria-label="Quantity" disabled={!editBom} type="number" min={0} value={l.qty} onChange={e => setLine(i, { qty: Math.max(0, +e.target.value) })} className="w-20 rounded-md bg-transparent px-1 py-1 text-right outline-none focus:bg-surface-2" /></td>
                  <td className="py-1 pr-2"><input aria-label="Unit cost" disabled={!editBom} type="number" min={0} value={l.unitCost} onChange={e => setLine(i, { unitCost: Math.max(0, +e.target.value) })} className="w-24 rounded-md bg-transparent px-1 py-1 text-right outline-none focus:bg-surface-2" /></td>
                  <td className="py-1 pr-2">
                    <select aria-label="Phase" disabled={!editBom} value={l.phase} onChange={e => setLine(i, { phase: e.target.value as BomLine['phase'] })} className="rounded-md bg-transparent px-1 py-1">
                      <option value="temporary">Temporary</option><option value="permanent">Permanent</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2 text-right font-medium">{peso(l.qty * l.unitCost)}</td>
                  <td className="no-print py-1">{editBom && <button aria-label={`Remove ${l.item}`} onClick={() => setBom(bom.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editBom && <div className="no-print mt-3 flex flex-wrap items-center gap-2">
          <Plus size={14} className="text-muted" />
          <select aria-label="Add a BOM line" value="" onChange={e => { const p = PRESETS[+e.target.value]; if (p) setBom([...bom, { ...p, qty: 1 }]) }} className="h-8 rounded-lg border border-border bg-surface px-2 text-[13px]">
            <option value="">Add a line…</option>
            {PRESETS.map((p, i) => <option key={p.item} value={i}>{p.item} ({p.phase})</option>)}
          </select>
          <button onClick={() => setBom([...bom, { item: 'Other', unit: 'lot', qty: 1, unitCost: 0, phase: 'temporary' }])} className="text-xs text-muted hover:text-text">Blank line</button>
        </div>}
        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-[13px]">
          <div className="flex justify-between"><dt className="text-muted">Temporary restoration</dt><dd>{peso(t.temporary)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Permanent restoration</dt><dd>{peso(t.permanent)}</dd></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Total claim</dt><dd>{peso(t.total)}</dd></div>
        </dl>
        <fieldset className="mt-4 border-t border-border pt-4">
          <legend className="text-[13px] font-medium">Permanent restoration{!mayAward && <span className="ml-2 font-normal text-muted">decided by Converge-J Fiber</span>}</legend>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
            {([['same-contractor', `Already awarded to ${msp}`], ['for-award', 'Still for award']] as const).map(([v, label]) => (
              <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2 ${award === v ? 'border-[var(--accent)] bg-surface-2 font-semibold' : 'border-border'}`}>
                <input type="radio" name="award" disabled={!mayAward} checked={award === v} onChange={() => setAward(v)} className="sr-only" />{label}
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>
    </article>
  )
}
