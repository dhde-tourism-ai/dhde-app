import { CircleMarker, Pane, Tooltip } from 'react-leaflet'
import type { NodeFrame } from '../../../lib/live'
import { peopleRadius, sentimentColour, sentimentLabel } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { useLang } from '../../../lib/i18n'

/** A hotspot = strong opinion (|score| ≥ 0.25) with enough posts to trust it. */
export const HOTSPOT_SCORE = 0.25
export const HOTSPOT_POSTS = 25

/**
 * Sentiment: rings coloured on a diverging scale (red negative, grey mixed, blue
 * positive). Hotspots pulse; other nodes get a thin static ring.
 */
export function SentimentLayer({ nodes, frame }: { nodes: MapNode[]; frame: Record<string, NodeFrame> }) {
  const { t } = useLang()
  return (
    <Pane name="dhde-sentiment" style={{ zIndex: 480 }}>
      {nodes
        .filter((n) => frame[n.id])
        .map((n) => {
          const f = frame[n.id]
          const s = f.sentiment
          const hot = Math.abs(s.score) >= HOTSPOT_SCORE && s.posts >= HOTSPOT_POSTS
          const col = sentimentColour(s.score)
          const r = peopleRadius(Math.max(f.onSite, f.predicted)) + 9
          const lab = sentimentLabel(s.score)
          return (
            <CircleMarker
              key={`${n.id}-${hot ? 'hot' : 'calm'}`}
              center={[n.lat, n.lon]}
              radius={r}
              className={hot ? 'sent-pulse' : undefined}
              pathOptions={{ color: col, weight: hot ? 3 : 1.6, opacity: hot ? 1 : 0.8, fillOpacity: 0, dashArray: hot ? undefined : '1 4' }}
            >
              <Tooltip className="map-tip" direction="bottom" offset={[0, r]}>
                <strong>
                  {t(n.name, n.name_ja)} · {t(lab.en, lab.ja)}
                </strong>
                <div className="tip-row">
                  {t('Score', 'スコア')} <b className="num">{s.score > 0 ? '+' : ''}{s.score.toFixed(2)}</b> · {s.posts} {t('posts today', '件（本日）')}
                </div>
                <div className="tip-row">{s.keywords.map((k) => `“${t(k.en, k.ja)}”`).join('  ')}</div>
                {hot && <div className="tip-sub">{t('Sentiment hotspot', '感情ホットスポット')}</div>}
              </Tooltip>
            </CircleMarker>
          )
        })}
    </Pane>
  )
}
