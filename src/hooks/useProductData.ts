import { useMemo } from 'react'
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
  // Optional too: hourly weather from the live-data branch, re-read every 30 minutes.
  const hourly = useHourlyWeather(useMemo(() => Object.keys(live.data?.nodes ?? {}), [live.data]))
  const merged = useMemo(() => {
    if (!live.data) return null
    let parsed = null
    try {
      parsed = parseReal(real.data)
    } catch {
      parsed = null
    }
    try {
      return mergeAll(live.data, market.data, parsed, hourly)
    } catch (e) {
      console.error('real_data.json merge failed; using demo data', e)
      return mergeAll(live.data, market.data, null)
    }
  }, [live.data, market.data, real.data, hourly])
  return { dashboard, registry, economics, strategy, live, routes, market, merged, realLoading: real.isLoading }
}

export type ProductData = ReturnType<typeof useProductData>
