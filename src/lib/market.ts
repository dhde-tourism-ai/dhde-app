/** Encodings for the Market / Voice layers. */

/** Ordinal violet ramp for hotel occupancy (dark surface: fuller = brighter). */
export const OCC_STEPS: { max: number; colour: string; en: string; ja: string }[] = [
  { max: 50, colour: '#3d3a86', en: 'Under 50%', ja: '50%未満' },
  { max: 70, colour: '#6158c9', en: '50–70%', ja: '50〜70%' },
  { max: 85, colour: '#9085e9', en: '70–85%', ja: '70〜85%' },
  { max: 101, colour: '#cdc6ff', en: '85% and over', ja: '85%以上' },
]

export function occupancyColour(pct: number): string {
  return (OCC_STEPS.find((s) => pct < s.max) ?? OCC_STEPS[OCC_STEPS.length - 1]).colour
}

/** Sequential blue for the search-interest index. */
export const RSI_STEPS: { max: number; colour: string; label: string }[] = [
  { max: 40, colour: '#184f95', label: '< 40' },
  { max: 60, colour: '#2f78d0', label: '40–60' },
  { max: 80, colour: '#6da7ec', label: '60–80' },
  { max: 101, colour: '#b7d3f6', label: '80+' },
]

export function rsiColour(v: number): string {
  return (RSI_STEPS.find((s) => v < s.max) ?? RSI_STEPS[RSI_STEPS.length - 1]).colour
}

export function sparkPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ')
}

/** Five stars as an HTML string (filled share = rating / 5). */
export function starsHtml(rating: number, size = 11): string {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100))
  return `<span class="stars" style="--pct:${pct}%;font-size:${size}px" aria-label="${rating.toFixed(1)} of 5">★★★★★</span>`
}
