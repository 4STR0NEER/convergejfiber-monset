import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 15 * 60_000 // long sessions (live testing, office screens) still hear about new deploys

/** A new deploy waits until the user taps Reload, so a half-filled field form is never wiped by an update. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      if (!reg) return
      const check = () => { if (navigator.onLine) reg.update() }
      setInterval(check, CHECK_EVERY_MS)
      // Coming back to the app (tab switch, phone unlocked) checks right away.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow)]">
      <span className="flex-1">A new version is available. Finish what you are typing, then reload.</span>
      <button onClick={() => setNeedRefresh(false)} className="h-9 rounded-lg px-3 font-medium text-muted">Later</button>
      <button onClick={() => updateServiceWorker(true)} className="h-9 rounded-lg bg-text px-3 font-semibold text-bg">Reload</button>
    </div>
  )
}
