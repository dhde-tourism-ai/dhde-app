/**
 * Abstract placeholder thumbnails for the fictional social posts: a gradient and
 * a simple motif. Never a photo, never a person.
 */
import type { SocialPost } from '../types/market'

const MOTIFS: Record<SocialPost['thumb']['motif'], string> = {
  cliff: '<path d="M0 44 L10 24 L16 30 L22 16 L30 26 L40 18 L40 48 L0 48Z" fill="rgba(10,17,32,.55)"/><path d="M0 40 Q10 36 20 40 T40 40 L40 48 L0 48Z" fill="rgba(255,255,255,.35)"/>',
  train: '<rect x="6" y="20" width="28" height="14" rx="6" fill="rgba(255,255,255,.8)"/><rect x="9" y="23" width="6" height="5" rx="1" fill="rgba(10,17,32,.5)"/><rect x="17" y="23" width="6" height="5" rx="1" fill="rgba(10,17,32,.5)"/><path d="M0 38 H40" stroke="rgba(10,17,32,.5)" stroke-width="2"/>',
  dino: '<path d="M6 36 Q8 22 18 22 Q22 12 30 12 Q34 12 34 16 L30 18 Q28 26 30 30 L34 36 L28 36 L24 30 L16 32 L14 36 L8 36Z" fill="rgba(10,17,32,.6)"/>',
  lake: '<circle cx="30" cy="12" r="5" fill="rgba(255,255,255,.7)"/><ellipse cx="14" cy="36" rx="12" ry="5" fill="rgba(255,255,255,.35)"/><ellipse cx="30" cy="40" rx="9" ry="4" fill="rgba(255,255,255,.3)"/><path d="M0 30 L12 20 L22 28 L32 18 L40 26 L40 30Z" fill="rgba(10,17,32,.45)"/>',
  onsen: '<path d="M10 22 q3 -5 0 -10 M20 22 q3 -5 0 -10 M30 22 q3 -5 0 -10" stroke="rgba(255,255,255,.8)" stroke-width="2" fill="none"/><ellipse cx="20" cy="32" rx="15" ry="6" fill="rgba(255,255,255,.4)"/>',
  temple: '<path d="M4 22 L20 12 L36 22Z" fill="rgba(10,17,32,.6)"/><rect x="10" y="22" width="20" height="14" fill="rgba(10,17,32,.45)"/><path d="M4 30 L20 22 L36 30" stroke="rgba(255,255,255,.4)" fill="none"/>',
}

export function thumbSvg(t: SocialPost['thumb'], size = 48): string {
  const h2 = (t.hue + 50) % 360
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="${size}" height="${Math.round(size * 1.2)}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${t.hue},55%,55%)"/><stop offset="1" stop-color="hsl(${h2},60%,32%)"/></linearGradient></defs><rect width="40" height="48" fill="url(#g)"/>${MOTIFS[t.motif]}</svg>`
}

export function thumbUri(t: SocialPost['thumb']): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(thumbSvg(t))
}
