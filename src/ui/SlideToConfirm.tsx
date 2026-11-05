// motionbook B12 "Slide to Confirm" (Tactile): drag the knob to the end to send. Prevents pocket/glove
// submits in the field. Keyboard: focus the knob and press Enter or Space.
import { useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'

export function SlideToConfirm({ label, disabled, onConfirm }: { label: string; disabled?: boolean; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [done, setDone] = useState(false)
  const reduce = useReducedMotion()
  const KNOB = 52
  const max = () => (track.current?.offsetWidth ?? 300) - KNOB - 8
  const fill = useTransform(x, v => v + KNOB)
  const labelOpacity = useTransform(x, [0, 120], [1, 0])

  const confirm = () => {
    if (done || disabled) return
    setDone(true)
    navigator.vibrate?.(12)
    animate(x, max(), reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 })
    setTimeout(onConfirm, reduce ? 0 : 220)
  }

  return (
    <div ref={track} className={`relative h-[60px] select-none overflow-hidden rounded-full border border-border bg-surface-2 p-1 ${disabled ? 'opacity-60' : ''}`}>
      <motion.div aria-hidden="true" className="absolute inset-y-1 left-1 rounded-full" style={{ width: fill, background: 'var(--brand-gradient)', opacity: 0.9 }} />
      <motion.span aria-hidden="true" style={{ opacity: labelOpacity }} className="pointer-events-none absolute inset-0 grid place-items-center pl-10 text-sm font-medium text-muted">
        {disabled ? 'Complete the required items first' : label}
      </motion.span>
      <motion.button
        type="button" aria-label={disabled ? `${label} (not ready)` : `${label}. Press Enter to confirm.`} aria-disabled={disabled}
        drag={disabled || done ? false : 'x'} dragConstraints={track} dragElastic={0} dragMomentum={false} style={{ x, width: KNOB }}
        onDragEnd={() => (x.get() > max() * 0.9 ? confirm() : animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 }))}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm() } }}
        className="relative z-10 grid h-[50px] cursor-grab place-items-center rounded-full bg-text text-bg shadow-[var(--shadow)] active:cursor-grabbing"
      >
        {done ? <Check size={22} strokeWidth={2.5} /> : <ArrowRight size={22} />}
      </motion.button>
    </div>
  )
}
