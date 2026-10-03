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
  /** Hover text for government users: what the layer shows and how to read it. */
  tip_en: string
  tip_ja: string
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
  { id: 'nudges', group: 'actions', en: 'Action nudges', ja: '推奨アクション', icon: 'flag', demo: true, hint_en: 'Demand, weather-route and booking alerts on the map', hint_ja: '需要・天候ルート・予約のアラート', tip_en: 'Suggested actions for staff: where to act, why, and what to do. The flag colour shows the priority.', tip_ja: '職員向けの推奨アクション：どこで、なぜ、何をするか。旗の色は優先度。' },
  { id: 'people', group: 'movement', en: 'People', ja: '人数', icon: 'people', demo: true, hint_en: 'Visitors on site, actual vs forecast', hint_ja: '現地の来訪者数（実測と予測）', tip_en: 'How many people are at each site, measured and forecast. A bigger circle means more people; the colour shows how crowded it is.', tip_ja: '各地点の人数（実測と予測）。円が大きいほど人が多く、色は混雑度。' },
  { id: 'density', group: 'movement', en: 'Regional density', ja: '地域の密度', icon: 'density', demo: true, hint_en: 'Where visitors concentrate', hint_ja: '来訪者が集中する地域', tip_en: 'Shading shows where visitors gather across the region.', tip_ja: '地域内で来訪者が集まる場所を色の濃さで表示。' },
  { id: 'flow', group: 'movement', en: 'People flow', ja: '人流', icon: 'flow', demo: true, hint_en: 'Arrivals and departures on real roads', hint_ja: '実際の道路上の到着・出発', tip_en: 'Moving dots show visitors travelling to and from each site on the main roads.', tip_ja: '動く点は主要道路で各地点へ行き来する来訪者。' },
  { id: 'traffic', group: 'movement', en: 'Traffic flow', ja: '交通状況', icon: 'traffic', demo: true, hint_en: 'Road congestion and reroutes', hint_ja: '道路の混雑と迂回推奨', tip_en: 'Road colour shows congestion. Green lines are suggested detours.', tip_ja: '道路の色は混雑度。緑の線は推奨迂回路。' },
  { id: 'weather', group: 'conditions', en: 'Weather', ja: '気象', icon: 'weather', demo: true, hint_en: 'Weather and warnings at each site', hint_ja: '各地点の天気と注意報', tip_en: 'Weather at each site and any weather warnings in force.', tip_ja: '各地点の天気と発表中の気象注意報・警報。' },
  { id: 'survey', group: 'voice', en: 'Survey', ja: 'アンケート', icon: 'survey', demo: true, hint_en: 'Satisfaction, recommendation, reasons, home area', hint_ja: '満足度・推奨意向・来訪理由・居住地', tip_en: 'Visitor survey results: satisfaction, how likely visitors are to recommend the site, why they came and where they live.', tip_ja: '来訪者アンケート：満足度、人に勧めたいか、来訪理由、居住地。' },
  { id: 'social', group: 'voice', en: 'Social media', ja: 'SNS', icon: 'social', demo: true, hint_en: 'Instagram posts tagged at each site', hint_ja: '各地点にタグ付けされたInstagram投稿', tip_en: 'How many Instagram posts are tagged at each site each week. Sites without real data, the feed and sentiment are fictional demo.', tip_ja: '各地点にタグ付けされたInstagram投稿の週ごとの件数。実データのない地点とフィード・感情は架空のデモ。' },
  { id: 'reviews', group: 'voice', en: 'Reviews', ja: 'レビュー', icon: 'star', demo: true, hint_en: 'Rating, count, 30-day change (fictional snippets)', hint_ja: '評価・件数・30日の変化（架空）', tip_en: 'Online review rating for each site and how it changed in the last 30 days.', tip_ja: '各地点のオンラインレビュー評価と直近30日の変化。' },
  { id: 'sentiment', group: 'voice', en: 'Sentiment', ja: '感情', icon: 'sentiment', demo: true, hint_en: 'Hotspots from reviews and posts', hint_ja: 'レビュー・投稿のホットスポット', tip_en: 'Where visitors write positively (blue) or negatively (red) in reviews and posts.', tip_ja: 'レビューや投稿で評価が良い（青）・悪い（赤）場所。' },
  { id: 'hotels', group: 'market', en: 'Hotels', ja: 'ホテル', icon: 'bed', demo: true, hint_en: 'How full hotels are, rooms left', hint_ja: 'ホテルの稼働率と残室', tip_en: 'How full hotels are on the selected night and how many rooms are left.', tip_ja: '選択日のホテルの稼働率と残室数。' },
  { id: 'rsi', group: 'market', en: 'Search intent', ja: '検索関心', icon: 'search', demo: true, hint_en: 'Google Maps views per town, last 7 days', hint_ja: '市町ごとのGoogleマップ閲覧（直近7日）', tip_en: 'How often people look up each place on Google Maps (profile views, searches and directions). A rise usually means more visitors soon.', tip_ja: 'Googleマップで各地点が見られた回数（プロフィール表示・検索・経路）。増えると近いうちに来訪者が増える目安。' },
  { id: 'economics', group: 'economics', en: 'Economics', ja: '経済', icon: 'economics', demo: false, hint_en: 'Visitors, revenue and opportunity lost', hint_ja: '来訪者・収入・機会損失', tip_en: 'Tourism revenue per town, and revenue missed from day-trips instead of overnight stays, bad weather and empty rooms.', tip_ja: '市町ごとの観光収入と、宿泊せず日帰りになった分・悪天候・空室による取りこぼし。' },
]

/** Layers drawn as cards on towns rather than on sites: only one at a time (MapView's toggle). */
export const TOWN_LAYERS: LayerId[] = ['hotels', 'rsi']

/** Tooltip for a "Partly estimated or demo" badge that covers several layers. */
export const OVERVIEW_NOTE = [
  'Some layers use real data; the rest is estimated or demo. Turn a layer on to see which part is estimated or demo.',
  '一部のレイヤーは実データ、残りは推計またはデモ。レイヤーをオンにすると推計・デモの部分を確認できます。',
] as const

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

/**
 * ?layers=people,flow&base=dark&t=2026-10-02T14&panel=nudges (and the older ?layer=economics) make
 * shareable views. `t` is a JST date and hour (`tAt`), since the timeline moves with the clock; an
 * older link's plain hour index (`t=38`) still works but points at a different date each day.
 */
export function readUrlState(): { layers: LayerId[] | null; base: BasemapId | null; t: number | null; tAt: string | null; panel: 'board' | 'nudges' | null } {
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
  const tAt = t !== null && /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(t) ? t : null
  return { layers, base, t: t !== null && !tAt && !isNaN(Number(t)) ? Number(t) : null, tAt, panel: pn === 'nudges' || pn === 'board' ? pn : null }
}
