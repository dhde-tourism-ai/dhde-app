import { useEffect, useState } from 'react'
import { loadDataFile } from '../lib/dataSource'

export interface JsonResource<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch one JSON data file. Source rules (live CloudFront via
 * VITE_DATA_BASE_URL, bundled snapshot fallback, dev cache-bust) live in
 * src/lib/dataSource.ts so every view shares one data layer. Pass null to load nothing.
 */
export function useJsonResource<T>(file: string | null): JsonResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(file !== null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (file === null) return // nothing asked for (e.g. a map layer that is off)
    const name = file
    const controller = new AbortController()

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        setData(await loadDataFile<T>(name, controller.signal))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(`Unknown error loading ${file}`))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [file])

  return { data, isLoading, error }
}
