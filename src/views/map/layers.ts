import type { IconName } from '../../lib/icons'

export type LayerId =
  | 'people'
  | 'density'
  | 'flow'
  | 'traffic'
  | 'weather'
  | 'survey'
  | 'social'
  | 'reviews'
  | 'sentiment'
  | 'hotels'
  | 'rsi'
  | 'economics'
  | 'nudges'
export type BasemapId = 'hybrid' | 'dark' | 'streets'
export type GroupId = 'actions' | 'movement' | 'conditions' | 'voice' | 'market' | 'economics'

export interface LayerDef {
  id: LayerId
  group: GroupId
  en: string
  ja: string
  icon: IconName
  demo: boolean
  hint_en: string
  hint_ja: string
}

export const GROUPS: { id: GroupId; en: string; ja: string }[] = [
  { id: 'actions', en: 'Actions', ja: 'アクション' },
  { id: 'movement', en: 'Movement', ja: '人の動き' },
  { id: 'conditions', en: 'Conditions', ja: '環境' },
  { id: 'voice', en: 'Voice of visitor', ja: '来訪者の声' },
  { id: 'market', en: 'Market', ja: '市場' },
  { id: 'economics', en: 'Economics', ja: '経済' },
]

export const LAYERS: LayerDef[] = [
  { id: 'nudges', group: 'actions', en: 'Nudges', ja: 'ナッジ', icon: 'flag', demo: true, hint_en: 'Demand, weather-route and booking alerts on the map', hint_ja: '需要・天候ルート・予約のアラート' },
  { id: 'people', group: 'movement', en: 'People', ja: '人数', icon: 'people', demo: true, hint_en: 'Visitors on site, actual vs forecast', hint_ja: '現地の来訪者数（実測と予測）' },
  { id: 'density', group: 'movement', en: 'Regional density', ja: '地域の密度', icon: 'density', demo: true, hint_en: 'Where visitors concentrate', hint_ja: '来訪者が集中する地域' },
  { id: 'flow', group: 'movement', en: 'People flow', ja: '人流', icon: 'flow', demo: true, hint_en: 'Arrivals and departures on real roads', hint_ja: '実際の道路上の到着・出発' },
  { id: 'traffic', group: 'movement', en: 'Traffic flow', ja: '交通状況', icon: 'traffic', demo: true, hint_en: 'Road congestion and reroutes', hint_ja: '道路の混雑と迂回推奨' },
  { id: 'weather', group: 'conditions', en: 'Weather', ja: '気象', icon: 'weather', demo: true, hint_en: 'Per-node conditions and JMA-style advisories', hint_ja: 'ノードごとの天気と注意報' },
  { id: 'survey', group: 'voice', en: 'Survey', ja: 'アンケート', icon: 'survey', demo: true, hint_en: 'Satisfaction, NPS, reasons, origin', hint_ja: '満足度・NPS・来訪理由・居住地' },
  { id: 'social', group: 'voice', en: 'Social media', ja: 'SNS', icon: 'social', demo: true, hint_en: 'Posts and images near each node (fictional)', hint_ja: '各ノード周辺の投稿（架空）' },
  { id: 'reviews', group: 'voice', en: 'Reviews', ja: 'レビュー', icon: 'star', demo: true, hint_en: 'Rating, count, 30-day change (fictional snippets)', hint_ja: '評価・件数・30日の変化（架空）' },
  { id: 'sentiment', group: 'voice', en: 'Sentiment', ja: '感情', icon: 'sentiment', demo: true, hint_en: 'Hotspots from reviews and posts', hint_ja: 'レビュー・投稿のホットスポット' },
  { id: 'hotels', group: 'market', en: 'Hotels', ja: 'ホテル', icon: 'bed', demo: true, hint_en: 'Occupancy, rooms left, booking curve', hint_ja: '稼働率・残室・予約カーブ' },
  { id: 'rsi', group: 'market', en: 'Search intent', ja: '検索関心', icon: 'search', demo: true, hint_en: 'Route-search index per municipality, 7-day trend', hint_ja: '市町ごとのルート検索指数と推移' },
  { id: 'economics', group: 'economics', en: 'Economics', ja: '経済', icon: 'economics', demo: false, hint_en: 'Visitors, revenue and opportunity lost', hint_ja: '来訪者・収入・機会損失' },
]

export const DEFAULT_LAYERS: LayerId[] = []

/** The viewer's last layer choice, or null on a first visit. */
export function readStoredLayers(): LayerId[] | null {
  try {
    const raw = window.localStorage.getItem('dhde.layers')
    if (raw === null) return null
    const valid = new Set(LAYERS.map((l) => l.id))
    return raw.split(',').filter((x): x is LayerId => valid.has(x as LayerId))
  } catch {
    return null
  }
}

/** Whether the layer panel was left open; it starts collapsed. */
export function readPanelOpen(): boolean {
  try {
    return window.localStorage.getItem('dhde.layersPanel') === 'open'
  } catch {
    return false
  }
}

export function storePanelOpen(open: boolean) {
  try {
    window.localStorage.setItem('dhde.layersPanel', open ? 'open' : 'closed')
  } catch {
    /* storage blocked: the panel still toggles for this visit */
  }
}

export function storeLayers(layers: Iterable<LayerId>) {
  try {
    window.localStorage.setItem('dhde.layers', [...layers].join(','))
  } catch {
    /* storage blocked: the choice still holds for this visit */
  }
}

export const BASEMAPS: { id: BasemapId; en: string; ja: string }[] = [
  { id: 'hybrid', en: 'Hybrid', ja: '航空写真' },
  { id: 'dark', en: 'Dark', ja: 'ダーク' },
  { id: 'streets', en: 'Streets', ja: '道路地図' },
]

/** ?layers=people,flow&base=dark&t=38&panel=nudges (and the older ?layer=economics) make shareable views. */
export function readUrlState(): { layers: LayerId[] | null; base: BasemapId | null; t: number | null; panel: 'board' | 'nudges' | null } {
  const p = new URLSearchParams(window.location.search)
  const valid = new Set(LAYERS.map((l) => l.id))
  let layers: LayerId[] | null = null
  const raw = p.get('layers')
  if (raw !== null) layers = raw.split(',').filter((x): x is LayerId => valid.has(x as LayerId))
  if (p.get('layer') === 'economics') layers = [...(layers ?? DEFAULT_LAYERS), 'economics']
  const b = p.get('base')
  const base = b === 'hybrid' || b === 'dark' || b === 'streets' ? b : null
  const t = p.get('t')
  const pn = p.get('panel')
  return { layers, base, t: t !== null && !isNaN(Number(t)) ? Number(t) : null, panel: pn === 'nudges' || pn === 'board' ? pn : null }
}
