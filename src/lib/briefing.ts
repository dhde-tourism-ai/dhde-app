import { useSyncExternalStore } from 'react'
import type { LiveData, RealNodeMeta } from '../types/live'

/**
 * Briefing mode: the view for officials. Only real data and model forecasts are shown: no demo
 * layers, no simulated hourly shapes, no guessed capacities, and no "demo" wording. Full view is
 * the team's working view with everything.
 */
const KEY = 'dhde.mode'
const listeners = new Set<() => void>()

function initial(): boolean {
  const q = new URLSearchParams(window.location.search).get('mode')
  if (q === 'full') return false
  if (q === 'briefing') return true
  try {
    return window.localStorage.getItem(KEY) !== 'full'
  } catch {
    return true
  }
}

let current = initial()

export function setBriefing(on: boolean) {
  current = on
  try {
    window.localStorage.setItem(KEY, on ? 'briefing' : 'full')
  } catch {
    /* storage blocked: the choice still holds for this visit */
  }
  listeners.forEach((l) => l())
}

export function useBriefing(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

/**
 * Layers briefing mode offers, each showing its real part only: the four defaults (visitors, hotels,
 * actions, bus access), then real layers to switch on (train lines without the illustrative moving
 * trains; weather; survey, sentiment and search where a site has real values). Simulated flow and
 * density, demo road traffic, fictional reviews and social feed, and partial economics are left out.
 */
export const BRIEFING_LAYERS = ['people', 'hotels', 'nudges', 'transport', 'rail', 'weather', 'survey', 'sentiment', 'rsi'] as const

export type DayLevel = 'busy' | 'normal' | 'quiet'

export interface DayFigure {
  /** real: the day's visitor estimate from real counts; forecast: the 7-day model; none: neither. */
  kind: 'real' | 'forecast' | 'none' | 'no_estimate'
  value: number | null
  /** Mean of the site's real days, the "usual" a day is compared with. */
  normal: number | null
  level: DayLevel | null
}

/**
 * The one-line method behind a site's visitor estimate. Eiheiji's comes from survey responses
 * scaled to its annual count, so it carries the low-confidence disclaimer.
 */
export function methodNote(m: RealNodeMeta | undefined, lang: 'en' | 'ja'): string | null {
  if (!m) return null
  if (m.measure === 'proxy_survey') {
    return lang === 'ja' ? 'アンケート回答と周辺データからの推計。信頼度は低い。' : 'Estimated from survey responses and nearby data, low confidence.'
  }
  const text = lang === 'ja' ? (m.method_text_ja ?? m.method_text) : m.method_text
  return text ? (lang === 'ja' ? `推計方法：${text}` : `Estimated: ${text}`) : null
}

/** Map circle radius: area grows with the day's visitors (a day total, not people on site at once). */
export const dayRadius = (v: number | null) => (v === null ? 9 : 7 + Math.sqrt(Math.max(0, v)) * 0.3)

/** Within 20% of a usual day counts as usual. */
const BAND = 0.2

export const LEVEL: Record<DayLevel, { en: string; ja: string; colour: string }> = {
  busy: { en: 'Busier than usual', ja: '通常より混雑', colour: '#e0663a' },
  normal: { en: 'Usual', ja: '通常どおり', colour: '#2f9e5a' },
  quiet: { en: 'Quieter than usual', ja: '通常より閑散', colour: '#3d7cc9' },
}

/**
 * Each site's visitor figure for day d, from real data only: the real day total where the day is
 * observed, else the forecast model's day total. The rough same-weekday fallback is left out.
 */
export function dayFigures(live: LiveData, d: number): Record<string, DayFigure> {
  const out: Record<string, DayFigure> = {}
  // After the "real data to" date every site shows the model's forecast, as the Summary does,
  // even where advance bookings already give an estimate (those feed "running ahead of forecast").
  const sharedIdx = live.shared_date ? live.days.findIndex((x) => x.date === live.shared_date) : -1
  const afterShared = sharedIdx >= 0 && d > sharedIdx
  for (const [id, n] of Object.entries(live.nodes)) {
    const m = live.node_meta?.[id]
    if (!m) continue
    if (m.no_estimate) {
      out[id] = { kind: 'no_estimate', value: null, normal: null, level: null }
      continue
    }
    const real = afterShared ? null : (m.visitors_daily[d] ?? null)
    let kind: DayFigure['kind'] = 'none'
    let value: number | null = null
    if (real !== null) {
      kind = 'real'
      value = real
    } else if (m.forecast_source_daily[d] === 'model') {
      kind = 'forecast'
      // The model's own day total (as the Summary shows); summing rounded hours drifts by a few.
      value = m.forecast_daily?.[d] ?? n.arrivals.predicted.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0)
    }
    const normal = m.normal_daily
    let level: DayLevel | null = null
    if (value !== null && normal) {
      const r = value / normal
      level = r >= 1 + BAND ? 'busy' : r <= 1 - BAND ? 'quiet' : 'normal'
    }
    out[id] = { kind, value, normal, level }
  }
  return out
}
