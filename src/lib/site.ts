/**
 * Day rows for the #/site view (one partner site, real data only): recent
 * actuals from real_data.json, then the model forecast for the days without a
 * count yet. Nothing here falls back to the demo files; a missing value stays null.
 */
import type { LiveData, WeatherCondition } from '../types/live'
import type { RealNode } from '../types/real'
import { isHoliday } from './holidays'
import { DEMAND_THRESHOLD } from './nudges'

export interface DayWeather {
  cond: WeatherCondition
  tMin: number | null
  tMax: number | null
  /** Day total. */
  mm: number | null
  /** Strongest hourly wind (daily mean when only the daily row exists). */
  wind: number | null
}

export interface SiteHotel {
  /** 0..1 */
  occ: number
  sold: number | null
  total: number | null
}

export interface SiteDay {
  date: string
  kind: 'actual' | 'forecast'
  visitors: number
  /** Forecast range (forecast days only). */
  lo: number | null
  hi: number | null
  /** The node's own signal: cars at the summit car parks for Rainbow Line. */
  signal: number | null
  hotel: SiteHotel | null
  weather: DayWeather | null
  weekend: boolean
  holiday: boolean
}

export type DemandLevel = 'quiet' | 'normal' | 'busy'

/** Same rule as the demand-alert nudge: 35% or more off the node's normal day. */
export function demandLevel(visitors: number, normal: number | null): DemandLevel {
  if (!normal) return 'normal'
  const r = visitors / normal - 1
  return r >= DEMAND_THRESHOLD ? 'busy' : r <= -DEMAND_THRESHOLD ? 'quiet' : 'normal'
}

/**
 * The "normal" day: the official annual count / 365 (the year's average day), else the mean
 * visitors_est over the real history. Not real.ts normal_daily: a 90-day mean taken in autumn
 * holds the summer peak, so it would call most autumn weekdays quiet.
 */
export function normalDay(rn: RealNode): { visitors: number; annual: boolean } | null {
  const official = rn.calibration.official_annual_2025
  if (official) return { visitors: official / 365, annual: true }
  const v = rn.daily.map((d) => d.visitors_est).filter((x): x is number => x !== null)
  return v.length ? { visitors: v.reduce((a, b) => a + b, 0) / v.length, annual: false } : null
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const DAY_COND: Partial<Record<WeatherCondition, WeatherCondition>> = { clear_night: 'clear', partly_night: 'partly' }

/**
 * A day's weather from the merged hourly series, using only hours backed by a
 * real source (JMA observation, the JMA-model forecast, or the real daily row);
 * else from the real daily row; else null.
 */
function weatherOn(rn: RealNode, live: LiveData | null, id: string, date: string): DayWeather | null {
  const wx = live?.nodes[id]?.weather
  const d = live?.days.findIndex((x) => x.date === date) ?? -1
  if (wx && d >= 0) {
    const hours = Array.from({ length: 24 }, (_, h) => d * 24 + h).filter((i) => wx.real_days?.[d] || wx.hourly_source?.[i])
    if (hours.length >= 12) {
      const temps = hours.map((i) => wx.temp_c[i])
      const mm = hours.reduce((a, i) => a + (wx.precip_mm[i] ?? 0), 0)
      const conds = hours.map((i) => wx.condition[i])
      const daytime = hours.filter((i) => i % 24 >= 8 && i % 24 < 18).map((i) => DAY_COND[wx.condition[i]] ?? wx.condition[i])
      const common = (daytime.length ? daytime : conds).reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {})
      const cond: WeatherCondition = conds.includes('thunder')
        ? 'thunder'
        : conds.includes('snow')
          ? 'snow'
          : mm >= 30
            ? 'heavy_rain'
            : mm >= 1
              ? 'rain'
              : (Object.entries(common).sort((a, b) => b[1] - a[1])[0][0] as WeatherCondition)
      return { cond, tMin: Math.min(...temps), tMax: Math.max(...temps), mm, wind: Math.max(...hours.map((i) => wx.wind_ms[i])) }
    }
  }
  const r = rn.daily.find((x) => x.date === date)
  if (!r || (r.temp_c === null && r.precip_mm === null)) return null
  const mm = r.precip_mm
  const cond: WeatherCondition = (mm ?? 0) >= 30 ? 'heavy_rain' : (mm ?? 0) >= 1 ? 'rain' : (r.sun_h ?? 0) >= 0.5 ? 'clear' : (r.sun_h ?? 0) >= 0.2 ? 'partly' : 'cloudy'
  return { cond, tMin: r.temp_c, tMax: r.temp_c, mm, wind: r.wind_ms }
}

/**
 * The last `pastDays` days with a real count before `today`, then every forecast
 * day after the last count (yesterday can be a forecast day while its count is pending).
 */
export function siteDays(id: string, rn: RealNode, live: LiveData | null, today: string, pastDays = 21): SiteDay[] {
  const from = addDays(today, -pastDays)
  const actual = rn.daily.filter((d) => d.date >= from && d.date <= today && d.visitors_est !== null)
  const lastActual = actual.at(-1)?.date ?? addDays(from, -1)
  const forward = new Map(rn.hotel_forward.map((h) => [h.date, h]))
  const base = (date: string) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    return { weather: weatherOn(rn, live, id, date), weekend: dow === 0 || dow === 6, holiday: isHoliday(date) }
  }
  const rows: SiteDay[] = actual.map((d) => ({
    date: d.date,
    kind: 'actual',
    visitors: d.visitors_est!,
    lo: null,
    hi: null,
    signal: d.signal,
    hotel: d.hotel_occ === null ? null : { occ: d.hotel_occ, sold: d.hotel_rooms_sold, total: d.hotel_rooms_total },
    ...base(d.date),
  }))
  for (const f of rn.forecast?.days ?? []) {
    if (f.date <= lastActual || f.visitors_est === null) continue
    const h = forward.get(f.date)
    rows.push({
      date: f.date,
      kind: 'forecast',
      visitors: f.visitors_est,
      lo: f.visitors_lo,
      hi: f.visitors_hi,
      signal: f.signal,
      hotel: h?.hotel_occ == null ? null : { occ: h.hotel_occ, sold: h.hotel_rooms_sold, total: h.hotel_rooms_total },
      ...base(f.date),
    })
  }
  return rows
}
