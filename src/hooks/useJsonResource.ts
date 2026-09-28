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
 * src/lib/dataSource.ts so every view shares one data layer.
 */
export function useJsonResource<T>(file: string): JsonResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        setData(await loadDataFile<T>(file, controller.signal))
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
