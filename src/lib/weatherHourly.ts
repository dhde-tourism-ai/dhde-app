/**
 * Hourly weather per node, read live from dhde-preprocessing-model's live-data
 * branch (weather_hourly/{node}.csv, written every hour by its collector): the
 * JMA station's observation where that hour's page is out, else the latest
 * Open-Meteo JMA-model forecast. Read at page load and every REFRESH_MS, so the
 * weather loop and the nudges follow the hourly collector without a redeploy.
 * A node with no file, or a failed fetch, keeps the daily-based weather.
 */
import type { WeatherCondition } from '../types/live'
import { LIVE_DATA_URL } from './dataSource'

const BASE = `${LIVE_DATA_URL}/weather_hourly`
export const REFRESH_MS = 30 * 60 * 1000

export interface HourlyWeatherRow {
  source: 'observed' | 'forecast'
  temp_c: number | null
  precip_mm: number | null
  wind_ms: number | null
  humidity_pct: number | null
  weather_code: number | null
  issued_at: string | null
}

/** node id → "YYYY-MM-DD HH" (JST, the hour the values were measured up to) → row. */
export type HourlyWeather = Record<string, Map<string, HourlyWeatherRow>>

const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export function parseHourlyCsv(text: string): Map<string, HourlyWeatherRow> {
  const out = new Map<string, HourlyWeatherRow>()
  const [head, ...lines] = text.trim().split(/\r?\n/)
  const cols = (head ?? '').split(',')
  const at = (name: string) => cols.indexOf(name)
  const iTs = at('timestamp')
  const iSrc = at('source')
  if (iTs < 0 || iSrc < 0) return out
  for (const line of lines) {
    const v = line.split(',')
    const ts = v[iTs]
    const src = v[iSrc]
    if (!ts || ts.length < 13 || (src !== 'observed' && src !== 'forecast')) continue
    out.set(ts.slice(0, 13), {
      source: src,
      temp_c: num(v[at('temp_c')]),
      precip_mm: num(v[at('precip_1h_mm')]),
      wind_ms: num(v[at('wind_speed_ms')]),
      humidity_pct: num(v[at('humidity_pct')]),
      weather_code: num(v[at('weather_code')]),
      issued_at: v[at('issued_at')] || null,
    })
  }
  return out
}

export async function fetchHourlyWeather(nodeIds: string[], signal?: AbortSignal): Promise<HourlyWeather> {
  const res = await Promise.all(
    nodeIds.map(async (id) => {
      try {
        const r = await fetch(`${BASE}/${id}.csv`, { signal, cache: 'no-cache' })
        return r.ok ? ([id, parseHourlyCsv(await r.text())] as const) : null
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(res.filter((x): x is NonNullable<typeof x> => !!x && x[1].size > 0))
}

/**
 * The row for the app's hour slot h (h:00 to h+1:00) on `date`. JMA and Open-Meteo
 * label an hour by its end (rain at 13:00 fell 12:00 to 13:00), so slot h reads h+1.
 */
export function rowForSlot(rows: Map<string, HourlyWeatherRow> | undefined, date: string, h: number): HourlyWeatherRow | undefined {
  if (!rows) return undefined
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCHours(h + 1)
  return rows.get(`${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 13)}`)
}

/** An hour usable as real weather: a temperature and a rain amount (a missing amount isn't a dry hour). */
export function usable(r: HourlyWeatherRow | undefined): r is HourlyWeatherRow {
  return !!r && r.temp_c !== null && r.precip_mm !== null
}

/** WMO weather code (forecast) or the rain amount (observation) → the app's icon. */
export function conditionOf(r: HourlyWeatherRow, h: number): WeatherCondition {
  const night = h < 6 || h >= 18
  const mm = r.precip_mm ?? 0
  const c = r.weather_code
  if (c !== null) {
    if (c >= 95) return 'thunder'
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'
    if (c === 45 || c === 48) return 'fog'
    if (c >= 51) return mm >= 8 || c === 65 || c === 82 ? 'heavy_rain' : 'rain'
    if (c === 3) return 'cloudy'
    if (c === 2) return night ? 'partly_night' : 'partly'
    return night ? 'clear_night' : 'clear'
  }
  if (mm >= 8) return 'heavy_rain'
  if (mm >= 0.5) return (r.temp_c ?? 5) < 1 ? 'snow' : 'rain'
  // A dry observed hour: JMA's hourly page gives no sky, so neither sun nor cloud.
  return night ? 'partly_night' : 'partly'
}

/** Chance of rain shown for the hour: the sources give amounts, not a probability. */
export function popOf(r: HourlyWeatherRow): number {
  const mm = r.precip_mm ?? 0
  return mm >= 1 ? 90 : mm >= 0.3 ? 70 : mm > 0 ? 40 : 10
}
