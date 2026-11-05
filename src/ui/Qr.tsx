// Local QR code (qrcode-generator, MIT) as in VengeanceUI's ShareSheet: no API, no external image.
import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

export function Qr({ text, size = 160, label }: { text: string; size?: number; label: string }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount(), m = 3, w = n + m * 2
    let rects = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) rects += `<rect x="${x + m}" y="${y + m}" width="1" height="1"/>`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${w}v${w}H0z"/><g fill="#0d0b14">${rects}</g></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [text])
  return <img src={src} width={size} height={size} alt={label} className="rounded-lg" />
}
