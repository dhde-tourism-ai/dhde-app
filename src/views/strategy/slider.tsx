/**
 * The Strategy page's scenario slider (Q1 what-if, Q5 packages): a full-width
 * bar, a dashed marker at the current position with the value above it, and a
 * ruler underneath. An optional reference (e.g. last year's actual growth) is
 * marked on the ruler in green; clicking it moves the slider there.
 */

/** Thumb diameter in px (pages.css .scn input). */
const THUMB = 18

/** A round tick spacing giving at most `n` intervals across the range. */
function niceStep(range: number, n = 4): number {
  const raw = range / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw - 1e-9) return m * mag
  return 10 * mag
}

export interface SliderReference {
  value: number
  label: string
  title?: string
}

export function ScenarioSlider({
  min,
  max,
  step,
  value,
  onChange,
  colour,
  format,
  tickFormat = format,
  label,
  labelStep,
  reference,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  colour: string
  /** The value shown above the marker. */
  format: (v: number) => string
  /** Ruler labels (defaults to `format`). */
  tickFormat?: (v: number) => string
  /** Accessible name. */
  label: string
  /** Ruler label spacing; minor ticks fall halfway. Defaults to a round step with at most 4 intervals. */
  labelStep?: number
  reference?: SliderReference | null
}) {
  const span = max - min
  const at = (v: number) => (v - min) / span
  const f = at(value)
  // The thumb's centre runs from THUMB/2 to (width − THUMB/2): the marker, value and ruler share that span.
  const onTrack = (x: number) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${x})`
  const major = labelStep ?? niceStep(span)
  const minor = major / 2
  const ticks: { v: number; major: boolean }[] = []
  for (let v = Math.ceil(min / minor - 1e-9) * minor; v <= max + 1e-9; v += minor) {
    const r = Math.round(v * 1e6) / 1e6
    ticks.push({ v: r, major: Math.abs(r / major - Math.round(r / major)) < 1e-6 })
  }
  const ref = reference && reference.value >= min && reference.value <= max ? reference : null
  // Ruler labels closer than this (share of the bar) to the reference give way to it.
  const clear = 0.07
  return (
    <div className="scn" style={{ ['--c' as string]: colour }}>
      <div className="scn-value-row">
        {/* Shift the value from left-aligned at the start to right-aligned at the end, so it never leaves the card. */}
        <span className="scn-value num" style={{ left: onTrack(f), transform: `translateX(${-f * 100}%)` }}>
          {format(value)}
        </span>
      </div>
      <div className="scn-track">
        <span className="scn-marker" style={{ left: onTrack(f) }} aria-hidden="true" />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ ['--pct' as string]: `${f * 100}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={format(value)}
        />
      </div>
      <div className="scn-ruler">
        {ticks.map((tk) => {
          const hide = ref !== null && Math.abs(at(tk.v) - at(ref.value)) < clear
          return (
            <span key={tk.v} className={`scn-tick ${tk.major ? 'major' : ''} ${tk.v === 0 && min < 0 ? 'zero' : ''}`} style={{ left: `${at(tk.v) * 100}%` }} aria-hidden="true">
              {tk.major && !hide && <span className="scn-tick-label num">{tickFormat(tk.v)}</span>}
            </span>
          )
        })}
        {ref && (
          <button type="button" className="scn-ref num" style={{ left: `${at(ref.value) * 100}%` }} onClick={() => onChange(ref.value)} title={ref.title}>
            {ref.label}
          </button>
        )}
      </div>
    </div>
  )
}
