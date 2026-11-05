// Wedge + fluid tabs. The active pill is a clip-path window whose leading edge springs ahead and the
// trailing edge catches up (it stretches like liquid). A gradient wedge under it points into the page
// and leans with its own velocity. Motion springs; instant under reduced motion.
import { useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform, useVelocity } from 'motion/react'

export interface Tab { to: string; label: string; /** Extra path prefixes that belong to this tab. */ also?: string[] }

const LEAD = { type: 'spring', stiffness: 620, damping: 38 } as const
const TRAIL = { type: 'spring', stiffness: 240, damping: 26, mass: 1.1 } as const

export function NavTabs({ tabs }: { tabs: Tab[] }) {
  const { pathname } = useLocation()
  const active = Math.max(0, tabs.findIndex(t => (t.to === '/' ? pathname === '/' : [t.to, ...(t.also ?? [])].some(p => pathname.startsWith(p)))))
  const wrap = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLAnchorElement | null)[]>([])
  const reduce = useReducedMotion()

  const left = useMotionValue(0)
  const right = useMotionValue(0)
  const width = useMotionValue(0)
  const prev = useRef<number | null>(null)

  useLayoutEffect(() => {
    const place = (instant: boolean) => {
      const el = items.current[active], box = wrap.current
      if (!el || !box) return
      const l = el.offsetLeft + 2, r = el.offsetLeft + el.offsetWidth - 2
      width.set(box.scrollWidth)
      if (instant || reduce || prev.current === null) { left.jump(l); right.jump(r); return }
      const forward = active > prev.current
      animate(left, l, forward ? TRAIL : LEAD)
      animate(right, r, forward ? LEAD : TRAIL)
    }
    place(false)
    prev.current = active
    const ro = new ResizeObserver(() => place(true))
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [active, reduce, left, right, width])

  const clip = useMotionTemplate`inset(5px calc(${width}px - ${right}px) 5px ${left}px round 999px)`
  const center = useTransform(() => (left.get() + right.get()) / 2)
  const vel = useVelocity(center)
  const lean = useTransform(vel, [-2400, 0, 2400], [28, 0, -28], { clamp: true })
  const wedgeX = useTransform(center, c => c - 9)
  const wedgeBg = useTransform(center, c => `${-(c - 9)}px 0`)
  const wedgeSize = useMotionTemplate`${width}px 100%`

  return (
    <nav aria-label="Main" className="relative min-w-0">
      <div ref={wrap} className="relative flex overflow-x-auto [scrollbar-width:none]">
        {/* fluid pill */}
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ clipPath: clip, background: 'color-mix(in oklab, var(--text) 9%, transparent)' }} />
        {tabs.map((t, i) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} ref={el => { items.current[i] = el }}
            className={`relative z-10 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-150
              ${i === active ? 'text-text' : 'text-muted hover:text-text'}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
      {/* wedge: the brand gradient, sampled at its own position, pointing into the page */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute -bottom-[13px] left-0 h-[9px] w-[18px]"
        style={{
          x: wedgeX, skewX: lean, originY: 0,
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          backgroundImage: 'var(--brand-gradient)', backgroundSize: wedgeSize, backgroundPosition: wedgeBg,
        }} />
    </nav>
  )
}
