import { useCallback, useEffect, useState } from 'react'
import type { DashboardData } from '../types/dashboard'
import { loadDataFile } from '../lib/dataSource'

interface UseDashboardDataResult {
  data: DashboardData | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

// Source rules (live VITE_DATA_BASE_URL first, bundled snapshot fallback,
// dev cache-bust) live in src/lib/dataSource.ts.
const DASHBOARD_FILE = 'dashboard_data.json'

export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const json = await loadDataFile<DashboardData>(DASHBOARD_FILE, controller.signal)
        setData(json)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error('Unknown error loading dashboard data'))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [reloadToken])

  return { data, isLoading, error, refetch }
}