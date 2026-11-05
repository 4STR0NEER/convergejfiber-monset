import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import { Moon, Sun } from 'lucide-react'
import { useData } from './state'
import { NavTabs, type Tab } from './ui/NavTabs'
import { ago } from './ui/format'
import { CommandCenter } from './screens/command/CommandCenter'
import { Portfolio } from './screens/portfolio/Portfolio'
import { PoDetail } from './screens/po/PoDetail'
import { revealTheme } from './ui/skiper/themeReveal'

const TABS: Tab[] = [
  { to: '/', label: 'Command Center' },
  { to: '/portfolio', label: 'Portfolio', also: ['/po/'] },
  { to: '/scorecards', label: 'Scorecards' },
  { to: '/month-end', label: 'Month-End Close' },
  { to: '/incidents', label: 'Incidents' },
  { to: '/field', label: 'Field App' },
  { to: '/settings', label: 'Settings' },
]

const COMING: Record<string, { phase: number; what: string }> = {
  '/scorecards': { phase: 5, what: 'On-time rate, attributable delay share, documentation lateness, LD exposure and trend per contractor.' },
  '/month-end': { phase: 5, what: 'Guided Day 1 to Day 10 close: fallout list, pre-drafted gap analyses, LD recommendations and notices, contractor acknowledgment.' },
  '/incidents': { phase: 4, what: 'Third-party damage claims: incident report, undertaking, optional blotter, and BOM for temporary and permanent restoration.' },
  '/field': { phase: 4, what: 'Offline-first crew app: my POs, photo-proof updates with GPS and time, blockers with reason codes, incident reports.' },
  '/settings': { phase: 5, what: 'Delay reason codes, milestone weights, risk thresholds, LD rate and cap, holidays.' },
}

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<CommandCenter />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/po/:id" element={<PoDetail />} />
          {Object.entries(COMING).map(([path, c]) => (
            <Route key={path} path={path} element={<Coming title={TABS.find(t => t.to === path)!.label} {...c} />} />
          ))}
          <Route path="*" element={<Coming title="Not found" phase={0} what="This page does not exist." />} />
        </Routes>
      </main>
    </div>
  )
}

function Header() {
  const { theme, setTheme } = useData()
  return (
    <header className="relative z-30 flex items-center gap-4 border-b border-border bg-bg px-4 md:px-6">
      <a href="/" className="flex shrink-0 items-center gap-2.5 py-3" aria-label="Converge-J Fiber Backbone Command, home">
        <BrandMark />
        <span className="hidden leading-tight sm:block">
          <span className="block text-[14px] font-semibold tracking-tight">Converge-J Fiber</span>
          <span className="block text-[11px] text-muted">Backbone Command</span>
        </span>
      </a>
      <div className="min-w-0 flex-1"><NavTabs tabs={TABS} /></div>
      <LiveStamp />
      <button onClick={e => { const el = e.currentTarget; revealTheme(() => setTheme(theme === 'dark' ? 'light' : 'dark'), el) }} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text">
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  )
}

/** A fiber strand bending into a J, lit from orange to violet, ending in a splice node. */
function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="cjf-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-orange)" /><stop offset=".55" stopColor="var(--brand-magenta)" /><stop offset="1" stopColor="var(--brand-violet)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="var(--brand-black)" />
      <path d="M8 8.5h14v9.5a6.5 6.5 0 0 1-13 0" fill="none" stroke="url(#cjf-g)" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="8" cy="8.5" r="2.4" fill="var(--brand-orange)" />
    </svg>
  )
}

/** Honest "live": time since the newest field update, not a fake real-time feed. */
function LiveStamp() {
  const { snap } = useData()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const latest = snap.updates.reduce((a, u) => (u.at > a ? u.at : a), '')
  return (
    <p className="hidden shrink-0 items-center gap-2 text-xs text-muted lg:flex" title="Field updates arrive when crews submit them; this is not real-time GPS.">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--st-ontrack)] opacity-50 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--st-ontrack)]" />
      </span>
      Last field update {latest ? ago(latest, now) : 'none yet'}
    </p>
  )
}

function Coming({ title, phase, what }: { title: string; phase: number; what: string }) {
  return (
    <section className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {phase > 0 && <p className="mt-1 text-sm text-accent">Arrives in Phase {phase}</p>}
      <p className="mt-4 text-muted">{what}</p>
    </section>
  )
}
