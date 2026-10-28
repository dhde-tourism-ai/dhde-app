import type { ReactNode } from 'react'
import type { ProductData } from '../../hooks/useProductData'
import type { RealDaily, RealNode } from '../../types/real'
import { useLang } from '../../lib/i18n'
import type { Lang } from '../../lib/i18n'
import { MON_AR } from '../../lib/arFormat'
import { ORIGIN_LABELS, PURPOSE_LABELS } from '../../lib/real'
import { econNodeFor } from '../../lib/economics'
import { alertText } from '../../lib/jmaWarnings'

const n0 = (v: number) => Math.round(v).toLocaleString('en-US')

/** "10/25" (or "25 أكتوبر" in Arabic) for a block's as-of date. */
const mdOf = (iso: string | null | undefined, lang: Lang) =>
  !iso ? '' : lang === 'ar' ? `${Number(iso.slice(8, 10))} ${MON_AR[Number(iso.slice(5, 7)) - 1]}` : `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

/** ¥3,670,221,775 → "36.7億円" / "¥3.7bn" / "3.7 مليار ين". */
function yen(v: number, lang: Lang): string {
  if (lang === 'ja') return v >= 1e8 ? `${(v / 1e8).toFixed(1)}億円` : `${n0(v / 1e4)}万円`
  if (lang === 'ar') return v >= 1e9 ? `${(v / 1e9).toFixed(1)} مليار ين` : `${(v / 1e6).toFixed(0)} مليون ين`
  return v >= 1e9 ? `¥${(v / 1e9).toFixed(1)}bn` : `¥${(v / 1e6).toFixed(0)}M`
}

/** The last `n` days to `asOf` (inclusive). */
function lastDays(daily: RealDaily[], asOf: string | null | undefined, n: number): RealDaily[] {
  if (!asOf) return []
  const from = new Date(Date.parse(`${asOf}T00:00:00Z`) - (n - 1) * 86400000).toISOString().slice(0, 10)
  return daily.filter((r) => r.date >= from && r.date <= asOf)
}

const sumK = (rows: RealDaily[], k: keyof RealDaily) => rows.reduce((a, r) => a + ((r[k] as number | null) ?? 0), 0)

/** Values over time as a thin line; gaps (null) break it. */
function Spark({ values }: { values: (number | null)[] }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0))
  const W = 240
  const H = 30
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * W : 0)
  const y = (v: number) => H - 2 - (v / max) * (H - 4)
  let d = ''
  values.forEach((v, i) => {
    if (v === null) return
    d += `${i === 0 || values[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  return (
    <svg className="sd-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function Kv({ items }: { items: [value: string, label: string][] }) {
  return (
    <div className="sd-kv">
      {items.map(([v, k]) => (
        <div key={k}>
          <div className="v">{v}</div>
          <div className="k">{k}</div>
        </div>
      ))}
    </div>
  )
}

function Shares({ title, rows }: { title: string; rows: { label: string; pct: number }[] }) {
  const top = Math.max(1, ...rows.map((r) => r.pct))
  return (
    <div className="sd-shares">
      <div className="k">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="sd-share">
          <span>{r.label}</span>
          <i style={{ width: `${(r.pct / top) * 100}%` }}></i>
          <span className="num">{Math.round(r.pct)}%</span>
        </div>
      ))}
    </div>
  )
}

function Block({ title, src, tip, children }: { title: string; src: string; tip?: string; children: ReactNode }) {
  return (
    <div className="sd-blk" title={tip}>
      <h3>
        {title}
        <span>{src}</span>
      </h3>
      {children}
    </div>
  )
}

interface Props {
  data: ProductData
  id: string
  rn: RealNode
}

/**
 * The site page's "other real data" section, under the week table: the original
 * map's layers that have real data for this node (road counter, JMA warnings,
 * Rakuten, Google Maps, reviews, survey, social, economics). A block with no
 * real data for the node is left out, never filled with demo values.
 */
