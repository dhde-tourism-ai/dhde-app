import { useMemo } from 'react'
import { CircleMarker, Marker, Pane, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { MapNode } from '../../../lib/nodes'
import { escapeHtml } from '../../../lib/live'
import { iconSvg } from '../../../lib/icons'
import { occupancyColour } from '../../../lib/market'
import { useLang } from '../../../lib/i18n'
import { LEVEL } from '../../../lib/briefing'
import type { DayFigure } from '../../../lib/briefing'
import type { RealNodeMeta } from '../../../types/live'
import type { SiteHotel } from './PeopleLayer'

const ACCENT = '#165e83'
const NEUTRAL = '#8a8f99'

/** Circle area grows with the day's visitors (a day total, not people on site at once). */
const dayRadius = (v: number) => 7 + Math.sqrt(Math.max(0, v)) * 0.3

const fmt = (v: number) => Math.round(v).toLocaleString('en-US')

/**
 * Briefing mode's People layer: one figure per site per day, from real data only. Past days show
 * the real visitor estimate; later days the forecast model's total (marked "forecast"). The colour
 * compares the day with the site's own usual day, not with a guessed capacity.
 */
export function DailyPeopleLayer({
  nodes,
  figures,
  meta,
  selectedId,
  onSelect,
  hotels,
}: {
  nodes: MapNode[]
  figures: Record<string, DayFigure>
  meta?: Record<string, RealNodeMeta>
  selectedId?: string
  onSelect: (id: string | undefined) => void
  hotels?: Record<string, SiteHotel>
}) {
  const { t, lang } = useLang()
  const shown = useMemo(() => nodes.filter((n) => figures[n.id]), [nodes, figures])

  const icons = useMemo(() => {
    const out: Record<string, L.DivIcon> = {}
    for (const n of shown) {
      const f = figures[n.id]
      const name = escapeHtml(lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', ''))
      const dot = f.level ? `<span class="nt-dot" style="background:${LEVEL[f.level].colour}"></span>` : ''
      const count =
        f.kind === 'real'
          ? `<span class="nt-count">${fmt(f.value!)}</span>`
          : f.kind === 'forecast'
            ? `<span class="nt-count fc">${fmt(f.value!)}<span class="nt-kind">${escapeHtml(t('forecast', '予測'))}</span></span>`
            : `<span class="nt-count none">${escapeHtml(f.kind === 'no_estimate' ? t('no count yet', '人数未推計') : t('no forecast yet', '予測なし'))}</span>`
      const h = hotels?.[n.id]
      const hotel = h
        ? `<span class="nt-hotel${h.area ? ' area' : ''}"><i style="background:${occupancyColour(h.pct)}"></i>${iconSvg('bed', 12)}<b>${h.area ? escapeHtml(t('area ', '周辺 ')) : ''}${h.pct}%</b></span>`
        : ''
      const r = f.value !== null ? dayRadius(f.value) : 9
      out[n.id] = L.divIcon({
        className: 'map-divicon',
        html: `<div class="node-tag dir-${n.label_dir ?? 'right'}${n.id === selectedId ? ' sel' : ''}" style="--r:${r + 5}px">${dot}<span class="nt-name">${name}</span>${count}${hotel}</div>`,
        iconSize: [0, 0],
      })
    }
    return out
  }, [shown, figures, selectedId, lang, t, hotels])

  return (
    <Pane name="dhde-nodes" style={{ zIndex: 500 }}>
      {shown.map((n) => {
        const f = figures[n.id]
        const m = meta?.[n.id]
        const selected = n.id === selectedId
        const col = f.level ? LEVEL[f.level].colour : NEUTRAL
        const r = f.value !== null ? dayRadius(f.value) : 9
        const pct = f.value !== null && f.normal ? Math.round((f.value / f.normal - 1) * 100) : null
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon]}
            radius={r}
            eventHandlers={{ click: () => onSelect(selected ? undefined : n.id) }}
            pathOptions={{
              color: selected ? ACCENT : col,
              weight: selected ? 3 : 2,
              dashArray: f.kind === 'forecast' ? '5 4' : undefined,
              fillColor: col,
              fillOpacity: f.value === null ? 0.08 : f.kind === 'real' ? 0.55 : 0.28,
            }}
          >
            <Tooltip className="map-tip wide" direction="top" offset={[0, -r]}>
              <div className="tt-head">
                <span>{t(n.name.replace(' East Entrance', ''), n.name_ja)}</span>
                {f.kind === 'real' && <span className="tt-real">{t('Real data', '実データ')}</span>}
                {f.kind === 'forecast' && <span className="tt-real">{t('Model forecast', 'モデル予測')}</span>}
              </div>
              {f.value !== null ? (
                <>
                  <div className="tt-hero">
                    <b className="num">{fmt(f.value)}</b>
                    <span>{f.kind === 'real' ? t('visitors that day (estimate from real counts)', 'この日の来訪者数（実測からの推計）') : t('visitors forecast for the day', 'この日の来訪者予測')}</span>
                  </div>
                  {f.level && pct !== null && f.normal && (
                    <div className="tt-grid">
                      <span className="tt-k">{t('Compared with usual', '通常比')}</span>
                      <span className="tt-v">
                        <span className="sw" style={{ background: col }}></span>
                        {t(LEVEL[f.level].en, LEVEL[f.level].ja)} ({pct > 0 ? '+' : ''}
                        {pct}%)
                      </span>
                      <span className="tt-k">{t('Usual day', '通常の日')}</span>
                      <span className="tt-v num">{fmt(f.normal)}</span>
                    </div>
                  )}
                  {m?.method_text && <div className="tip-sub">{t(m.method_text, m.method_text_ja ?? m.method_text)}</div>}
                </>
              ) : (
                <div className="tip-sub">
                  {f.kind === 'no_estimate'
                    ? t('No visitor count yet: there is no official annual figure for this site to calibrate the camera against.', '来訪者数は未推計：カメラを換算する公式年間値がありません。')
                    : t('No forecast for this day yet: the site has no daily visitor count to train a model on.', 'この日の予測はまだありません：モデルを学習する日次来訪者数がありません。')}
                </div>
              )}
            </Tooltip>
          </CircleMarker>
        )
      })}
      {shown.map((n) => (
        <Marker key={`lbl-${n.id}`} position={[n.lat, n.lon]} icon={icons[n.id]} eventHandlers={{ click: () => onSelect(n.id === selectedId ? undefined : n.id) }} keyboard={false} zIndexOffset={100} />
      ))}
    </Pane>
  )
}
