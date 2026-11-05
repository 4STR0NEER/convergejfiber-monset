// Phone view of the Command Center: a list you can scan with one thumb instead of a 3D map you have to pinch.
// "Needs attention" first, "Near me" for whoever is out on site. The map is one tap away, never the default.
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, LocateFixed, Map as MapIcon, TriangleAlert } from 'lucide-react'
import { fmtDate, peso } from '../../domain/dates'
import { distanceToRoute } from '../../domain/field'
import type { PoEval } from '../../domain/status'
import type { LngLat } from '../../domain/types'
import { useData } from '../../state'
import { StatusBadge } from '../../ui/status'

type View = 'attention' | 'near' | 'all'
const RANK = { DELAYED: 0, AT_RISK: 1, TRENDING_LATE: 2, ON_TRACK: 3, COMPLETED: 4 } as const

/** Most urgent first: delayed by LD, then at risk by days left, then trending late by gap, then open blockers. */
const urgency = (a: PoEval, b: PoEval) =>
  RANK[a.status] - RANK[b.status] || b.ld.amount - a.ld.amount || a.daysToTarget - b.daysToTarget || b.gap - a.gap

export function MobileGlance({ onOpenMap }: { onOpenMap: () => void }) {
  const { evals, matches, network, snap } = useData()
  const [view, setView] = useState<View>('attention')
  const [here, setHere] = useState<LngLat | null>(null)
  const [geo, setGeo] = useState<'idle' | 'locating' | 'denied'>('idle')
  const [limit, setLimit] = useState(20)

  const scoped = useMemo(() => evals.filter(matches), [evals, matches])
  const attention = useMemo(() => scoped.filter(e => ['DELAYED', 'AT_RISK', 'TRENDING_LATE'].includes(e.status) || e.openBlockers.length).sort(urgency), [scoped])
  const near = useMemo(() => !here ? [] : scoped.filter(e => e.activity !== 'COMPLETED')
    .map(e => ({ e, km: distanceToRoute(network, e.po.id, here) ?? Infinity })).sort((a, b) => a.km - b.km), [scoped, here, network])

  const locate = () => {
    setView('near')
    if (here || !navigator.geolocation) { if (!navigator.geolocation) setGeo('denied'); return }
    setGeo('locating')
    navigator.geolocation.getCurrentPosition(p => { setHere([p.coords.longitude, p.coords.latitude]); setGeo('idle') }, () => setGeo('denied'), { timeout: 8000, maximumAge: 120_000 })
  }

  const rows: { e: PoEval; km?: number }[] = view === 'attention' ? attention.map(e => ({ e })) : view === 'near' ? near : [...scoped].sort(urgency).map(e => ({ e }))
  const name = (id: string) => snap.contractors.find(c => c.id === id)?.short

  return (
    <div className="px-4 pb-28 pt-3">
      <div role="tablist" aria-label="List" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 text-[13px]">
        {([['attention', `Attention · ${attention.length}`], ['near', 'Near me'], ['all', `All · ${scoped.length}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => (k === 'near' ? locate() : setView(k))}
            className={`flex h-10 items-center justify-center gap-1 rounded-lg font-medium ${view === k ? 'bg-surface-2 text-text' : 'text-muted'}`}>
            {k === 'near' && <LocateFixed size={14} />}{label}
          </button>
        ))}
      </div>

      {view === 'near' && geo !== 'idle' && (
        <p role="status" className="mt-3 text-[13px] text-muted">
          {geo === 'locating' ? 'Finding where you are…' : 'Location is off or unavailable. Turn it on to sort POs by distance, or use Needs attention.'}
        </p>
      )}

      <ul className="mt-3 space-y-2.5">
        {rows.slice(0, limit).map(({ e, km }) => (
          <li key={e.po.id}>
            <Link to={`/po/${e.po.id}`} className="block rounded-2xl border border-border bg-surface p-4 active:bg-surface-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted">{e.po.kind} {e.po.id} · {name(e.po.contractorId)}</p>
                  <p className="text-[15px] font-semibold leading-snug">{e.po.title}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted">{e.why[0] ?? `Target PAT ${fmtDate(e.effectiveTarget)}.`}</p>
              {e.openBlockers.length > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--st-atrisk)]"><TriangleAlert size={12} />{e.openBlockers.length} open blocker{e.openBlockers.length > 1 ? 's' : ''}</p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted">
                  {km !== undefined && Number.isFinite(km) ? `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away · ` : ''}
                  {e.activity === 'COMPLETED' ? `Accepted ${fmtDate(e.po.patDate!)}` : e.daysToTarget < 0 ? `${-e.daysToTarget} d late` : `${e.daysToTarget} d to target`}
                </span>
                <span className="flex items-center gap-1 font-semibold">{e.ld.amount ? peso(e.ld.amount) : ''}<ChevronRight size={16} className="text-muted" /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!rows.length && view !== 'near' && <p className="py-10 text-center text-sm text-muted">Nothing needs attention with these filters.</p>}
      {rows.length > limit && <button onClick={() => setLimit(l => l + 30)} className="mt-3 w-full rounded-xl border border-border py-3 text-sm font-medium">Show more</button>}

      <button onClick={onOpenMap} className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-semibold shadow-[var(--shadow)]">
        <MapIcon size={16} />Open map
      </button>
    </div>
  )
}
