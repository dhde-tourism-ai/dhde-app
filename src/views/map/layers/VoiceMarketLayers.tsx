import { useMemo } from 'react'
import { Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { MarketVoiceData } from '../../../types/market'
import type { MapNode } from '../../../lib/nodes'
import type { NodeFrame } from '../../../lib/live'
import { escapeHtml, peopleRadius, sentimentColour, sentimentLabel } from '../../../lib/live'
import { iconSvg } from '../../../lib/icons'
import { thumbSvg, thumbUri } from '../../../lib/thumbs'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'
import { useIsNarrow } from '../../../hooks/useIsNarrow'
import { occupancyColour, rsiColour, sparkPath, starsHtml } from '../../../lib/market'
import { Stars } from '../../../components/Stars'

type Frame = Record<string, NodeFrame> | null

function nodeR(frame: Frame, id: string) {
  const f = frame?.[id]
  return f ? peopleRadius(Math.max(f.onSite, f.predicted)) : 8
}

function Bars({ items, unit = '%' }: { items: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="tt-bars">
      {items.map((i) => (
        <div key={i.label} className="tt-bar">
          <span className="tt-bar-lab">{i.label}</span>
          <span className="tt-bar-track">
            <span style={{ width: `${(i.value / max) * 100}%` }}></span>
          </span>
          <span className="tt-bar-val num">
            {i.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Hotels ---------------- */
export function HotelsLayer({ data, day }: { data: MarketVoiceData; day: number }) {
  const { t, lang } = useLang()
  const d = Math.min(data.days - 1, day)
  const icons = useMemo(
    () =>
      Object.fromEntries(
        data.hotels.map((h) => [
          h.id,
          L.divIcon({
            className: 'map-divicon',
            html: `<div class="ov-badge ov-hotel"><span class="ov-bar" style="background:${occupancyColour(h.occupancy_pct[d])}"></span>${iconSvg('bed', 14)}<b class="num">${h.occupancy_pct[d]}%</b><span class="ov-sub">${h.rooms_left[d].toLocaleString()} ${escapeHtml(lang === 'ja' ? '室空き' : 'left')}</span></div>`,
            iconSize: [0, 0],
          }),
        ]),
      ),
    [data, d, lang],
  )
  return (
    <>
      {data.hotels.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lon]} icon={icons[h.id]} keyboard={false}>
          <Tip>
            <div className="tt-head">
              <span>{t(h.name, h.name_ja)}</span>
              {h.real_days?.[d] ? <span className="tt-real">{t('Real', '実データ')}</span> : <span className="tt-demo">{t('Demo', 'デモ')}</span>}
            </div>
            <div className="tt-hero">
              <b className="num">{h.occupancy_pct[d]}%</b>
              <span>
                {t('occupied that night', 'この日の稼働率')} · {h.rooms_left[d].toLocaleString()} / {h.rooms_total.toLocaleString()} {t('rooms left', '室空き')}
              </span>
            </div>
            {h.adr_yen?.[d] ? (
              <div className="tt-grid">
                <span className="tt-k">{t('Average daily rate', '平均客室単価')}</span>
                <span className="tt-v num">¥{Math.round(h.adr_yen[d]!).toLocaleString()}</span>
              </div>
            ) : null}
            {h.forward && h.forward.length > 0 ? (
              <>
                <div className="tt-sec">
                  {t('Forward bookings: on the books for nights ahead', '先行予約：各日の予約済み稼働率')} <span className="tt-real">{t('Real', '実データ')}</span>
                </div>
                <Bars items={h.forward.map((p) => ({ label: `${t('in', '')} ${p.days_ahead} ${t(p.days_ahead === 1 ? 'day' : 'days', '日後')}`, value: p.occ_pct }))} />
              </>
            ) : (
              <>
                <div className="tt-sec">{t('Booking curve for the busiest night', '最繁忙日の予約カーブ')}</div>
                <Bars items={h.booking_curve.points.map((p) => ({ label: `${p.days_ahead} ${t('days out', '日前')}`, value: p.booked_pct }))} />
                <div className="tt-kv">
                  <span>{t('Last year, 7 days out', '前年・7日前')}</span>
                  <b className="num">{h.booking_curve.points.find((p) => p.days_ahead === 7)?.last_year_pct}%</b>
                </div>
              </>
            )}
            <div className="tt-kv">
              <span>
                {t('Rakuten: hotels within', '楽天：半径')} {h.rakuten.radius_km} km {t('with rooms (1/7/30 days)', 'で空室あり（1・7・30日先）')}{' '}
                {h.rakuten.real ? (
                  <span className="tt-real" title={h.rakuten.real.as_of ? `${t('snapshot', 'スナップショット')} ${h.rakuten.real.as_of}` : undefined}>{t('Real', '実データ')}</span>
                ) : (
                  <span className="tt-demo">{t('Demo', 'デモ')}</span>
                )}
              </span>
              <b className="num">
                {h.rakuten.share_with_rooms_pct.d1}% / {h.rakuten.share_with_rooms_pct.d7}% / {h.rakuten.share_with_rooms_pct.d30}%
              </b>
            </div>
            <div className="tip-sub">
              {h.feed}
              {h.as_of ? ` · ${t('as of', '時点')} ${h.as_of}` : ''}
            </div>
          </Tip>
        </Marker>
      ))}
    </>
  )
}

/* ---------------- Search intent ---------------- */
export function RsiLayer({ data }: { data: MarketVoiceData }) {
  const { t, lang } = useLang()
  const icons = useMemo(
    () =>
      Object.fromEntries(
        data.rsi.map((m) => {
          const up = m.change_7d_pct >= 0
          return [
            m.id,
            L.divIcon({
              className: 'map-divicon',
              html: `<div class="ov-badge ov-rsi${m.gmb ? ' gmb' : ''}"><span class="ov-bar" style="background:${m.gmb ? '#9ec5f4' : rsiColour(m.index)}"></span><span class="ov-name">${escapeHtml(lang === 'ja' ? m.name_ja : m.name)}</span><b class="num">${m.gmb ? m.gmb.map_views.toLocaleString() : m.index}</b>${m.gmb ? `<span class="ov-sub">${escapeHtml(lang === 'ja' ? '表示' : 'views')}</span>` : ''}<svg class="ov-spark" viewBox="0 0 56 18" width="56" height="18" aria-hidden="true"><path d="${sparkPath(m.history.slice(-7), 56, 18)}"/></svg><span class="ov-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.abs(m.change_7d_pct)}%</span></div>`,
              iconSize: [0, 0],
            }),
          ]
        }),
      ),
    [data, lang],
  )
  return (
    <>
      {data.rsi.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lon]} icon={icons[m.id]} keyboard={false}>
          <Tip>
            <div className="tt-head">
              <span>{t(m.name, m.name_ja)}</span>
              {m.gmb ? <span className="tt-real">{t('Real', '実データ')}</span> : <span className="tt-demo">{t('Demo', 'デモ')}</span>}
            </div>
            {m.gmb ? (
              <>
                <div className="tt-hero">
                  <b className="num">{m.gmb.map_views.toLocaleString()}</b>
                  <span>
                    {t('Google Maps views of the', 'Googleマップでの表示（')} {m.gmb.node.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} {t('profile', 'のプロフィール）')} · {m.change_7d_pct >= 0 ? '+' : ''}
                    {m.change_7d_pct}% {t('week on week', '（前週比）')}
                  </span>
                </div>
                <div className="tt-grid">
                  <span className="tt-k">{t('Search views', '検索での表示')}</span>
                  <span className="tt-v num">{m.gmb.search_views.toLocaleString()}</span>
                  <span className="tt-k">{t('Direction requests', '経路検索')}</span>
                  <span className="tt-v num">{m.gmb.directions.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="tt-hero">
                <b className="num">{m.index}</b>
                <span>
                  {t('route-search interest index (0–100)', 'ルート検索関心指数（0〜100）')} · {m.change_7d_pct >= 0 ? '+' : ''}
                  {m.change_7d_pct}% {t('vs previous 7 days', '（前7日比）')}
                </span>
              </div>
            )}
            <svg className="tt-spark" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
              <path d={sparkPath(m.history, 300, 60)} />
            </svg>
            <div className="tip-sub">
              {m.gmb
                ? t(`Google Maps Business Profile, last 14 days to ${m.gmb.as_of} (reports lag about 5 days).`, `Googleビジネスプロフィール、${m.gmb.as_of}までの14日間（約5日遅れ）。`)
                : t('Last 14 days. Weekend searches peak Thursday to Friday.', '直近14日。週末の検索は木〜金曜にピーク。')}
            </div>
          </Tip>
        </Marker>
      ))}
    </>
  )
}

