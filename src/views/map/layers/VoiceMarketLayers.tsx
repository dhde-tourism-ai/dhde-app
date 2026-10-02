import { useMemo } from 'react'
import { Marker, Polyline, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { MarketVoiceData, SocialNode } from '../../../types/market'
import type { MapNode } from '../../../lib/nodes'
import type { RegistryNode } from '../../../types/nodes'
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
/** "Area · 8 hotels · 3 sites": each badge is a whole FTAS feed, not one hotel or one site. */
function areaLabel(n: number | undefined, sites: number, lang: 'en' | 'ja'): string {
  const parts = [lang === 'ja' ? 'エリア' : 'Area']
  if (n) parts.push(lang === 'ja' ? `${n}軒` : `${n} ${n === 1 ? 'hotel' : 'hotels'}`)
  if (sites > 1) parts.push(lang === 'ja' ? `${sites}地点` : `${sites} sites`)
  return parts.join(' · ')
}

export function HotelsLayer({ data, day, nodes }: { data: MarketVoiceData; day: number; nodes: RegistryNode[] }) {
  const { t, lang } = useLang()
  const d = Math.min(data.days - 1, day)
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id as string, n])), [nodes])
  const siteName = (id: string) => {
    const n = byId.get(id)
    return n ? t(n.name.replace(' East Entrance', ''), n.name_ja) : id
  }
  const icons = useMemo(
    () =>
      Object.fromEntries(
        data.hotels.map((h) => [
          h.id,
          L.divIcon({
            className: 'map-divicon',
            html: `<div class="ov-hotel-wrap"><div class="ov-badge ov-hotel"><span class="ov-bar" style="background:${occupancyColour(h.occupancy_pct[d])}"></span>${iconSvg('bed', 14)}<b class="num">${h.occupancy_pct[d]}%</b><span class="ov-sub">${h.rooms_left[d].toLocaleString('en-US')} ${escapeHtml(lang === 'ja' ? '室空き' : 'left')}</span></div><div class="ov-area">${escapeHtml(areaLabel(h.hotels_in_feed, h.serves?.length ?? 1, lang))}</div></div>`,
            iconSize: [0, 0],
          }),
        ]),
      ),
    [data, d, lang],
  )
  return (
    <>
      {/* An area that stands for several sites (Echizen coast) links its badge to each of them. */}
      {data.hotels.flatMap((h) =>
        (h.serves ?? []).length > 1
          ? (h.serves ?? []).flatMap((id) => {
              const n = byId.get(id)
              return n
                ? [
                    <Polyline
                      key={`${h.id}-${id}`}
                      positions={[
                        [h.lat, h.lon],
                        [n.lat, n.lon],
                      ]}
                      pathOptions={{ color: '#c9d4ff', weight: 1.5, dashArray: '3,6', opacity: 0.7 }}
                      interactive={false}
                    />,
                  ]
                : []
            })
          : [],
      )}
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
                {t('occupied that night', 'この日の稼働率')} · {h.rooms_left[d].toLocaleString('en-US')} / {h.rooms_total.toLocaleString('en-US')} {t('rooms left', '室空き')}
              </span>
            </div>
            {/* Hidden without a count, as the caption does, rather than showing "?". */}
            {typeof h.hotels_in_feed === 'number' && (
              <div className="tt-kv">
                <span>{t('Area, not one hotel: hotels in this feed', 'エリア全体（1軒ではない）：フィード内の施設数')}</span>
                <b className="num">{h.hotels_in_feed}</b>
              </div>
            )}
            {(h.serves ?? []).length > 1 && (
              <div className="tt-kv">
                <span>{t('One regional feed for', '1つの広域フィードで対象')}</span>
                <b>{(h.serves ?? []).map(siteName).join(', ')}</b>
              </div>
            )}
            {h.adr_yen?.[d] ? (
              <div className="tt-grid">
                <span className="tt-k">{t('Average daily rate', '平均客室単価')}</span>
                <span className="tt-v num">¥{Math.round(h.adr_yen[d]!).toLocaleString('en-US')}</span>
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
              html: `<div class="ov-badge ov-rsi${m.gmb ? ' gmb' : ''}"><span class="ov-bar" style="background:${m.gmb ? '#9ec5f4' : rsiColour(m.index)}"></span><span class="ov-name">${escapeHtml(lang === 'ja' ? m.name_ja : m.name)}</span><b class="num">${m.gmb ? m.gmb.map_views.toLocaleString('en-US') : m.index}</b>${m.gmb ? `<span class="ov-sub">${escapeHtml(lang === 'ja' ? '表示' : 'views')}</span>` : ''}<svg class="ov-spark" viewBox="0 0 56 18" width="56" height="18" aria-hidden="true"><path d="${sparkPath(m.history.slice(-7), 56, 18)}"/></svg><span class="ov-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.abs(m.change_7d_pct)}%</span></div>`,
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
                  <b className="num">{m.gmb.map_views.toLocaleString('en-US')}</b>
                  <span>
                    {t('Google Maps views of the', 'Googleマップでの表示（')} {m.gmb.node.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} {t('profile', 'のプロフィール）')} · {m.change_7d_pct >= 0 ? '+' : ''}
                    {m.change_7d_pct}% {t('week on week', '（前週比）')}
                  </span>
                </div>
                <div className="tt-grid">
                  <span className="tt-k">{t('Search views', '検索での表示')}</span>
                  <span className="tt-v num">{m.gmb.search_views.toLocaleString('en-US')}</span>
                  <span className="tt-k">{t('Direction requests', '経路検索')}</span>
                  <span className="tt-v num">{m.gmb.directions.toLocaleString('en-US')}</span>
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
              html: `<div class="ov-badge ov-below${stackBelow ? ' ov-below2' : ''}" style="--r:${nodeR(frame, n.id)}px">${iconSvg('survey', 13)}<b class="num">${s.satisfaction.toFixed(1)}</b><span class="ov-sub">/5${s.nps !== null ? ` · NPS ${s.nps > 0 ? '+' : ''}${s.nps}` : ''}</span></div>`,
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
                {s.details_real ? (
                  <span className="tt-real">{t('Real', '実データ')}</span>
                ) : s.responses_real ? (
                  <span className="tt-real">{t('Partly estimated or demo', '一部推計・デモ')}</span>
                ) : (
                  <span className="tt-demo">{t('Demo', 'デモ')}</span>
                )}
              </div>
              <div className="tt-hero">
                <b className="num">{s.satisfaction.toFixed(1)}</b>
                <span>
                  {t('satisfaction (1–5)', '満足度（1〜5）')}
                  {s.nps !== null && (
                    <>
                      {' '}
                      · NPS {s.nps > 0 ? '+' : ''}
                      {s.nps} {!s.details_real && <span className="tt-demo">{t('Demo', 'デモ')}</span>}
                    </>
                  )}
                </span>
              </div>
              <div className="tt-grid">
                <span className="tt-k">{t('Responses, last 30 days', '回答数（30日）')}</span>
                <span className="tt-v num">
                  {s.responses_30d.toLocaleString('en-US')} {s.responses_real ? <span className="tt-real">{t('Real', '実データ')}</span> : null}
                </span>
              </div>
              <div className="tt-sec">{t('Top reasons for visiting', '主な来訪理由')}</div>
              <Bars items={s.top_reasons.map((r) => ({ label: lang === 'ja' ? r.ja : r.en, value: r.share }))} />
              <div className="tt-sec">{s.details_real ? t('Where visitors live (Japan)', '居住地（国内）') : t('Where visitors come from', '居住地')}</div>
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
                {s.details_real
                  ? ` · ${t(`${s.details_real.responses} responses in the 30 days to ${s.details_real.as_of}. NPS from ${s.details_real.nps_n} answers${s.nps === null ? ' (too few to show)' : ''}. Reasons: share of responses (several allowed). Respondents live in Japan.`, `${s.details_real.as_of}までの30日間の回答${s.details_real.responses}件。NPSは${s.details_real.nps_n}件の回答から${s.nps === null ? '（件数不足のため非表示）' : ''}。理由は回答者に占める割合（複数回答）。回答者は国内在住。`)}`
                  : s.responses_real
                    ? ` · ${t('responses as of', '回答数の時点')} ${s.responses_real.as_of}; ${t('satisfaction, NPS, reasons and origin are demo', '満足度・NPS・理由・居住地はデモ')}`
                    : ''}
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
/** Badge edge for real social counts without a sentiment score: neutral grey. */
const SOCIAL_REAL_EDGE = '#8a94a6'
const SCRIPT_LABELS: { k: keyof NonNullable<SocialNode['real']>['scripts']; en: string; ja: string }[] = [
  { k: 'ja', en: 'Japanese', ja: '日本語' },
  { k: 'zh', en: 'Chinese (at least)', ja: '中国語（最低値）' },
  { k: 'ko', en: 'Korean', ja: '韓国語' },
  { k: 'latin', en: 'English / Latin script', ja: '英語など' },
]
const LANG_LABELS: { k: keyof NonNullable<SocialNode['mentions']>['langs']; en: string; ja: string }[] = [
  { k: 'ja', en: 'Japanese', ja: '日本語' },
  { k: 'en', en: 'English', ja: '英語' },
  { k: 'zh_hant', en: 'Chinese, Traditional (Taiwan, HK)', ja: '中国語・繁体字（台湾・香港）' },
  { k: 'zh_hans', en: 'Chinese, Simplified', ja: '中国語・簡体字' },
  { k: 'ko', en: 'Korean', ja: '韓国語' },
  { k: 'ar', en: 'Arabic', ja: 'アラビア語' },
  { k: 'other', en: 'Other', ja: 'その他' },
]
const PLATFORMS = [
  { k: 'youtube', name: 'YouTube' },
  { k: 'bluesky', name: 'Bluesky' },
  { k: 'reddit', name: 'Reddit' },
] as const

/** Real posts in the window: Instagram plus mentions. */
function realSocialTotal(s: SocialNode): number {
  return (s.real?.posts ?? 0) + (s.mentions?.total ?? 0)
}

function RealSocialMarker({ node: n, social: s, icon }: { node: MapNode; social: SocialNode; icon: L.DivIcon }) {
  const { t } = useLang()
  const narrow = useIsNarrow()
  const fmt = (v: number) => v.toLocaleString('en-US')
  const r = s.real
  const m = s.mentions
  const sr = s.sentiment_real
  const captioned = r ? r.posts - r.scripts.none : 0
  const days = Math.max(r?.days ?? 0, m?.days ?? 0)
  const asOf = [r?.as_of, m?.as_of].filter(Boolean).sort().pop() ?? ''
  const lab = sr && sr.score !== null ? sentimentLabel(sr.score) : null
  const pct = (k: number, of: number) => (of ? Math.round((k / of) * 100) : 0)
  return (
    <Marker position={[n.lat, n.lon]} icon={icon}>
      <Tooltip className="map-tip" direction="top" offset={[20, -30]}>
        <strong>
          {t(n.name, n.name_ja)} · {fmt(realSocialTotal(s))} {t('posts and comments', '件の投稿・コメント')}, {t(`${days} days to ${asOf}`, `${asOf}までの${days}日間`)}
        </strong>
        <div className="tip-sub">
          {lab ? `${t(lab.en, lab.ja)} · ` : ''}
          {t('click for details', 'クリックで詳細')}
        </div>
      </Tooltip>
      <Popup className="map-pop" maxWidth={360} minWidth={280} autoPanPaddingTopLeft={narrow ? [12, 100] : [340, 80]} autoPanPaddingBottomRight={narrow ? [12, 180] : [400, 110]}>
        <div className="feed">
          <div className="tt-head">
            <span>
              {t(n.name, n.name_ja)} · {t('social media', 'SNS')}
            </span>
            <span className="tt-real">{t(`Real · ${days} days to ${asOf}`, `実データ・${asOf}までの${days}日間`)}</span>
          </div>
          {sr && (
            <>
              <div className="tt-sec">{t('Sentiment', '感情')}</div>
              {sr.score !== null && lab ? (
                <div className="feed-stats">
                  <span className="feed-sent">
                    <i style={{ background: sentimentColour(sr.score) }}></i>
                    {t(lab.en, lab.ja)}{' '}
                    <b className="num">
                      {sr.score > 0 ? '+' : ''}
                      {sr.score.toFixed(2)}
                    </b>
                  </span>
                  <span>
                    <b className="num">{pct(sr.positive, sr.scored)}%</b> {t('positive', '好意的')}
                  </span>
                  <span>
                    <b className="num">{pct(sr.neutral, sr.scored)}%</b> {t('neutral', '中立')}
                  </span>
                  <span>
                    <b className="num">{pct(sr.negative, sr.scored)}%</b> {t('negative', '否定的')}
                  </span>
                </div>
              ) : (
                <p className="muted small">{t(`Only ${sr.scored} scored: too few to judge.`, `判定は${sr.scored}件のみ：少なすぎて判定できません。`)}</p>
              )}
            </>
          )}
          {m && (
            <>
              <div className="tt-sec">{t('Mentions: posts and comments naming the site', '言及：この地点に触れた投稿・コメント')}</div>
              <div className="feed-stats">
                {PLATFORMS.map((p) => {
                  const v = m.platforms[p.k]
                  return (
                    <span key={p.k}>
                      {v === null ? (
                        <>
                          {p.name} <span className="muted">{t('not collected', '未収集')}</span>
                        </>
                      ) : (
                        <>
                          <b className="num">{fmt(v)}</b> {p.name}
                        </>
                      )}
                    </span>
                  )
                })}
              </div>
              {m.total > 0 && (
                <ul className="feed-list">
                  {LANG_LABELS.filter((l) => m.langs[l.k] > 0).map((l) => (
                    <li key={l.k} className="feed-item">
                      <div className="feed-meta">
                        {t(l.en, l.ja)}: <b className="num">{pct(m.langs[l.k], m.total)}%</b> ({fmt(m.langs[l.k])})
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {r && (
            <>
              <div className="tt-sec">{t('Instagram: posts tagged at the site', 'Instagram：この地点にタグ付けされた投稿')}</div>
              <div className="feed-stats">
                <span>
                  <b className="num">{fmt(r.posts)}</b> {t('posts', '投稿')}
                </span>
                <span>
                  <b className="num">{fmt(r.photos)}</b> {t('photos', '写真')}
                </span>
                <span>
                  <b className="num">{fmt(r.videos)}</b> {t('videos', '動画')}
                </span>
                <span>
                  <b className="num">{fmt(r.likes)}</b> {t('likes', 'いいね')}
                </span>
                <span>
                  <b className="num">{fmt(r.comments)}</b> {t('comments', 'コメント')}
                </span>
              </div>
              {captioned > 0 && (
                <ul className="feed-list">
                  {SCRIPT_LABELS.filter((l) => r.scripts[l.k] > 0).map((l) => (
                    <li key={l.k} className="feed-item">
                      <div className="feed-meta">
                        {t(l.en, l.ja)}: <b className="num">{pct(r.scripts[l.k], captioned)}%</b> ({fmt(r.scripts[l.k])})
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="muted small">
            {t(
              'Collected weekly. Only counts and scores are kept: no usernames, text or images. Each post and comment is scored by a language model (some languages translated to English first). It is a first model, not yet checked against hand-labelled posts: read the score as a trend, not a verdict. Language points to a market, not nationality; kanji-only text counts as Japanese unless it uses characters only Chinese uses, so Chinese shares are a floor. Likes (to the nearest 10) and comments (nearest 5) are rounded and counted when collected.',
              '毎週収集。件数とスコアのみ保存し、ユーザー名・本文・画像は保存しません。投稿・コメントごとに言語モデルで判定（一部の言語は英訳してから判定）。手作業の判定との照合前の初期モデルのため、スコアは傾向として見てください。言語は市場の目安で、国籍ではありません。漢字のみの文は中国語特有の字がない限り日本語として数えるため、中国語の割合は最低値です。いいね（10単位）・コメント（5単位）は丸めた収集時点の数。',
            )}
          </p>
        </div>
      </Popup>
    </Marker>
  )
}

export function SocialLayer({ data, nodes, frame }: { data: MarketVoiceData; nodes: MapNode[]; frame: Frame }) {
  const { t, lang } = useLang()
  const narrow = useIsNarrow()
  const shown = nodes.filter((n) => data.social[n.id])
  const icons = useMemo(
    () =>
      Object.fromEntries(
        shown.map((n) => {
          const s = data.social[n.id]
          if (s.real || s.mentions) {
            // Real counts: no thumbnails (no images are kept); the edge is the real sentiment where there's enough of it.
            const days = Math.max(s.real?.days ?? 0, s.mentions?.days ?? 0)
            const sc = s.sentiment_real?.score
            const edge = typeof sc === 'number' ? sentimentColour(sc) : SOCIAL_REAL_EDGE
            return [
              n.id,
              L.divIcon({
                className: 'map-divicon',
                html: `<div class="ov-badge ov-social" style="--r:${nodeR(frame, n.id)}px;--sc:${edge}"><span class="ov-stack-txt"><b class="num">${realSocialTotal(s).toLocaleString('en-US')}</b><span class="ov-sub">${escapeHtml(lang === 'ja' ? `件/${days}日` : `posts ${days}d`)}</span></span></div>`,
                iconSize: [0, 0],
              }),
            ]
          }
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
        if (s.real || s.mentions) return <RealSocialMarker key={n.id} node={n} social={s} icon={icons[n.id]} />
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
              html: `<div class="ov-badge ov-below" style="--r:${nodeR(frame, n.id)}px">${starsHtml(r.rating)}<b class="num">${r.rating.toFixed(1)}</b><span class="ov-sub">(${r.real ? `+${r.new_30d}` : r.count.toLocaleString('en-US')})</span><span class="ov-delta ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}</span></div>`,
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
                  <Stars value={r.rating} /> {r.real ? `${r.new_30d} ${t('new reviews in 30 days', '件の新規レビュー（30日）')}` : `${r.count.toLocaleString('en-US')} ${t('reviews', '件')} · ${r.new_30d} ${t('new', '件新規')}`} · {ch >= 0 ? '+' : ''}
                  {ch.toFixed(1)} {t('vs previous 30 days', '（前30日比）')}
                </span>
              </div>
              {(!r.real || r.stars_real) && <Bars items={r.distribution_pct.map((v, i) => ({ label: `${5 - i}★`, value: v }))} />}
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
              <div className="tip-sub">
                {r.stars_real
                  ? t(
                      `Rating, new reviews and stars: the ${r.stars_real.n} Google Maps reviews of this place in the 30 days to ${r.stars_real.as_of}. ${r.count.toLocaleString('en-US')} reviews in total. Snippets are fictional.`,
                      `評価・新規件数・星の内訳：${r.stars_real.as_of}までの30日間のこの場所のGoogleマップレビュー${r.stars_real.n}件。総件数${r.count.toLocaleString('en-US')}件。抜粋は架空。`,
                    )
                  : r.real
                    ? t(`Rating: average of new Google reviews in the 30 days to ${r.real.as_of}, weighted by review count (Business Profile). Snippets are fictional.`, `評価：${r.real.as_of}までの30日間の新規Googleレビューの加重平均。抜粋は架空。`)
                    : r.source}
              </div>
            </Tip>
          </Marker>
        )
      })}
    </>
  )
}
