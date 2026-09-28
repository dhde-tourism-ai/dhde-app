import { useSyncExternalStore } from 'react'
import { getFallbackState, subscribeFallback } from '../lib/dataSource'

/** Non-null when at least one file fell back from the live source to the bundled snapshot. */
export function useDataFallback() {
  return useSyncExternalStore(subscribeFallback, getFallbackState)
}