/* ---------------- Survey ---------------- */
export function SurveyLayer({ data, nodes, frame, stackBelow }: { data: MarketVoiceData; nodes: MapNode[]; frame: Frame; stackBelow: boolean }) {
  const { t, lang } = useLang()
  const shown = nodes.filter((n) => data.survey[n.id])
  const icons = useMemo(
    () =>
      Object.fromEntries(
        shown.map((n) => {
          const s = data.survey[n.id]
          return [
            n.id,
            L.divIcon({
              className: 'map-divicon',
              html: `<div class="ov-badge ov-below${stackBelow ? ' ov-below2' : ''}" style="--r:${nodeR(frame, n.id)}px">${iconSvg('survey', 13)}<b class="num">${s.satisfaction.toFixed(1)}</b><span class="ov-sub">/5 · NPS ${s.nps > 0 ? '+' : ''}${s.nps}</span></div>`,
              iconSize: [0, 0],
            }),
          ]
        }),
      ),
    [shown, data, frame, stackBelow],
  )
  return (
    <>
      {shown.map((n) => {
        const s = data.survey[n.id]
        return (
          <Marker key={n.id} position={[n.lat, n.lon]} icon={icons[n.id]} keyboard={false}>
            <Tip>
              <div className="tt-head">
                <span>
                  {t(n.name, n.name_ja)} · {t('visitor survey', '来訪者アンケート')}
                </span>
                {s.responses_real ? <span className="tt-real">{t('Mixed', '一部実データ')}</span> : <span className="tt-demo">{t('Demo', 'デモ')}</span>}
              </div>
              <div className="tt-hero">
                <b className="num">{s.satisfaction.toFixed(1)}</b>
                <span>
                  {t('satisfaction (1–5)', '満足度（1〜5）')} · NPS {s.nps > 0 ? '+' : ''}
                  {s.nps} <span className="tt-demo">{t('Demo', 'デモ')}</span>
                </span>
              </div>
              <div className="tt-grid">
                <span className="tt-k">{t('Responses, last 30 days', '回答数（30日）')}</span>
                <span className="tt-v num">
                  {s.responses_30d.toLocaleString()} {s.responses_real ? <span className="tt-real">{t('Real', '実データ')}</span> : null}
                </span>
              </div>
              <div className="tt-sec">{t('Top reasons for visiting', '主な来訪理由')}</div>
              <Bars items={s.top_reasons.map((r) => ({ label: lang === 'ja' ? r.ja : r.en, value: r.share }))} />
              <div className="tt-sec">{t('Where visitors come from', '居住地')}</div>
              <div className="tt-stack" role="img" aria-label={s.origin_share.map((o) => `${o.en} ${o.share}%`).join(', ')}>
                {s.origin_share.map((o, i) => (
                  <span key={o.en} style={{ width: `${o.share}%`, background: ORIGIN_COLOURS[i] }} title={`${o.en} ${o.share}%`}></span>
                ))}
              </div>
              <div className="tt-legend">
                {s.origin_share.map((o, i) => (
                  <span key={o.en}>
                    <i style={{ background: ORIGIN_COLOURS[i] }}></i>
                    {lang === 'ja' ? o.ja : o.en} {o.share}%
                  </span>
                ))}
              </div>
              <div className="tip-sub">
                {s.source}
                {s.responses_real ? ` · ${t('responses as of', '回答数の時点')} ${s.responses_real.as_of}; ${t('satisfaction, NPS, reasons and origin are demo', '満足度・NPS・理由・居住地はデモ')}` : ''}
              </div>
            </Tip>
          </Marker>
        )
      })}
    </>
  )
}

