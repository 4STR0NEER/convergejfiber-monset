// Adapted from Skiper UI "skiper26" theme toggle (free component, attribution: skiper-ui.com).
// Kept only the idea: a View Transition whose new snapshot is revealed as a circle growing from the button.
import { flushSync } from 'react-dom'

export function revealTheme(apply: () => void, from: HTMLElement) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce) return apply()
  const r = from.getBoundingClientRect()
  const x = r.left + r.width / 2, y = r.top + r.height / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const t = document.startViewTransition(() => flushSync(apply))
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
}
