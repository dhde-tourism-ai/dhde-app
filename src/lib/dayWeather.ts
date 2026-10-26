/**
 * One day's weather for a node from real sources only: the merged hourly series
 * where its hours come from JMA (observation or the JMA-model forecast) or the
 * real daily row, else the real daily row itself, else null. Never the demo.
 */
import type { LiveData, WeatherCondition } from '../types/live'
import type { RealNode } from '../types/real'

export interface DayWeather {
  cond: WeatherCondition
  tMin: number | null
  tMax: number | null
  /** Day total. */
  mm: number | null
  /** Strongest hourly wind (the daily mean when only the daily row exists). */
  wind: number | null
}

const DAY_COND: Partial<Record<WeatherCondition, WeatherCondition>> = { clear_night: 'clear', partly_night: 'partly' }

export function dayWeather(rn: RealNode | undefined, live: LiveData | null, id: string, date: string): DayWeather | null {
  const wx = live?.nodes[id]?.weather
  const d = live?.days.findIndex((x) => x.date === date) ?? -1
  if (wx && d >= 0) {
    const hours = Array.from({ length: 24 }, (_, h) => d * 24 + h).filter((i) => wx.real_days?.[d] || wx.hourly_source?.[i])
    if (hours.length >= 12) {
      const temps = hours.map((i) => wx.temp_c[i])
      const mm = hours.reduce((a, i) => a + (wx.precip_mm[i] ?? 0), 0)
      const conds = hours.map((i) => wx.condition[i])
      const daytime = hours.filter((i) => i % 24 >= 8 && i % 24 < 18).map((i) => DAY_COND[wx.condition[i]] ?? wx.condition[i])
      const counts = (daytime.length ? daytime : conds).reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {})
      const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as WeatherCondition
      const cond: WeatherCondition = conds.includes('thunder') ? 'thunder' : conds.includes('snow') ? 'snow' : mm >= 30 ? 'heavy_rain' : mm >= 1 ? 'rain' : common
      return { cond, tMin: Math.min(...temps), tMax: Math.max(...temps), mm, wind: Math.max(...hours.map((i) => wx.wind_ms[i])) }
    }
  }
  const r = rn?.daily.find((x) => x.date === date)
  if (!r || (r.temp_c === null && r.precip_mm === null)) return null
  const mm = r.precip_mm ?? 0
  const cond: WeatherCondition = mm >= 30 ? 'heavy_rain' : mm >= 1 ? 'rain' : (r.sun_h ?? 0) >= 0.5 ? 'clear' : (r.sun_h ?? 0) >= 0.2 ? 'partly' : 'cloudy'
  return { cond, tMin: r.temp_c, tMax: r.temp_c, mm: r.precip_mm, wind: r.wind_ms }
}
