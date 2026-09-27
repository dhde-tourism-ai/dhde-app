import type { IconName } from '../../lib/icons'

export type LayerId = 'people' | 'density' | 'flow' | 'traffic' | 'weather' | 'sentiment' | 'economics'
export type BasemapId = 'hybrid' | 'dark' | 'streets'

export const LAYERS: { id: LayerId; en: string; ja: string; icon: IconName; demo: boolean; hint_en: string; hint_ja: string }[] = [
  { id: 'people', en: 'People', ja: '人数', icon: 'people', demo: true, hint_en: 'Visitors on site, actual vs forecast', hint_ja: '現地の来訪者数（実測と予測）' },
  { id: 'density', en: 'Regional density', ja: '地域の密度', icon: 'density', demo: true, hint_en: 'Where visitors concentrate', hint_ja: '来訪者が集中する地域' },
  { id: 'flow', en: 'People flow', ja: '人流', icon: 'flow', demo: true, hint_en: 'Arrivals and departures on real roads', hint_ja: '実際の道路上の到着・出発' },
  { id: 'traffic', en: 'Traffic flow', ja: '交通状況', icon: 'traffic', demo: true, hint_en: 'Road congestion and reroutes', hint_ja: '道路の混雑と迂回推奨' },
  { id: 'weather', en: 'Weather', ja: '気象', icon: 'weather', demo: true, hint_en: 'Per-node conditions and JMA-style advisories', hint_ja: 'ノードごとの天気と注意報' },
  { id: 'sentiment', en: 'Sentiment', ja: '感情', icon: 'sentiment', demo: true, hint_en: 'Hotspots from reviews and posts', hint_ja: 'レビュー・投稿のホットスポット' },
  { id: 'economics', en: 'Economics', ja: '経済', icon: 'economics', demo: false, hint_en: 'Visitors, revenue and opportunity lost', hint_ja: '来訪者・収入・機会損失' },
]

export const DEFAULT_LAYERS: LayerId[] = ['people', 'density', 'flow']

export const BASEMAPS: { id: BasemapId; en: string; ja: string }[] = [
  { id: 'hybrid', en: 'Hybrid', ja: '航空写真' },
  { id: 'dark', en: 'Dark', ja: 'ダーク' },
  { id: 'streets', en: 'Streets', ja: '道路地図' },
]

/** ?layers=people,flow&base=dark&t=38 (and the older ?layer=economics) make shareable views. */
export function readUrlState(): { layers: LayerId[] | null; base: BasemapId | null; t: number | null } {
  const p = new URLSearchParams(window.location.search)
  const valid = new Set(LAYERS.map((l) => l.id))
  let layers: LayerId[] | null = null
  const raw = p.get('layers')
  if (raw !== null) layers = raw.split(',').filter((x): x is LayerId => valid.has(x as LayerId))
  if (p.get('layer') === 'economics') layers = [...(layers ?? DEFAULT_LAYERS), 'economics']
  const b = p.get('base')
  const base = b === 'hybrid' || b === 'dark' || b === 'streets' ? b : null
  const t = p.get('t')
  return { layers, base, t: t !== null && !isNaN(Number(t)) ? Number(t) : null }
}
