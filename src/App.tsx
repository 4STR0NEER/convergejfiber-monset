import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { LogOut, Moon, Sun } from 'lucide-react'
import { canVisit, ROLE_HOME, ROLE_LABEL } from './domain/access'
import { SignIn } from './screens/auth/SignIn'
import { useData } from './state'
import { ErrorBoundary, ScreenLoading } from './ui/ErrorBoundary'
import { NavTabs, type Tab } from './ui/NavTabs'
import { ago } from './ui/format'
import { revealTheme } from './ui/skiper/themeReveal'


// Each screen is its own chunk: the map stack (deck.gl + MapLibre) and Recharts load only where used.
const CommandCenter = lazy(() => import('./screens/command/CommandCenter').then(m => ({ default: m.CommandCenter })))
const Portfolio = lazy(() => import('./screens/portfolio/Portfolio').then(m => ({ default: m.Portfolio })))
const PoDetail = lazy(() => import('./screens/po/PoDetail').then(m => ({ default: m.PoDetail })))
const NewPo = lazy(() => import('./screens/po/NewPo').then(m => ({ default: m.NewPo })))
const FieldPage = lazy(() => import('./screens/field/FieldApp').then(m => ({ default: m.FieldPage })))
const Incidents = lazy(() => import('./screens/incidents/Incidents').then(m => ({ default: m.Incidents })))
const Ack = lazy(() => import('./screens/incidents/Ack').then(m => ({ default: m.Ack })))
const MonthEnd = lazy(() => import('./screens/monthend/MonthEnd').then(m => ({ default: m.MonthEnd })))
const NoticeDoc = lazy(() => import('./screens/monthend/Documents').then(m => ({ default: m.NoticeDoc })))
const RecommendationDoc = lazy(() => import('./screens/monthend/Documents').then(m => ({ default: m.RecommendationDoc })))
const Scorecards = lazy(() => import('./screens/scorecards/Scorecards').then(m => ({ default: m.Scorecards })))
const SettingsPage = lazy(() => import('./screens/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const TABS: Tab[] = [
  { to: '/', label: 'Command Center' },
  { to: '/portfolio', label: 'Portfolio', also: ['/po/'] },
  { to: '/scorecards', label: 'Scorecards' },
  { to: '/month-end', label: 'Month-End Close' },
  { to: '/incidents', label: 'Incidents' },
  { to: '/field', label: 'Field App' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  const { pathname } = useLocation()
  const { session } = useData()
  // The signing page is for an outside party: no account, no internal navigation.
  if (pathname.startsWith('/ack/')) return <main className="h-full overflow-y-auto"><Suspense fallback={<ScreenLoading />}><Routes><Route path="/ack/:id" element={<Ack />} /></Routes></Suspense></main>
  if (!session) return <div className="h-full overflow-y-auto"><SignIn /></div>
  // A role that may not open this screen is sent to its own home screen.
  if (!canVisit(session.role, pathname)) return <Navigate to={ROLE_HOME[session.role]} replace />
  return (
    <div className="flex h-full flex-col">
      <a href="#main" className="sr-only z-50 rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg focus:not-sr-only focus:absolute focus:left-3 focus:top-3">Skip to content</a>
      {/* On a phone the Field App is the whole screen. */}
      <div className={pathname.startsWith('/field') ? 'max-md:hidden' : ''}><Header /></div>
      <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
        <ErrorBoundary key={pathname}>
        <Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route index element={<CommandCenter />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/po/new" element={<NewPo />} />
          <Route path="/po/:id" element={<PoDetail />} />
          <Route path="/field" element={<FieldPage />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<Incidents />} />
          <Route path="/month-end" element={<MonthEnd />} />
          <Route path="/month-end/:period" element={<MonthEnd />} />
          <Route path="/month-end/:period/recommendation" element={<RecommendationDoc />} />
          <Route path="/month-end/:period/notice/:contractorId" element={<NoticeDoc />} />
          <Route path="/scorecards" element={<Scorecards />} />
          <Route path="/scorecards/:id" element={<Scorecards />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

function Header() {
  const { theme, setTheme, session } = useData()
  const tabs = TABS.filter(t => canVisit(session!.role, t.to))
  return (
    <header className="app-chrome relative z-30 flex items-center gap-4 border-b border-border bg-bg px-4 md:px-6">
      <a href="/" className="flex shrink-0 items-center gap-2.5 py-3" aria-label="Converge-J Fiber Backbone Command, home">
        <BrandMark />
        <span className="hidden leading-tight sm:block">
          <span className="block text-[14px] font-semibold tracking-tight">Converge-J Fiber</span>
          <span className="block text-[11px] text-muted">Backbone Command</span>
        </span>
      </a>
      <div className="min-w-0 flex-1"><NavTabs tabs={tabs} /></div>
      {session!.role !== 'ground' && <LiveStamp />}
      <button onClick={e => { const el = e.currentTarget; revealTheme(() => setTheme(theme === 'dark' ? 'light' : 'dark'), el) }} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        className="rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text">
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <UserMenu />
    </header>
  )
}

function UserMenu() {
  const { session, signOut, snap } = useData()
  const s = session!
  const org = s.contractorId ? snap.contractors.find(c => c.id === s.contractorId)?.name ?? s.contractorId : 'Converge-J Fiber'
  return (
    <details className="relative shrink-0">
      <summary aria-label={`Account: ${s.name}, ${ROLE_LABEL[s.role]}`} className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: 'var(--brand-gradient)' }}>
        {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-3 text-[13px] shadow-[var(--shadow)]">
        <p className="font-semibold">{s.name}</p>
        <p className="text-xs text-muted">{s.email}</p>
        <p className="mt-2 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">{ROLE_LABEL[s.role]}{s.crewId ? ` · Crew ${s.crewId}` : ''}</p>
        <p className="mt-1 text-xs text-muted">{org}</p>
        <button onClick={signOut} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2"><LogOut size={14} />Sign out</button>
      </div>
    </details>
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
      <span><span className="hidden xl:inline">Last field update </span>{latest ? ago(latest, now) : 'none yet'}</span>
    </p>
  )
}

function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">That address is not part of Backbone Command.</p>
    </section>
  )
}
