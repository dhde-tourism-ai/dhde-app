export type DataKind = 'observed' | 'estimated' | 'forecast' | 'mixed'

/** Classification of displayed layer values, not just coverage by collected source files. */
export function layerDataKind(id: string): DataKind | undefined {
  if (['people', 'density', 'flow', 'sentiment', 'nudges'].includes(id)) return 'estimated'
  if (['weather', 'social', 'traffic'].includes(id)) return 'mixed'
  return undefined
}
