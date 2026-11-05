import type { ReactNode } from 'react'

/** A titled region of a dashboard: hairline border, no nested cards. */
export function Panel({ title, sub, action, children, className = '' }: { title: string; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Every chart has a table view (accessibility + exact numbers). */
export function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer select-none text-muted hover:text-text">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr>{head.map(h => <th key={h} scope="col" className="border-b border-border py-1 pr-3 font-medium text-muted">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border/60 py-1 pr-3">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  )
}
