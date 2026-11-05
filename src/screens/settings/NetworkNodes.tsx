// Network nodes (core / NOC and hubs): add by clicking the map, rename, remove.
import { lazy, Suspense, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { repo } from '../../data/repo'
import type { LngLat } from '../../domain/types'
import { useData } from '../../state'
import { Panel } from '../../ui/Panel'

const MapPicker = lazy(() => import('../../ui/MapPicker').then(m => ({ default: m.MapPicker })))
const field = 'h-9 rounded-lg border border-border bg-bg px-2.5 text-[14px] outline-none focus:border-[var(--accent)]'

export function NetworkNodes() {
  const { network, refresh, can } = useData()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [core, setCore] = useState(false)
  const [at, setAt] = useState<LngLat | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Record<string, string>>({})
  if (!can('network.edit')) return null

  const add = async () => {
    if (!name.trim() || !at) return
    await repo.saveHub({ id: `HUB-${Date.now().toString(36).toUpperCase()}`, name: name.trim(), coord: at, core })
    await refresh()
    setAdding(false); setName(''); setAt(null); setCore(false)
  }

  return (
    <Panel className="mt-4" title="Network nodes" sub="Core node / NOC and hubs drawn on the map. Changes are kept on top of whichever route file is loaded.">
      <ul className="divide-y divide-border text-[13px]">
        {network.hubs.map(h => (
          <li key={h.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${h.core ? 'border-[var(--brand-magenta)]' : 'border-border text-muted'}`}>{h.core ? 'Core / NOC' : 'Hub'}</span>
            <input aria-label={`Name of ${h.name}`} value={renaming[h.id] ?? h.name} onChange={e => setRenaming(r => ({ ...r, [h.id]: e.target.value }))} className={`${field} min-w-0 flex-1`} />
            <span className="font-mono text-xs text-muted">{h.coord[1].toFixed(4)}, {h.coord[0].toFixed(4)}</span>
            {renaming[h.id] !== undefined && renaming[h.id].trim() && renaming[h.id] !== h.name && (
              <button onClick={async () => { await repo.saveHub({ ...h, name: renaming[h.id].trim() }); await refresh(); setRenaming(r => { const n = { ...r }; delete n[h.id]; return n }) }}
                className="rounded-lg bg-text px-3 py-1.5 text-xs font-medium text-bg">Save name</button>
            )}
            {confirm === h.id ? (
              <span className="flex items-center gap-2 text-xs">
                Remove from the map?
                <button onClick={async () => { await repo.removeHub(h.id); await refresh(); setConfirm(null) }} className="rounded-lg border border-bad px-2 py-1 font-medium text-bad">Remove</button>
                <button onClick={() => setConfirm(null)} className="text-muted">Keep</button>
              </span>
            ) : (
              <button aria-label={`Remove ${h.name}`} onClick={() => setConfirm(h.id)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"><Trash2 size={14} /></button>
            )}
          </li>
        ))}
      </ul>

      {!adding ? (
        <button onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"><Plus size={14} />Add a node</button>
      ) : (
        <div className="mt-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-end gap-3 text-[13px]">
            <label className="min-w-[14rem] flex-1">Name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pajo hub" className={`${field} mt-1 w-full`} /></label>
            <label className="flex h-9 items-center gap-2"><input type="checkbox" checked={core} onChange={e => setCore(e.target.checked)} className="h-4 w-4 accent-[var(--brand-orange)]" />Core node / NOC</label>
          </div>
          <div className="mt-3">
            <Suspense fallback={<div className="grid h-80 place-items-center rounded-xl border border-border text-sm text-muted">Loading map…</div>}>
              <MapPicker mode="point" value={at} onChange={setAt} />
            </Suspense>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={!name.trim() || !at} onClick={add} className="rounded-lg bg-text px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-40">Add node</button>
            <button onClick={() => { setAdding(false); setAt(null) }} className="rounded-lg border border-border px-4 py-2 text-[13px]">Cancel</button>
          </div>
        </div>
      )}
    </Panel>
  )
}
