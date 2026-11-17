// Shown once after an invitation (or reset) email link signs the user in: they choose the password they will use from now on.
import { useState } from 'react'
import { KeyRound } from 'lucide-react'

const input = 'h-11 w-full rounded-xl border border-border bg-bg px-3 text-[15px] outline-none focus:border-[var(--accent)]'

export function SetPassword({ name, onDone }: { name: string; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (pw.length < 10) return setError('Use at least 10 characters.')
    if (pw !== again) return setError('The two passwords do not match.')
    setBusy(true)
    const { supabase } = await import('../../data/supabaseClient')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <form className="w-full max-w-md rounded-2xl border border-border bg-surface p-6" onSubmit={e => { e.preventDefault(); save() }}>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><KeyRound size={20} aria-hidden="true" />Choose your password</h1>
        <p className="mt-1 text-[13px] text-muted">Welcome, {name}. You will sign in with your email and this password from now on.</p>
        <label className="mt-5 block text-[13px] font-medium">New password
          <input type="password" autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setError('') }} className={`${input} mt-1.5`} required />
        </label>
        <label className="mt-4 block text-[13px] font-medium">Type it again
          <input type="password" autoComplete="new-password" value={again} onChange={e => { setAgain(e.target.value); setError('') }} className={`${input} mt-1.5`} required />
        </label>
        {error && <p role="alert" className="mt-3 text-[13px] text-bad">{error}</p>}
        <button disabled={busy} className="mt-5 h-11 w-full rounded-xl bg-text text-[15px] font-semibold text-bg disabled:opacity-60">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  )
}
