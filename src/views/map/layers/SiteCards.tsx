import { useMemo, useState } from 'react'
import { Marker, Pane, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { NodeFrame } from '../../../lib/live'
import { escapeHtml, peopleRadius } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { isEstimatedMeasure } from '../../../lib/nodes'
import type { MarketVoiceData } from '../../../types/market'
import type { RealNodeMeta } from '../../../types/live'
import { useLang } from '../../../lib/i18n'
import { useIsNarrow } from '../../../hooks/useIsNarrow'
import { Tip } from './Tip'
import { lastSignal, rowsFor, type CardLayers } from './cardRows'
import { WeatherDetail } from './WeatherLayer'
import { ReviewsDetail, SocialDetail, SurveyDetail } from './VoiceMarketLayers'

/**
 * Below this zoom a card shows only its name and what needs attention; hover or click for
 * the rest. The opening view on a laptop is zoom 10, so one step out (0.5) turns it on.
 */
export const COMPACT_ZOOM = 9.75

interface Props {
  /** Sites that always get a card (their name), with or without rows. */
  nodes: MapNode[]
  /** Other sites: a card only where an active layer has a row for them. */
  extra: MapNode[]
  frame: Record<string, NodeFrame> | null
  market: MarketVoiceData | null
  layers: CardLayers
  selectedId?: string
  onSelect: (id: string | undefined) => void
  meta?: Record<string, RealNodeMeta>
  day: number
}

/**
 * One card per site instead of one badge per layer: the site's name (with people on
 * site and crowding when People is on), then a row per active layer: weather, rating,
 * survey, posts. However many layers are on, there are as many cards as sites, so the
 * map stays readable and nothing jumps around while the timeline plays. Zoomed out
 * (below COMPACT_ZOOM) a card keeps only what needs attention: a weather warning or
 * severe weather, and crowding. Hovering a card shows each active layer's detail.
 * Town-level layers (hotels, search intent) draw the same card style on the town.
 */
export function SiteCards({ nodes, extra, frame, market, layers, selectedId, onSelect, meta, day }: Props) {
  const { t, lang } = useLang()
  const narrow = useIsNarrow()
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const [zoom, setZoom] = useState(() => map.getZoom())
  const compact = zoom < COMPACT_ZOOM

  const shown = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id))
    return [...nodes, ...extra.filter((n) => !ids.has(n.id) && rowsFor(n, frame, market, layers, lang).length > 0)]
  }, [nodes, extra, frame, market, layers, lang])

  const icons = useMemo(() => {
    const out: Record<string, L.DivIcon> = {}
    for (const n of shown) {
      const f = frame?.[n.id]
      const dir = n.label_dir ?? 'right'
      const r = layers.people && f ? peopleRadius(Math.max(f.onSite, f.predicted)) + 5 : 11
      const name = escapeHtml(lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', ''))
      const crowded = !!f && !f.noEstimate && (f.tier.key === 'serious' || f.tier.key === 'crit')
      let head = `<span class="nt-name">${name}</span>`
      if (layers.people) {
        const sig = f?.noEstimate ? lastSignal(meta?.[n.id], day) : null
        const count = f?.noEstimate
          ? `<span class="nt-count fc">${sig ? `${escapeHtml(t('cam', 'カメラ'))} ${Math.round(sig.v).toLocaleString('en-US')}` : escapeHtml(t('no estimate', '推計なし'))}</span>`
          : f
            ? `<span class="nt-count${f.observed ? '' : ' fc'}">${f.observed ? '' : '~'}${Math.round(f.onSite).toLocaleString('en-US')}</span>`
            : `<span class="nt-count none">${escapeHtml(t('no data yet', 'データなし'))}</span>`
        const tier = f && !f.noEstimate ? `<span class="nt-dot" style="background:${f.tier.colour}"></span>` : ''
        const est = f && (isEstimatedMeasure(n.measure) || n.measure === 'vehicles') ? `<span class="nt-est">${escapeHtml(t('est.', '推定'))}</span>` : ''
        // Zoomed out, the count stays only when the site is crowded.
        head = `${tier}${head}${!compact || crowded ? count : ''}${compact ? '' : est}`
      }
      const rows = rowsFor(n, frame, market, layers, lang).filter((x) => !compact || x.attention)
      const body = rows.map((x) => `<div class="sc-row sc-${x.key}${x.attention ? ' attn' : ''}">${x.html}</div>`).join('')
      out[n.id] = L.divIcon({
        className: 'map-divicon',
        html: `<div class="site-card dir-${dir}${n.id === selectedId ? ' sel' : ''}${f || !layers.people ? '' : ' muted-tag'}" style="--r:${r}px"><div class="sc-head">${head}</div>${body}</div>`,
        iconSize: [0, 0],
      })
    }
    return out
  }, [shown, frame, market, layers, selectedId, lang, t, meta, day, compact])

  const detailOn = layers.weather || layers.reviews || layers.survey || layers.social
  return (
    <Pane name="dhde-cards" style={{ zIndex: 620 }}>
      {shown.map((n) => {
        const f = frame?.[n.id]
        const r = layers.reviews ? market?.reviews[n.id] : undefined
        const s = layers.survey ? market?.survey[n.id] : undefined
        const so = layers.social ? market?.social[n.id] : undefined
        const any = (layers.weather && f) || r || s || so
        return (
          <Marker key={n.id} position={[n.lat, n.lon]} icon={icons[n.id]} keyboard={false} eventHandlers={{ click: () => onSelect(n.id === selectedId ? undefined : n.id) }}>
            {/* On a phone a tap opens the site's drawer, which has the same detail. */}
            {detailOn && any && !narrow && (
              <Tip>
                <div className="tt-head">
                  <span>{t(n.name, n.name_ja)}</span>
                </div>
                {layers.weather && f && <WeatherDetail n={n} f={f} />}
                {r && <ReviewsDetail r={r} />}
                {s && <SurveyDetail s={s} />}
                {so && <SocialDetail s={so} />}
                <div className="tip-sub">{t('Click to open the site.', 'クリックで地点を開く。')}</div>
              </Tip>
            )}
          </Marker>
        )
      })}
    </Pane>
  )
}
