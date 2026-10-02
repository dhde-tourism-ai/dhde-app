import { useEffect, useMemo, useState } from 'react'
import { useDashboardData } from './useDashboardData'
import { mergeAll, parseReal } from '../lib/real'
import { useJsonResource } from './useJsonResource'
import { useHourlyWeather } from './useHourlyWeather'
import type { NodeRegistry } from '../types/nodes'
import type { RegionalEconomics } from '../types/economics'
import type { StrategicQuestions } from '../types/strategy'
import type { LiveData } from '../types/live'
import type { RoutesFile } from '../types/routes'
import type { MarketVoiceData } from '../types/market'

/**
 * The single data layer shared by all three views. Each file loads once in
 * the app shell and is handed down, so switching tabs never refetches.
 */
export function useProductData() {
  const dashboard = useDashboardData()
  const registry = useJsonResource<NodeRegistry>('nodes.json')
  const economics = useJsonResource<RegionalEconomics>('regional_economics.json')
  const strategy = useJsonResource<StrategicQuestions>('strategic_questions.json')
  const live = useJsonResource<LiveData>('live_demo.json')
  const routes = useJsonResource<RoutesFile>('routes.json')
  const market = useJsonResource<MarketVoiceData>('market_voice_demo.json')
  // Optional: a missing or broken real_data.json just leaves the demo in place.
  const real = useJsonResource<unknown>('real_data.json')
  // Optional too: hourly weather (saved observations + live forecast), re-read every 30 minutes.
  const points = useMemo(() => {
    const ids = Object.keys(live.data?.nodes ?? {})
    return (registry.data?.nodes ?? []).filter((n) => ids.includes(n.id)).map((n) => ({ id: n.id, lat: n.lat, lon: n.lon }))
  }, [live.data, registry.data])
  const hourly = useHourlyWeather(points)
  // The timeline follows the clock: re-merge every 10 minutes so "now" (and, at midnight, today) moves.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  const merged = useMemo(() => {
    if (!live.data) return null
    let parsed = null
    try {
      parsed = parseReal(real.data)
    } catch {
      parsed = null
    }
    try {
      return mergeAll(live.data, market.data, parsed, hourly, now)
    } catch (e) {
      console.error('real_data.json merge failed; using demo data', e)
      return mergeAll(live.data, market.data, null)
    }
  }, [live.data, market.data, real.data, hourly, now])
  return { dashboard, registry, economics, strategy, live, routes, market, merged, realLoading: real.isLoading }
}

export type ProductData = ReturnType<typeof useProductData>
