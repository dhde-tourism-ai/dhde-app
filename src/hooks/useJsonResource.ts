import { useEffect, useState } from 'react'

export interface JsonResource<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch one JSON file from public/data/. Same path rules and dev cache-bust
 * as useDashboardData(), generalised so every view shares one data layer.
 */
export function useJsonResource<T>(file: string): JsonResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const base = `${import.meta.env.BASE_URL}data/${file}`
    const url = import.meta.env.DEV ? `${base}?t=${Date.now()}` : base

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status} ${res.statusText}`)
        setData((await res.json()) as T)
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
