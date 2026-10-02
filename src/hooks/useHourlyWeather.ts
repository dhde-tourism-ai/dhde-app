import { useEffect, useState } from 'react'
import { fetchAllHourly, REFRESH_MS, type HourlyWeather, type NodePoint } from '../lib/weatherHourly'

/** Saved observations plus the live forecast for these nodes, re-read every REFRESH_MS; null until the first read. */
export function useHourlyWeather(points: NodePoint[]): HourlyWeather | null {
  const [data, setData] = useState<HourlyWeather | null>(null)
  const key = points.map((p) => `${p.id}:${p.lat},${p.lon}`).join(';')

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const load = () =>
      fetchAllHourly(
        key.split(';').map((s) => {
          const [id, ll] = s.split(':')
          const [lat, lon] = ll.split(',').map(Number)
          return { id, lat, lon }
        }),
        controller.signal,
      )
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