export function SiteData({ data, id, rn }: Props) {
  const { t, lang } = useLang()
  const md = (iso: string | null | undefined) => mdOf(iso, lang)
  const live = data.merged?.live
  const social = data.merged?.market?.social[id]
  const reg = data.registry.data?.nodes.find((n) => n.id === id)
  const econ = reg ? econNodeFor(reg, data.economics.data ?? null) : undefined
  const blocks: ReactNode[] = []

  // Road counter: a zero, or the build day's partial count, is no reading (as on the main map).
  const today = data.merged?.real?.today ?? ''
  const traffic = rn.daily.filter((r) => r.traffic_volume && r.date < today)
  const tLast = traffic.at(-1)
  if (tLast?.traffic_volume) {
    const month = lastDays(rn.daily, tLast.date, 30)
    const read = month.filter((r) => r.traffic_volume && r.date < today)
    blocks.push(
      <Block key="traffic" title={t('Road traffic', '道路交通量')} src={t(`road counter · to ${md(tLast.date)}`, `道路の計測器 · ${md(tLast.date)}まで`, `عدّاد الطريق · حتى ${md(tLast.date)}`)}>
        <Kv
          items={[
            [n0(tLast.traffic_volume), t(`vehicles on ${md(tLast.date)}`, `${md(tLast.date)}の台数`, `مركبة في ${md(tLast.date)}`)],
            [n0(sumK(read, 'traffic_volume') / read.length), t(`daily mean, ${read.length} days`, `1日平均（${read.length}日分）`, `المتوسط اليومي، ${read.length} يومًا`)],
          ]}
        />
        <Spark values={month.map((r) => (r.traffic_volume && r.date < today ? r.traffic_volume : null))} />
      </Block>,
    )
  }

  // JMA warnings in force: only once read live (demo alerts mean JMA couldn't be reached).
  if (live && live.weather_alerts.every((a) => !a.demo)) {
    const now = live.now_index ?? live.observed_until
    const on = live.weather_alerts.filter((a) => a.nodes.includes(id) && a.start <= now && now < a.end)
    blocks.push(
      <Block key="warn" title={t('Weather warnings', '警報・注意報')} src={t('JMA · live', '気象庁 · 最新')}>
        <div className="sd-text">{on.length ? on.map((a) => alertText(a, lang).title).join(t(', ', '、')) : t('None in force', '発表なし')}</div>
      </Block>,
    )
  }

  const rk = rn.rakuten
  if (rk) {
    const s = rk.share_with_rooms_pct
    const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`)
    blocks.push(
      <Block key="rakuten" title={t('Hotels with rooms left', '空室のある宿')} src={t(`Rakuten, within 3 km · ${md(rk.as_of)}`, `楽天 · 3km以内 · ${md(rk.as_of)}`, `راكوتن، ضمن 3 كم · ${md(rk.as_of)}`)}>
        <Kv items={[[pct(s.d1), t('tomorrow', '明日')], [pct(s.d7), t('in 7 days', '7日後')], [pct(s.d30), t('in 30 days', '30日後')]]} />
      </Block>,
    )
  }

  const gAsOf = rn.as_of.google_maps
  const week = lastDays(rn.daily, gAsOf, 7).filter((r) => r.gmb_map_views !== null)
  if (week.length) {
    const month = lastDays(rn.daily, gAsOf, 30)
    blocks.push(
      <Block key="gmb" title={t('Google Maps', 'Googleマップ')} src={t(`last 7 days · to ${md(gAsOf)}`, `直近7日 · ${md(gAsOf)}まで`, `آخر 7 أيام · حتى ${md(gAsOf)}`)}>
        <Kv
          items={[
            [n0(sumK(week, 'gmb_map_views')), t('map views', '表示')],
            [n0(sumK(week, 'gmb_search_views')), t('searches', '検索')],
            [n0(sumK(week, 'gmb_directions')), t('directions', '経路')],
          ]}
        />
        <Spark values={month.map((r) => r.gmb_map_views)} />
      </Block>,
    )
  }

  const rated = rn.daily.filter((r) => r.reviews_rating_total !== null && r.reviews_count_total !== null).at(-1)
  if (rated) {
    const month = lastDays(rn.daily, rated.date, 30)
    blocks.push(
      <Block key="reviews" title={t('Reviews', '口コミ')} src={`Google · ${md(rated.date)}`}>
        <Kv
          items={[
            [rated.reviews_rating_total!.toFixed(1), t('rating', '評価')],
            [n0(rated.reviews_count_total!), t('reviews', '件数')],
            [n0(sumK(month, 'reviews_new')), t('new, last 30 days', '直近30日の新規')],
          ]}
        />
      </Block>,
    )
  }

  const sv = rn.survey
  if (sv && sv.satisfaction !== null) {
    const label = (m: Record<string, { en: string; ja: string }>, k: string) => (m[k] ? t(m[k].en, m[k].ja) : k)
    const top = (pct: Record<string, number>, m: Record<string, { en: string; ja: string }>, n: number) =>
      Object.entries(pct)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => ({ label: label(m, k), pct: v }))
    blocks.push(
      <Block key="survey" title={t('Visitor survey', 'アンケート')} src={t(`FTAS · last 30 days, ${sv.responses} answers`, `FTAS · 直近30日 ${sv.responses}件`, `FTAS · آخر 30 يومًا، ${sv.responses} إجابة`)}>
        <Kv items={[[sv.satisfaction.toFixed(2), t('satisfaction /5', '満足度 /5')], ...(sv.nps === null ? [] : ([[`${sv.nps > 0 ? '+' : ''}${Math.round(sv.nps)}`, 'NPS']] as [string, string][]))]} />
        <div className="sd-cols">
          <Shares title={t('Home region', '居住地')} rows={top(sv.origin_pct, ORIGIN_LABELS, 6)} />
          <Shares title={t('Why they came', '来訪目的')} rows={top(sv.purpose_pct, PURPOSE_LABELS, 5)} />
        </div>
      </Block>,
    )
  }

  const m = social?.mentions
  const s = social?.sentiment_real
  if (m || social?.real) {
    const total = (m?.total ?? 0) + (social?.real?.posts ?? 0)
    const asOf = [m?.as_of, social?.real?.as_of].filter(Boolean).sort().at(-1)
    const scored = s ? s.positive + s.neutral + s.negative : 0
    const items: [string, string][] = [[n0(total), t('posts and comments', '投稿・コメント')]]
    if (s && s.score !== null && scored) {
      items.push([`${Math.round((s.positive / scored) * 100)}%`, t('positive', 'ポジティブ')], [`${Math.round((s.negative / scored) * 100)}%`, t('negative', 'ネガティブ')])
    }
    const langs = m ? Object.values(m.langs).reduce((a, b) => a + b, 0) : 0
    if (m && langs) items.push([`${Math.round((m.langs.ja / langs) * 100)}%`, t('in Japanese', '日本語')])
    blocks.push(
      <Block
        key="social"
        title={t('Social media', 'SNS')}
        src={t(`Instagram, YouTube, Bluesky, Reddit · week to ${md(asOf)}`, `Instagram・YouTube・Bluesky・Reddit · ${md(asOf)}までの1週間`, `Instagram وYouTube وBluesky وReddit · أسبوع حتى ${md(asOf)}`)}
        tip={t('Sentiment is scored by a language model not yet checked against hand labels: read it as a trend.', '感情は手作業の判定との照合前の言語モデルによる判定。傾向として見てください。')}
      >
        <Kv items={items} />
      </Block>,
    )
  }

  if (econ && econ.visitors.status === 'real' && econ.visitors.value !== null) {
    const v = econ.visitors.value
    const prev = econ.visitors_2024?.status === 'real' ? econ.visitors_2024.value : null
    const items: [string, string][] = [[n0(v), t('visitors, 2025', '2025年の入込数')]]
    if (prev) items.push([`${v >= prev ? '+' : ''}${Math.round(((v - prev) / prev) * 100)}%`, t('vs 2024', '前年比')])
    if (econ.revenue_yen.value !== null) items.push([yen(econ.revenue_yen.value, lang), t('visitor spend (estimate)', '観光消費額（推計）')])
    blocks.push(
      <Block
        key="econ"
        title={t('Economics', '経済')}
        src={t('Fukui Prefecture, 2025', '福井県 · 2025年')}
        tip={econ.revenue_yen.status === 'modelled' ? t('Spend = visitors × prefecture-wide spend per visitor (modelled).', '観光消費額 = 入込数 × 県全体の1人当たり消費額（推計）。') : undefined}
      >
        <Kv items={items} />
      </Block>,
    )
  }

  if (!blocks.length) return null
  return (
    <section className="page site-data">
      <h2 className="site-h2">{t('More real data', 'その他の実データ')}</h2>
      <div className="sd-grid">{blocks}</div>
    </section>
  )
}
