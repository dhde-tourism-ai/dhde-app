import { useEffect, useState } from 'react'
import { fetchWarnings, REFRESH_MS, type JmaWarning } from '../lib/jmaWarnings'

/** JMA warnings in force, re-read every REFRESH_MS; null until the first successful read. */
export function useJmaWarnings(): JmaWarning[] | null {
  const [data, setData] = useState<JmaWarning[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = () =>
      fetchWarnings(controller.signal)
        .then(setData)
        .catch(() => undefined) // a failed read keeps the last one (or the demo warnings)
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return data
}
