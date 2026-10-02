import { useEffect, useState } from 'react'
import { fetchWarnings, REFRESH_MS, type WarningsRead } from '../lib/jmaWarnings'

/** The last good read of JMA's warnings, re-read every REFRESH_MS; null until the first one. */
export function useJmaWarnings(): WarningsRead | null {
  const [data, setData] = useState<WarningsRead | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = () =>
      fetchWarnings(controller.signal)
        .then(setData)
        .catch(() => undefined) // a failed read keeps the last good one; toAlerts marks it unconfirmed after 30 min
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return data
}
