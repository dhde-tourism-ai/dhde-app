import { useDashboardData } from './useDashboardData'
import { useJsonResource } from './useJsonResource'
import type { NodeRegistry } from '../types/nodes'
import type { RegionalEconomics } from '../types/economics'
import type { StrategicQuestions } from '../types/strategy'

/**
 * The single data layer shared by all three views. Each file loads once in
 * the app shell and is handed down, so switching tabs never refetches.
 */
export function useProductData() {
  const dashboard = useDashboardData()
  const registry = useJsonResource<NodeRegistry>('nodes.json')
  const economics = useJsonResource<RegionalEconomics>('regional_economics.json')
  const strategy = useJsonResource<StrategicQuestions>('strategic_questions.json')
  return { dashboard, registry, economics, strategy }
}

export type ProductData = ReturnType<typeof useProductData>
