// motionbook D1 "Check Draw": the ring draws itself, fills with the brand gradient, the check strokes in.
import { motion, useReducedMotion } from 'motion/react'

export function CheckDraw({ size = 96 }: { size?: number }) {
  const reduce = useReducedMotion()
  const t = (d: number, delay = 0) => (reduce ? { duration: 0 } : { duration: d, delay, ease: [0.65, 0, 0.35, 1] as const })
  return (
    <motion.svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"
      animate={reduce ? {} : { scale: [1, 1.05, 1] }} transition={{ delay: 1.6, duration: 0.3 }}>
      <defs>
        <linearGradient id="cd-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-orange)" /><stop offset=".55" stopColor="var(--brand-magenta)" /><stop offset="1" stopColor="var(--brand-violet)" />
        </linearGradient>
      </defs>
      <motion.circle cx="50" cy="50" r="44" fill="url(#cd-g)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.24, 1.1)} />
      <motion.circle cx="50" cy="50" r="44" fill="none" stroke="url(#cd-g)" strokeWidth="5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(1.1)} style={{ rotate: -90, originX: '50%', originY: '50%' }} />
      <motion.path d="M31 51l13 13 26-28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.3, 1.3)} />
    </motion.svg>
  )
}
