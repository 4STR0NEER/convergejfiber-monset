// Generated placeholder "field photos" (no external images). Deterministic per id:
// a dusk street scene with poles and cable, or a trench with duct, stamped like a geotagged photo.
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

export function photoUrl(id: string, stamp: string) {
  const h = hash(id)
  const rnd = (n: number) => ((h >>> (n % 24)) % 1000) / 1000
  const sky = [['#2b1a3d', '#ff8a47'], ['#1c2340', '#d6337f'], ['#3a2a4f', '#f2b07a'], ['#20304a', '#9ab7d3']][h % 4]
  const trench = h % 3 === 0
  const poles = Array.from({ length: 4 }, (_, i) => 30 + i * 85 + rnd(i) * 20)
  const scene = trench
    ? `<rect y="150" width="320" height="90" fill="#4a3b30"/><path d="M0 175 L320 160 L320 200 L0 215Z" fill="#2a211b"/>
       <path d="M0 196 C80 190 200 186 320 180" stroke="#ff6b1a" stroke-width="6" fill="none"/>
       <path d="M0 204 C80 198 200 194 320 188" stroke="#2f80ed" stroke-width="5" fill="none"/>
       <rect x="${200 + rnd(3) * 60}" y="120" width="34" height="34" rx="3" fill="#8d8d8d"/>`
    : `<rect y="170" width="320" height="70" fill="#2b2b33"/><path d="M0 200h320" stroke="#e8d36a" stroke-dasharray="18 14" stroke-width="2"/>
       ${poles.map(x => `<rect x="${x}" y="58" width="5" height="114" fill="#3b3540"/><rect x="${x - 10}" y="66" width="25" height="3" fill="#3b3540"/>`).join('')}
       <path d="M${poles[0] + 2} 72 ${poles.slice(1).map((x, i) => `Q${(poles[i] + x) / 2 + 2} ${86 + rnd(i + 5) * 8} ${x + 2} 72`).join(' ')}" stroke="#111" stroke-width="2" fill="none"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="320" height="240" fill="url(#s)"/>
    <path d="M0 150 L40 120 L90 135 L140 105 L200 128 L260 110 L320 130 L320 170 L0 170Z" fill="#000" opacity=".25"/>
    ${scene}
    <rect y="214" width="320" height="26" fill="#000" opacity=".55"/>
    <text x="8" y="231" font-family="monospace" font-size="11" fill="#fff">${stamp}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Real photos are stored as data URLs; seeded ones are ids for the generated placeholder. */
export const photoSrc = (id: string, stamp: string) => (id.startsWith('data:') ? id : photoUrl(id, stamp))

/** Shrink a camera photo to ~1280px JPEG so the offline outbox stays small. */
export async function compressPhoto(file: File, max = 1280): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.72)
}
