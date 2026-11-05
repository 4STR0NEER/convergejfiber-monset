// Bottom sheet. Mechanics adapted from VengeanceUI's ShareSheet (MIT, github.com/Ashutoshx7/VengeanceUI):
// shared body-scroll lock, focus trap, Escape to close, focus return, spring 410/34.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'

let locks = 0, before = ''
function lockBodyScroll() {
  if (locks++ === 0) { before = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  let released = false
  return () => { if (released) return; released = true; if (--locks === 0) document.body.style.overflow = before }
}

/** `within`: render inside this element (e.g. the desktop phone frame) instead of over the whole page. */
export function Sheet({ open, title, onClose, children, within }: { open: boolean; title: string; onClose: () => void; children: ReactNode; within?: HTMLElement | null }) {
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const id = useId()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement as HTMLElement
    const release = lockBodyScroll()
    const focusables = () => panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]')
    requestAnimationFrame(() => focusables()?.[0]?.focus())
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const n = focusables(); if (!n?.length) return
      const first = n[0], last = n[n.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { release(); document.removeEventListener('keydown', key); setTimeout(() => returnTo.current?.focus(), 30) }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`${within ? 'absolute' : 'fixed'} inset-0 z-50 flex items-end justify-center`}>
          <motion.div className="absolute inset-0 bg-black/55" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} />
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 410, damping: 34 }}
            className="relative max-h-[92%] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-border bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
              <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
              <h2 id={id} className="text-base font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-surface-2"><X size={18} /></button>
            </div>
            <div className="px-5 pt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    within ?? document.body,
  )
}
