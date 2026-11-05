import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { DEFAULT_SETTINGS } from '../../domain/config'
import { fmtDate } from '../../domain/dates'
import { ldExposure } from '../../domain/metrics'
import { evaluateAll, STATUS_LABEL } from '../../domain/status'
import { MILESTONE_LABEL, MILESTONES, type DelayReason, type Settings, type Status } from '../../domain/types'
import { useData } from '../../state'
import { pesoShort } from '../../ui/format'
import { Panel } from '../../ui/Panel'
import { StatusGlyph } from '../../ui/status'

const DEFAULT_BRAND = { orange: '#ff6b1a', magenta: '#d6337f', violet: '#7c3aed' }
const input = 'h-9 rounded-lg border border-border bg-bg px-2.5 text-[14px] outline-none focus:border-[var(--accent)]'

function problems(s: Settings): string[] {
  const out: string[] = []
  const w = MILESTONES.reduce((a, k) => a + s.weights[k], 0)
  if (w !== 100) out.push(`Milestone weights add up to ${w}, not 100.`)
  if (!(s.ldRatePerWeek > 0 && s.ldRatePerWeek <= 0.05)) out.push('LD rate must be between 0.01% and 5% per week.')
  if (!(s.ldCap > 0 && s.ldCap <= 1)) out.push('LD cap must be between 1% and 100%.')
  if (!(s.atRiskDays >= 1 && s.atRiskDays <= 180)) out.push('At Risk window must be 1 to 180 days.')
  if (!(s.trendingLateGap >= 1 && s.trendingLateGap <= 100)) out.push('Trending Late gap must be 1 to 100 points.')
  const codes = s.reasons.map(r => r.code.trim())
  if (codes.some(c => !c)) out.push('Every reason needs a code.')
  if (new Set(codes).size !== codes.length) out.push('Reason codes must be unique.')
  if (s.reasons.some(r => !r.label.trim())) out.push('Every reason needs a label.')
  return out
}