const ORIGIN_COLOURS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9']

/* ---------------- Social media ---------------- */
export function SocialLayer({ data, nodes, frame }: { data: MarketVoiceData; nodes: MapNode[]; frame: Frame }) {
  const { t, lang } = useLang()
  const narrow = useIsNarrow()
  const shown = nodes.filter((n) => data.social[n.id])
  const icons = useMemo(
    () =>
      Object.fromEntries(
        shown.map((n) => {
          const s = data.social[n.id]
          const thumbs = s.feed
            .filter((p) => p.kind === 'photo')
            .slice(0, 2)
            .map((p) => `<span class="ov-thumb">${thumbSvg(p.thumb, 22)}</span>`)
            .join('')
          return [
            n.id,
            L.divIcon({
              className: 'map-divicon',
              html: `<div class="ov-badge ov-social" style="--r:${nodeR(frame, n.id)}px;--sc:${sentimentColour(s.avg_sentiment)}">${thumbs}<span class="ov-stack-txt"><b class="num">${s.posts_24h}</b><span class="ov-sub">${escapeHtml(lang === 'ja' ? '件/24h' : 'posts 24h')}</span></span></div>`,
              iconSize: [0, 0],
            }),
          ]
        }),
      ),
    [shown, data, frame, lang],
  )
  return (
    <>
      {shown.map((n) => {
        const s = data.social[n.id]
        const lab = sentimentLabel(s.avg_sentiment)
        return (
          <Marker key={n.id} position={[n.lat, n.lon]} icon={icons[n.id]}>
            <Tooltip className="map-tip" direction="top" offset={[20, -30]}>
              <strong>
                {t(n.name, n.name_ja)} · {s.posts_24h} {t('posts', '件')}, {s.images_24h} {t('images', '画像')}, {s.comments_24h} {t('comments', 'コメント')}
              </strong>
              <div className="tip-sub">
                {t(lab.en, lab.ja)} · {t('click for the feed', 'クリックで投稿一覧')}
              </div>
            </Tooltip>
            <Popup className="map-pop" maxWidth={360} minWidth={300} autoPanPaddingTopLeft={narrow ? [12, 100] : [340, 80]} autoPanPaddingBottomRight={narrow ? [12, 180] : [400, 110]}>
              <div className="feed">
                <div className="tt-head">
                  <span>
                    {t(n.name, n.name_ja)} · {t('social feed', 'SNSフィード')}
                  </span>
                  <span className="tt-demo">{t('Fictional demo', '架空のデモ')}</span>
                </div>
                <div className="feed-stats">
                  <span>
                    <b className="num">{s.posts_24h}</b> {t('posts', '投稿')}
                  </span>
                  <span>
                    <b className="num">{s.images_24h}</b> {t('images', '画像')}
                  </span>
                  <span>
                    <b className="num">{s.comments_24h}</b> {t('comments', 'コメント')}
                  </span>
                  <span className="feed-sent">
                    <i style={{ background: sentimentColour(s.avg_sentiment) }}></i>
                    {t(lab.en, lab.ja)}
                  </span>
                </div>
                <ul className="feed-list">
                  {s.feed.map((p) => (
                    <li key={p.id} className="feed-item" style={{ borderLeftColor: sentimentColour(p.sentiment) }}>
                      <img src={thumbUri(p.thumb)} alt="" width={40} height={48} />
                      <div>
                        <div className="feed-meta">
                          <span className="feed-handle">@{p.handle}</span> · {p.hours_ago}h · {p.kind}
                        </div>
                        <div className="feed-text">{lang === 'ja' ? p.ja : p.en}</div>
                        <div className="feed-meta">
                          {p.likes} {t('likes', 'いいね')} · {p.comments} {t('replies', '返信')} · {t(sentimentLabel(p.sentiment).en, sentimentLabel(p.sentiment).ja)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

/* ---------------- Reviews ---------------- */
export function ReviewsLayer({ data, nodes, frame }: { data: MarketVoiceData; nodes: MapNode[]; frame: Frame }) {
  const { t, lang } = useLang()
  const shown = nodes.filter((n) => data.reviews[n.id])
  const icons = useMemo(
    () =>
      Object.fromEntries(
        shown.map((n) => {
          const r = data.reviews[n.id]
          const ch = Math.round((r.rating - r.rating_30d_ago) * 10) / 10
          return [
            n.id,
            L.divIcon({
              className: 'map-divicon',
              html: `<div class="ov-badge ov-below" style="--r:${nodeR(frame, n.id)}px">${starsHtml(r.rating)}<b class="num">${r.rating.toFixed(1)}</b><span class="ov-sub">(${r.real ? `+${r.new_30d}` : r.count.toLocaleString()})</span><span class="ov-delta ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}</span></div>`,
              iconSize: [0, 0],
            }),
          ]
        }),
      ),
    [shown, data, frame],
  )
  return (
    <>
      {shown.map((n) => {
        const r = data.reviews[n.id]
        const ch = Math.round((r.rating - r.rating_30d_ago) * 10) / 10
        return (
          <Marker key={n.id} position={[n.lat, n.lon]} icon={icons[n.id]} keyboard={false}>
            <Tip>
              <div className="tt-head">
                <span>
                  {t(n.name, n.name_ja)} · {t('reviews', 'レビュー')}
                </span>
                {r.real ? <span className="tt-real">{t('Real rating', '実評価')}</span> : <span className="tt-demo">{t('Fictional demo', '架空のデモ')}</span>}
              </div>
              <div className="tt-hero">
                <b className="num">{r.rating.toFixed(1)}</b>
                <span>
                  <Stars value={r.rating} /> {r.real ? `${r.new_30d} ${t('new reviews in 30 days', '件の新規レビュー（30日）')}` : `${r.count.toLocaleString()} ${t('reviews', '件')} · ${r.new_30d} ${t('new', '件新規')}`} · {ch >= 0 ? '+' : ''}
                  {ch.toFixed(1)} {t('vs previous 30 days', '（前30日比）')}
                </span>
              </div>
              {(!r.real || r.stars_real) && <Bars items={r.distribution_pct.map((v, i) => ({ label: `${5 - i}★`, value: v }))} />}
              {r.stars_real && (
                <div className="tip-sub">
                  {t(
                    `Stars: the ${r.stars_real.n} Google reviews in the 30 days to ${r.stars_real.as_of}. ${r.count.toLocaleString()} reviews in total.`,
                    `星の内訳：${r.stars_real.as_of}までの30日間のGoogleレビュー${r.stars_real.n}件。総件数${r.count.toLocaleString()}件。`,
                  )}
                </div>
              )}
              <div className="tt-sec">
                {t('Sample snippets', 'サンプル抜粋')} <span className="tt-demo">{t('Fictional', '架空')}</span>
              </div>
              <ul className="tt-quotes">
                {r.snippets.map((s, i) => (
                  <li key={i}>
                    <Stars value={s.stars} small /> “{lang === 'ja' ? s.ja : s.en}” <span className="muted">· {s.days_ago}d</span>
                  </li>
                ))}
              </ul>
              <div className="tip-sub">{r.real ? t(`Rating: average of new Google reviews in the 30 days to ${r.real.as_of}, weighted by review count (Business Profile). Snippets are fictional.`, `評価：${r.real.as_of}までの30日間の新規Googleレビューの加重平均。抜粋は架空。`) : r.source}</div>
            </Tip>
          </Marker>
        )
      })}
    </>
  )
}
