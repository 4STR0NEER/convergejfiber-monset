import { Component, type ReactNode } from 'react'

/** A broken screen should not take the whole app down; the nav stays usable. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <section role="alert" className="mx-auto max-w-xl px-6 py-24">
        <h1 className="text-xl font-semibold">This screen hit a problem</h1>
        <p className="mt-2 text-muted">Your data is safe. Try reloading, or open another tab above.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-muted">{this.state.error.message}</pre>
        <button onClick={() => location.reload()} className="mt-4 rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg">Reload</button>
      </section>
    )
  }
}

/** Shown for the split second a screen's code is loading. Quiet on purpose. */
export function ScreenLoading() {
  return <div role="status" className="grid h-full min-h-[40vh] place-items-center text-sm text-muted">Loading…</div>
}
