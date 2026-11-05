// App-wide data + shared filters + selection + theme. Screens read everything through useData().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { repo } from './data/repo'
import { evaluateAll, type PoEval } from './domain/status'
import type { Activity, Network, Settings, Snapshot, Status } from './domain/types'

export interface Filters { program: string; cluster: string; contractor: string; category: string; status: Status | ''; activity: Activity | '' }
export const NO_FILTERS: Filters = { program: '', cluster: '', contractor: '', category: '', status: '', activity: '' }
export type Theme = 'dark' | 'light'

interface Data {
  snap: Snapshot
  network: Network
  settings: Settings
  evals: PoEval[]
  byId: Map<string, PoEval>
  filters: Filters
  setFilters: (f: Filters) => void
  /** Matches every filter except status/activity (used by the KPI strip so its counts stay meaningful). */
  matchesScope: (e: PoEval) => boolean
  matches: (e: PoEval) => boolean
  selectedId: string | null
  select: (id: string | null) => void
  theme: Theme
  setTheme: (t: Theme) => void
  /** Swap in a newer snapshot after a write (sync, incident edit). */
  setSnap: (s: Snapshot) => void
  /** Save settings; every screen re-evaluates with them. */
  setSettings: (s: Settings) => void
}

const Ctx = createContext<Data | null>(null)
export const useData = () => {
  const d = useContext(Ctx)
  if (!d) throw new Error('useData outside DataProvider')
  return d
}

const THEME_KEY = 'cjf.theme'
const readTheme = (): Theme => {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<{ snap: Snapshot; network: Network; settings: Settings }>()
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selectedId, select] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    Promise.all([repo.getSnapshot(), repo.getNetwork(), repo.getSettings()])
      .then(([snap, network, settings]) => setLoaded({ snap, network, settings }))
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  // Franchise branding is just three CSS variables.
  const brand = loaded?.settings.brand
  useEffect(() => {
    const root = document.documentElement.style
    if (!brand) { ['--brand-orange', '--brand-magenta', '--brand-violet'].forEach(v => root.removeProperty(v)); return }
    root.setProperty('--brand-orange', brand.orange); root.setProperty('--brand-magenta', brand.magenta); root.setProperty('--brand-violet', brand.violet)
  }, [brand])
  // Dev-only hook for scripted screenshots.
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __select: typeof select }).__select = select }, [])
  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* not persisted */ }
  }

  const value = useMemo(() => {
    if (!loaded) return null
    const evals = evaluateAll(loaded.snap, loaded.settings)
    const matchesScope = (e: PoEval) =>
      (!filters.program || e.po.programId === filters.program) &&
      (!filters.cluster || e.po.clusterId === filters.cluster) &&
      (!filters.contractor || e.po.contractorId === filters.contractor) &&
      (!filters.category || e.po.categoryId === filters.category)
    const matches = (e: PoEval) =>
      matchesScope(e) && (!filters.status || e.status === filters.status) && (!filters.activity || e.activity === filters.activity)
    return {
      ...loaded, evals, byId: new Map(evals.map(e => [e.po.id, e])),
      filters, setFilters, matchesScope, matches, selectedId, select, theme, setTheme,
      setSnap: (snap: Snapshot) => setLoaded(l => (l ? { ...l, snap } : l)),
      setSettings: (settings: Settings) => { setLoaded(l => (l ? { ...l, settings } : l)); repo.saveSettings(settings) },
    }
  }, [loaded, filters, selectedId, theme])

  if (!value) return <div className="grid h-full place-items-center text-sm text-muted" role="status">Loading the backbone…</div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
