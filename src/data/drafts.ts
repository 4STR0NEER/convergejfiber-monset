// Unsent field forms, saved on the phone as the crew types (IndexedDB: photos are too big for localStorage).
// A reload, an app update, a dead battery or a killed browser no longer loses a half-filled form.
import { useEffect, useRef } from 'react'
import { del, get, set } from 'idb-keyval'

export interface Draft { at: string; values: Record<string, unknown> }

const key = (id: string) => `cjf.draft.${id}`

export const drafts = {
  get: (id: string) => get<Draft>(key(id)).catch(() => undefined),
  save: (id: string, values: Record<string, unknown>) => set(key(id), { at: new Date().toISOString(), values } satisfies Draft).catch(() => { /* storage blocked: no draft */ }),
  clear: (id: string) => del(key(id)).catch(() => { /* nothing stored */ }),
}

/** Saves the form's values shortly after each change (and right away if the app is hidden). Call clear() once sent. */
export function useDraftSaver(id: string, values: Record<string, unknown>) {
  const latest = useRef(values)
  latest.current = values
  const initial = useRef(Object.values(values))
  const timer = useRef(0)
  const done = useRef(false)

  const flush = () => {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = 0
    if (!done.current) drafts.save(id, latest.current)
  }

  // Each form passes the same keys every render, so the dependency list keeps its length.
  useEffect(() => {
    if (done.current || Object.values(values).every((v, i) => v === initial.current[i])) return // untouched: nothing to save
    clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 400)
  }, Object.values(values)) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); flush() }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { clear: () => { done.current = true; clearTimeout(timer.current); timer.current = 0; return drafts.clear(id) } }
}
