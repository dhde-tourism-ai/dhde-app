import { CircleMarker, Pane, Tooltip } from 'react-leaflet'
import type { NodeFrame } from '../../../lib/live'
import { peopleRadius, realSentimentLabel, sentimentColour, sentimentLabel } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { useLang } from '../../../lib/i18n'
import { fmtDate } from '../../../lib/format'
import type { RealSentiment } from '../../../types/live'

/** A hotspot = strong opinion (|score| ≥ 0.25) with enough posts to trust it. */
export const HOTSPOT_SCORE = 0.25
/** Posts that day (demo), or scored posts and comments in the week (real). */
export const HOTSPOT_POSTS = 25

/** Neutral ring for a real node with too few scored posts to judge. */
const TOO_FEW = '#8a94a6'

/**
 * Sentiment: rings coloured on a diverging scale (red negative, grey mixed, blue
 * positive). Hotspots pulse; other nodes get a thin static ring. A node with real
 * sentiment shows its last weekly window, whichever day is picked.
 */
export function SentimentLayer({ nodes, frame }: { nodes: MapNode[]; frame: Record<string, NodeFrame> }) {
  const { t } = useLang()
  return (
    <Pane name="dhde-sentiment" style={{ zIndex: 480 }}>
      {nodes
        .filter((n) => frame[n.id])
        .map((n) => {
          const f = frame[n.id]
          const r = peopleRadius(Math.max(f.onSite, f.predicted)) + 9
          const real = f.sentiment.real
          if (real) return <RealRing key={`${n.id}-real`} node={n} real={real} r={r} />
          const s = f.sentiment
          const hot = Math.abs(s.score) >= HOTSPOT_SCORE && s.posts >= HOTSPOT_POSTS
          const col = sentimentColour(s.score)
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
                  {t(n.name, n.name_ja)} · {t(lab.en, lab.ja)} <span className="tt-demo">{t('Demo', 'デモ')}</span>
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

function RealRing({ node: n, real, r }: { node: MapNode; real: RealSentiment; r: number }) {
  const { t, lang } = useLang()
  const s = real.score
  const hot = s !== null && Math.abs(s) >= HOTSPOT_SCORE && real.scored >= HOTSPOT_POSTS
  const col = s === null ? TOO_FEW : sentimentColour(s)
  const lab = s === null ? { en: 'Too few posts to judge', ja: '件数が少なく判定不可' } : realSentimentLabel(s)
  const asOf = fmtDate(real.as_of, lang)
  const pct = (k: number) => (real.scored ? Math.round((k / real.scored) * 100) : 0)
  return (
    <CircleMarker
      key={`${n.id}-${hot ? 'hot' : 'calm'}`}
      center={[n.lat, n.lon]}
      radius={r}
      className={hot ? 'sent-pulse' : undefined}
      pathOptions={{ color: col, weight: hot ? 3 : 2, opacity: hot ? 1 : 0.9, fillOpacity: 0, dashArray: s === null ? '2 5' : hot ? undefined : '1 4' }}
    >
      <Tooltip className="map-tip" direction="bottom" offset={[0, r]}>
        <strong>
          {t(n.name, n.name_ja)} · {t(lab.en, lab.ja)} <span className="tt-real">{t('Real', '実データ')}</span> <span className="tt-demo">{t('first model, unchecked', '初期モデル・未検証')}</span>
        </strong>
        {s !== null && (
          <div className="tip-row">
            {t('Score', 'スコア')} <b className="num">{s > 0 ? '+' : ''}{s.toFixed(2)}</b> · {pct(real.positive)}% {t('positive', '好意的')}, {pct(real.neutral)}% {t('neutral', '中立')}, {pct(real.negative)}% {t('negative', '否定的')}
          </div>
        )}
        {s !== null && <div className="tip-sub">{t('Positive from +0.2, negative from -0.2, neutral between (a working band, to check against hand-labelled posts).', '+0.2以上を好意的、-0.2以下を否定的、その間を中立とします（手作業の判定と照合予定の暫定基準）。')}</div>}
        <div className="tip-row">
          {real.scored} {t('posts and comments scored', '件の投稿・コメントを判定')}, {t(`${real.days} days to ${asOf}`, `${asOf}までの${real.days}日間`)}
        </div>
        <div className="tip-sub">
          Instagram {real.from.instagram} · Bluesky / YouTube / Reddit {real.from.social}
          {hot ? ` · ${t('Sentiment hotspot', '感情ホットスポット')}` : ''}
        </div>
      </Tooltip>
    </CircleMarker>
  )
}
