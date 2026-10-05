import { useMemo } from 'react'
import { CircleMarker, Pane, Tooltip } from 'react-leaflet'
import type { MapNode } from '../../../lib/nodes'
import { useLang } from '../../../lib/i18n'
import { LEVEL, busyPct, dayRadius, methodNote } from '../../../lib/briefing'
import type { DayFigure } from '../../../lib/briefing'
import type { RealNodeMeta } from '../../../types/live'
import { StatusPill } from '../../../components/StatusPill'

const ACCENT = '#165e83'
const NEUTRAL = '#8a8f99'

const fmt = (v: number) => Math.round(v).toLocaleString('en-US')

/**
 * Briefing mode's People circles: one per site per day. Past days show the visitor estimate
 * (calibrated from real counts, so "Estimated", never "Real"); today and later the forecast
 * model's total. The colour compares the day with the site's own usual day, not a guessed
 * capacity. The site cards (SiteCards) carry the labels.
 */
export function DailyPeopleLayer({
  nodes,
  figures,
  meta,
  selectedId,
  onSelect,
}: {
  nodes: MapNode[]
  figures: Record<string, DayFigure>
  meta?: Record<string, RealNodeMeta>
  selectedId?: string
  onSelect: (id: string | undefined) => void
}) {
  const { t, lang } = useLang()
  const shown = useMemo(() => nodes.filter((n) => figures[n.id]), [nodes, figures])

  return (
    <Pane name="dhde-nodes" style={{ zIndex: 500 }}>
      {shown.map((n) => {
        const f = figures[n.id]
        const m = meta?.[n.id]
        const selected = n.id === selectedId
        const col = f.level ? LEVEL[f.level].colour : NEUTRAL
        const r = f.busyness ? 14 : dayRadius(f.value)
        const pct = f.value !== null && f.normal ? Math.round((f.value / f.normal - 1) * 100) : null
        const note = f.busyness
          ? t('Busyness from the station camera, not a visitor count: there is no official visitor figure for the station.', '駅カメラによる混雑度で来訪者数ではない：駅の公式来訪者数がないため。')
          : methodNote(m, lang)
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
                {f.kind === 'real' && <StatusPill status="modelled" />}
                {f.kind === 'forecast' && <StatusPill status="modelled" label={t('Forecast', '予測')} />}
              </div>
              {f.value !== null ? (
                <>
                  <div className="tt-hero">
                    <b className="num">{f.busyness ? busyPct(f) : fmt(f.value)}</b>
                    <span>
                      {f.busyness
                        ? f.kind === 'real'
                          ? t('of a usual day (station camera)', '通常日比（駅カメラ）')
                          : t('of a usual day, forecast (station camera)', '通常日比の予測（駅カメラ）')
                        : f.kind === 'real'
                          ? t('visitors that day (estimated)', 'この日の来訪者数（推計）')
                          : t('visitors forecast for the day', 'この日の来訪者予測')}
                    </span>
                  </div>
                  {f.level && pct !== null && f.normal && (
                    <div className="tt-grid">
                      <span className="tt-k">{t('Compared with usual', '通常比')}</span>
                      <span className="tt-v">
                        <span className="sw" style={{ background: col }}></span>
                        {t(LEVEL[f.level].en, LEVEL[f.level].ja)} ({pct > 0 ? '+' : ''}
                        {pct}%)
                      </span>
                      {!f.busyness && (
                        <>
                          <span className="tt-k">{t('Usual day', '通常の日')}</span>
                          <span className="tt-v num">{fmt(f.normal)}</span>
                        </>
                      )}
                    </div>
                  )}
                  {note && <div className="tip-sub">{note}</div>}
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
    </Pane>
  )
}