export function SettingsPage() {
  const { snap, settings, setSettings } = useData()
  const [draft, setDraft] = useState<Settings>(settings)
  const [newDay, setNewDay] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const errs = problems(draft)
  const set = (p: Partial<Settings>) => setDraft(d => ({ ...d, ...p }))
  const setReason = (i: number, p: Partial<DelayReason>) => set({ reasons: draft.reasons.map((r, j) => (j === i ? { ...r, ...p } : r)) })
  const brand = draft.brand ?? DEFAULT_BRAND

  // What-if: the whole portfolio re-evaluated with the draft rules.
  const preview = useMemo(() => {
    const sum = (s: Settings) => {
      const ev = evaluateAll(snap, s)
      const count = (st: Status) => ev.filter(e => e.status === st).length
      return { TRENDING_LATE: count('TRENDING_LATE'), AT_RISK: count('AT_RISK'), DELAYED: count('DELAYED'), ld: ldExposure(ev, snap.asOf, s.holidays) }
    }
    return errs.length ? null : { now: sum(settings), next: sum(draft) }
  }, [snap, settings, draft, errs.length])

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-40 pt-6 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Business rules used by every screen. Changes preview live below and apply when you save.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Liquidated damages" sub="Per started calendar week of contractor-attributable delay">
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <label>Rate per week (% of cost of works)
              <input type="number" step="0.1" min="0" value={+(draft.ldRatePerWeek * 100).toFixed(3)} onChange={e => set({ ldRatePerWeek: +e.target.value / 100 })} className={`${input} mt-1 w-full`} />
            </label>
            <label>Cap (% of cost of works)
              <input type="number" step="1" min="0" value={Math.round(draft.ldCap * 100)} onChange={e => set({ ldCap: +e.target.value / 100 })} className={`${input} mt-1 w-full`} />
            </label>
          </div>
        </Panel>
        <Panel title="Risk thresholds">
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <label><span className="flex items-center gap-1.5"><StatusGlyph status="AT_RISK" size={13} />At Risk window (days)</span>
              <input type="number" min="1" value={draft.atRiskDays} onChange={e => set({ atRiskDays: +e.target.value })} className={`${input} mt-1 w-full`} />
            </label>
            <label><span className="flex items-center gap-1.5"><StatusGlyph status="TRENDING_LATE" size={13} />Trending Late gap (points)</span>
              <input type="number" min="1" value={draft.trendingLateGap} onChange={e => set({ trendingLateGap: +e.target.value })} className={`${input} mt-1 w-full`} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">Trending Late = % of timeline elapsed minus weighted % complete is above this, even when the target is far away.</p>
        </Panel>
        <Panel title="Milestone weights" sub="Used for weighted progress and Trending Late">
          <div className="grid grid-cols-4 gap-3 text-[13px]">
            {MILESTONES.map(k => (
              <label key={k}>{MILESTONE_LABEL[k]}
                <input type="number" min="0" max="100" value={draft.weights[k]} onChange={e => set({ weights: { ...draft.weights, [k]: +e.target.value } })} className={`${input} mt-1 w-full`} />
              </label>
            ))}
          </div>
          <p className={`mt-2 text-xs ${MILESTONES.reduce((a, k) => a + draft.weights[k], 0) === 100 ? 'text-muted' : 'text-bad'}`}>Total {MILESTONES.reduce((a, k) => a + draft.weights[k], 0)} of 100</p>
        </Panel>
        <Panel title="Franchise brand" sub="The gradient runs through these three colours">
          <div className="flex flex-wrap items-end gap-4 text-[13px]">
            {(['orange', 'magenta', 'violet'] as const).map(k => (
              <label key={k} className="capitalize">{k === 'orange' ? 'Start' : k === 'magenta' ? 'Middle' : 'End'}
                <input type="color" value={brand[k]} onChange={e => set({ brand: { ...brand, [k]: e.target.value } })} className="mt-1 block h-9 w-16 cursor-pointer rounded-lg border border-border bg-bg p-1" />
              </label>
            ))}
            <div className="h-9 flex-1 rounded-lg" style={{ background: `linear-gradient(100deg, ${brand.orange}, ${brand.magenta} 55%, ${brand.violet})` }} aria-hidden="true" />
            <button type="button" onClick={() => set({ brand: undefined })} className="text-xs text-muted hover:text-text">Default</button>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Delay reason codes" sub="Crews pick these in the field. Subject to LD = contractor's fault; otherwise the target moves out day for day.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-xs text-muted"><tr>{['Code', 'Label', 'Description', 'Subject to LD', ''].map(h => <th key={h} scope="col" className="border-b border-border py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {draft.reasons.map((r, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-1.5 pr-3"><input aria-label="Code" value={r.code} onChange={e => setReason(i, { code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className={`${input} w-28 font-mono text-xs`} /></td>
                  <td className="py-1.5 pr-3"><input aria-label="Label" value={r.label} onChange={e => setReason(i, { label: e.target.value })} className={`${input} w-full`} /></td>
                  <td className="py-1.5 pr-3"><input aria-label="Description" value={r.description ?? ''} placeholder="Optional" onChange={e => setReason(i, { description: e.target.value || undefined })} className={`${input} w-full`} /></td>
                  <td className="py-1.5 pr-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" role="switch" checked={r.ldEligible} onChange={e => setReason(i, { ldEligible: e.target.checked })} className="h-5 w-5 accent-[var(--brand-orange)]" />
                      <span className="text-xs text-muted">{r.ldEligible ? 'Contractor' : 'Excused'}</span>
                    </label>
                  </td>
                  <td className="py-1.5"><button aria-label={`Remove ${r.label}`} onClick={() => set({ reasons: draft.reasons.filter((_, j) => j !== i) })} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => set({ reasons: [...draft.reasons, { code: '', label: '', ldEligible: true }] })} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"><Plus size={14} />Add reason code</button>
        <p className="mt-2 text-xs text-muted">Removing a code keeps past blockers; they are then treated as contractor attributable until the code is restored.</p>
      </Panel>

      <Panel className="mt-4" title="Holidays" sub="Skipped when counting month-end Day 1 to Day 10">
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {[...draft.holidays].sort().map(d => (
            <li key={d} className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-3 pr-1">
              {fmtDate(d)}
              <button aria-label={`Remove ${fmtDate(d)}`} onClick={() => set({ holidays: draft.holidays.filter(x => x !== d) })} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-text"><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); if (newDay && !draft.holidays.includes(newDay)) set({ holidays: [...draft.holidays, newDay] }); setNewDay('') }}>
          <input type="date" aria-label="Add a holiday" value={newDay} onChange={e => setNewDay(e.target.value)} className={input} />
          <button className="rounded-lg border border-border px-3 text-[13px] hover:bg-surface-2">Add</button>
        </form>
      </Panel>

      {/* sticky save bar with the what-if */}
      <div className="sticky bottom-4 z-20 mt-6 rounded-2xl border border-border bg-surface/95 p-4 shadow-[var(--shadow)] backdrop-blur" role="region" aria-label="Save settings">
        {errs.length > 0 ? (
          <ul className="text-[13px] text-bad">{errs.map(e => <li key={e}>{e}</li>)}</ul>
        ) : dirty && preview ? (
          <p className="text-[13px]" aria-live="polite">
            <span className="font-semibold">With these rules: </span>
            {(['TRENDING_LATE', 'AT_RISK', 'DELAYED'] as const).map(k => (
              <span key={k} className="mr-4 inline-flex items-center gap-1.5"><StatusGlyph status={k} size={12} />{STATUS_LABEL[k]} {preview.now[k]} → <b>{preview.next[k]}</b></span>
            ))}
            <span className="inline-flex items-center gap-1.5">LD exposure {pesoShort(preview.now.ld)} → <b>{pesoShort(preview.next.ld)}</b></span>
          </p>
        ) : <p className="text-[13px] text-muted">No unsaved changes.</p>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button onClick={() => setDraft(DEFAULT_SETTINGS)} className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text"><RotateCcw size={13} />Reset to defaults</button>
          <button disabled={!dirty} onClick={() => setDraft(settings)} className="rounded-lg border border-border px-3 py-1.5 text-[13px] disabled:opacity-40">Discard</button>
          <button disabled={!dirty || errs.length > 0} onClick={() => setSettings(draft)} className="rounded-lg bg-text px-4 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  )
}
