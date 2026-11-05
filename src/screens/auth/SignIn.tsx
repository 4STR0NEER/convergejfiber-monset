import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { HardHat, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { DEMO_PASSWORD } from '../../data/auth'
import { canVisit, ROLE_HOME, ROLE_LABEL, type Role, type Session } from '../../domain/access'
import { useData } from '../../state'

const input = 'h-11 w-full rounded-xl border border-border bg-bg px-3 text-[15px] outline-none focus:border-[var(--accent)]'

export function SignIn() {
  const { signIn, accounts } = useData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [crew, setCrew] = useState('')

  const go = (e: string, p: string) => {
    const s = signIn(e, p)
    if (!s) { setError('That email and password do not match a demo account.'); return }
    // Back to where they were heading if their role allows it, else their home screen.
    navigate(canVisit(s.role, pathname) ? pathname : ROLE_HOME[s.role], { replace: true })
  }
  const byRole = (r: Role) => accounts.filter(a => a.role === r)
  const quick = (a: Session) => go(a.email, DEMO_PASSWORD)

  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-[880px]">
        <div className="mb-6 flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
            <defs><linearGradient id="si-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand-orange)" /><stop offset=".55" stopColor="var(--brand-magenta)" /><stop offset="1" stopColor="var(--brand-violet)" /></linearGradient></defs>
            <rect width="32" height="32" rx="8" fill="var(--brand-black)" /><path d="M8 8.5h14v9.5a6.5 6.5 0 0 1-13 0" fill="none" stroke="url(#si-g)" strokeWidth="3.2" strokeLinecap="round" /><circle cx="8" cy="8.5" r="2.4" fill="var(--brand-orange)" />
          </svg>
          <div className="leading-tight"><p className="text-lg font-semibold tracking-tight">Converge-J Fiber</p><p className="text-sm text-muted">Backbone Command</p></div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
          <form className="rounded-2xl border border-border bg-surface p-6" onSubmit={e => { e.preventDefault(); go(email, password) }}>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <label className="mt-5 block text-[13px] font-medium">Email
              <input type="email" autoComplete="username" value={email} onChange={e => { setEmail(e.target.value); setError('') }} className={`${input} mt-1.5`} placeholder="you@company.com" required />
            </label>
            <label className="mt-4 block text-[13px] font-medium">Password
              <input type="password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} className={`${input} mt-1.5`} required />
            </label>
            {error && <p role="alert" className="mt-3 text-[13px] text-bad">{error}</p>}
            <button className="mt-5 h-11 w-full rounded-xl bg-text text-[15px] font-semibold text-bg">Sign in</button>
            <p className="mt-4 flex gap-2 text-xs text-muted"><KeyRound size={14} className="mt-0.5 shrink-0" /><span>Prototype sign-in with demo accounts (password <span className="font-mono text-text">{DEMO_PASSWORD}</span>). The live system uses company accounts.</span></p>
          </form>

          <section className="rounded-2xl border border-border bg-surface p-6" aria-labelledby="demo-h">
            <h2 id="demo-h" className="text-[15px] font-semibold">Demo accounts</h2>
            <p className="mt-0.5 text-[13px] text-muted">Each role sees a different slice of the same data.</p>

            <RoleBlock icon={<ShieldCheck size={16} />} title={ROLE_LABEL.admin} note="Converge-J Fiber Backbone Build / PMO. Everything, including Settings and running the month-end close.">
              {byRole('admin').map(a => <Chip key={a.email} onClick={() => quick(a)}>{a.name}</Chip>)}
            </RoleBlock>

            <RoleBlock icon={<Users size={16} />} title={ROLE_LABEL.manager} note="One per MSP. Sees only their own POs, crews, incidents and scorecard; acknowledges LD notices.">
              {byRole('manager').map(a => <Chip key={a.email} onClick={() => quick(a)}>{a.contractorId}</Chip>)}
            </RoleBlock>

            <RoleBlock icon={<HardHat size={16} />} title={ROLE_LABEL.ground} note="Linemen and crew leads. Field App only, for their own crew.">
              <div className="flex w-full gap-2">
                <select aria-label="Crew account" value={crew} onChange={e => setCrew(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 text-[13px]">
                  <option value="">Choose a crew lead…</option>
                  {byRole('ground').map(a => <option key={a.email} value={a.email}>{a.name} · Crew {a.crewId} · {a.contractorId}</option>)}
                </select>
                <button type="button" disabled={!crew} onClick={() => go(crew, DEMO_PASSWORD)} className="h-9 rounded-lg bg-text px-3 text-[13px] font-medium text-bg disabled:opacity-40">Sign in as crew</button>
              </div>
            </RoleBlock>
          </section>
        </div>
      </div>
    </main>
  )
}

function RoleBlock({ icon, title, note, children }: { icon: React.ReactNode; title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold">{icon}{title}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

const Chip = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="rounded-full border border-border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 hover:bg-surface-2">{children}</button>
)
