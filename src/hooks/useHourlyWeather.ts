import { useEffect, useState } from 'react'
import { fetchHourlyWeather, REFRESH_MS, type HourlyWeather } from '../lib/weatherHourly'

/** The hourly collector's weather for these nodes, re-read every REFRESH_MS; null until the first read. */
export function useHourlyWeather(nodeIds: string[]): HourlyWeather | null {
  const [data, setData] = useState<HourlyWeather | null>(null)
  const key = nodeIds.join(',')

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const load = () =>
      fetchHourlyWeather(key.split(','), controller.signal)
        .then((w) => setData(Object.keys(w).length ? w : null))
        .catch(() => undefined) // a failed read keeps the last one (or the daily-based weather)
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [key])

  return data
}
