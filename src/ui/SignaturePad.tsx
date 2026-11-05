// Finger/stylus signature on the crew's phone (Incident Acknowledgment and Undertaking).
import { useEffect, useRef } from 'react'

export function SignaturePad({ value, onChange, label }: { value?: string; onChange: (dataUrl?: string) => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    c.width = r.width * 2; c.height = r.height * 2
    ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = value }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pt = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const }
  return (
    <div>
      <div className="relative rounded-xl border border-border bg-white">
        <canvas ref={canvas} aria-label={label} role="img" className="block h-36 w-full touch-none rounded-xl"
          onPointerDown={e => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const ctx = e.currentTarget.getContext('2d')!; const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y) }}
          onPointerMove={e => { if (!drawing.current) return; const ctx = e.currentTarget.getContext('2d')!; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke() }}
          onPointerUp={e => { drawing.current = false; onChange(e.currentTarget.toDataURL('image/png')) }} />
        <span className="pointer-events-none absolute bottom-2 left-3 right-3 border-t border-dashed border-zinc-400 pt-0.5 text-[10px] text-zinc-500">Sign above</span>
      </div>
      <button type="button" className="mt-1 text-xs text-muted hover:text-text" onClick={() => {
        const c = canvas.current!
        c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
        onChange(undefined)
      }}>Clear signature</button>
    </div>
  )
}
