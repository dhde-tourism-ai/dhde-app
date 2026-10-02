/**
 * Hourly weather per node, read at page load and every REFRESH_MS from two places:
 * - dhde-preprocessing-model's live-data history (weather_hourly/{node}.csv, from
 *   its collector): the JMA station's observations, and its saved forecast.
 * - Open-Meteo's JMA-model forecast, asked directly (one request, CORS open): the
 *   collector is scheduled hourly but GitHub runs it only a few times a day, so
 *   the forecast the app shows comes straight from the source.
 * An observation always wins; the live forecast beats the saved one. A node with
 * neither, or a failed fetch, keeps the daily-based weather.
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

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const FORECAST_DAYS = 9 // as the collector: today and the 7 days the timeline shows, plus one

export interface NodePoint {
  id: string
  lat: number
  lon: number
}

interface OpenMeteoPoint {
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; precipitation?: (number | null)[]; wind_speed_10m?: (number | null)[]; relative_humidity_2m?: (number | null)[]; weather_code?: (number | null)[] }
}

/** Every node's forecast in one Open-Meteo request (the same model and units as the collector). */
export async function fetchLiveForecast(points: NodePoint[], signal?: AbortSignal): Promise<HourlyWeather> {
  if (!points.length) return {}
  const q = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    models: 'jma_seamless',
    timezone: 'Asia/Tokyo',
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: 'ms',
    hourly: 'temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code',
  })
  const r = await fetch(`${FORECAST_URL}?${q}`, { signal })
  if (!r.ok) throw new Error(`Open-Meteo: HTTP ${r.status}`)
  const body = (await r.json()) as OpenMeteoPoint | OpenMeteoPoint[]
  const list = Array.isArray(body) ? body : [body]
  if (list.length !== points.length) throw new Error(`Open-Meteo: ${list.length} points for ${points.length}`)
  const issued = new Date().toISOString()
  const out: HourlyWeather = {}
  points.forEach((p, i) => {
    const h = list[i].hourly
    if (!h?.time) return
    const rows = new Map<string, HourlyWeatherRow>()
    h.time.forEach((t, k) => {
      // "2026-10-02T13:00" → "2026-10-02 13", the CSV's key.
      rows.set(`${t.slice(0, 10)} ${t.slice(11, 13)}`, {
        source: 'forecast',
        temp_c: h.temperature_2m?.[k] ?? null,
        precip_mm: h.precipitation?.[k] ?? null,
        wind_ms: h.wind_speed_10m?.[k] ?? null,
        humidity_pct: h.relative_humidity_2m?.[k] ?? null,
        weather_code: h.weather_code?.[k] ?? null,
        issued_at: issued,
      })
    })
    out[p.id] = rows
  })
  return out
}

/** The saved history with the live forecast laid over it: an observation is never replaced. */
export function mergeHourly(saved: HourlyWeather, live: HourlyWeather): HourlyWeather {
  const out: HourlyWeather = {}
  for (const id of new Set([...Object.keys(saved), ...Object.keys(live)])) {
    const rows = new Map(saved[id] ?? [])
    for (const [k, r] of live[id] ?? []) if (rows.get(k)?.source !== 'observed') rows.set(k, r)
    if (rows.size) out[id] = rows
  }
  return out
}

/** The saved history and the live forecast, merged; either may fail on its own. */
export async function fetchAllHourly(points: NodePoint[], signal?: AbortSignal): Promise<HourlyWeather> {
  const [saved, live] = await Promise.all([
    fetchHourlyWeather(points.map((p) => p.id), signal),
    fetchLiveForecast(points, signal).catch(() => ({}) as HourlyWeather),
  ])
  return mergeHourly(saved, live)
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
