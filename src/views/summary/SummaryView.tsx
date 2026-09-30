import { useMemo } from 'react'
import type { ProductData } from '../../hooks/useProductData'
import type { ProgressCard } from '../../types/strategy'
import type { SourceInfo } from '../../types/live'
import { useJsonResource } from '../../hooks/useJsonResource'
import { computeNudges, PRIORITY, priorityOf } from '../../lib/nudges'
import type { HotelThresholds } from '../../lib/nudges'
import { dayLabel } from '../../lib/live'
import { fmtDate } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import { Icon } from '../../components/icons'
import { SourceBadge } from '../../components/SourceBadge'
import { Loading } from '../../components/StateMsg'
import { LAYERS } from '../map/layers'
import '../../styles/pages.css'

const RANK = { high: 0, medium: 1, low: 2 } as const
/** Tooltip for the visitors card's badge: its visitor numbers are estimates, not counts. */
const ESTIMATE_NOTE = [
  "Visitors are estimates: each site's signal (cameras, reservations or survey responses) scaled to its 2025 official annual count. Forecasts are the FTAS model's.",
  '来訪者数は推計値：各地点の信号（カメラ・予約・アンケート回答）を2025年の公式年間値に換算。予測はFTASモデル。',
] as const

/** Japanese names for the vision KPI rows in strategic_questions.json (English only there). */
const TARGET_JA: Record<string, string> = {
  Visitors: '観光客入込数',
  'Tourism spend': '観光消費額',
  'Spend per overnight guest': '宿泊客1人当たり消費額',
  "Overnight guest-nights (the vision's 県内宿泊者数)": '県内宿泊者数（延べ宿泊者数）',
  "Foreign guest-nights (the vision's 外国人宿泊者数)": '外国人宿泊者数（延べ宿泊者数）',
}

function fmtUnit(v: number, prefix: string, unit: string): string {
  return `${prefix}${v.toLocaleString('en-US')}${unit}`
}

/**
 * Landing page for government users: visitors vs forecast, vision targets,
 * the week's top actions and data freshness, one click from each view.
 * Every number comes from the same files the other views use.
 */
export default function SummaryView({ data }: { data: ProductData }) {
  const { t, lang } = useLang()
  const live = data.merged?.live ?? data.live.data
  const market = data.merged?.market ?? data.market.data
  const registry = data.registry.data
  const thresholds = useJsonResource<HotelThresholds>('hotel_thresholds.json').data

  const real = data.merged?.real ?? null
  const shared = real?.shared_date ?? null
  // The latest day every node has real data for (the map's "observed" edge), and the day after it.
  const lastDay = live ? Math.floor(live.observed_until / 24) : 0
  const nextDay = Math.min(lastDay + 1, (live?.days.length ?? 1) - 1)
  const nextDate = live?.days[nextDay]?.date ?? null

  // Only data-based numbers: the latest day's visitor estimate from real_data.json
  // (visitors_est: each site's signal scaled to its 2025 official count, so an
  // estimate, not a count) and the model's own forecast for the next day. The model starts the day after the shared date, so there is no
  // model forecast for the measured day to compare against.
  const sites = useMemo(() => {
    if (!live) return []
    return Object.keys(live.nodes).map((id) => {
      const reg = registry?.nodes.find((n) => n.id === id || n.aliases?.includes(id))
      const rn = real?.nodes[id]
      const fc = rn?.forecast?.days.find((x) => x.date === nextDate && !x.week_ahead_missing)
      return {
        id,
        name: reg?.name.replace(' East Entrance', '') ?? id,
        name_ja: reg?.name_ja ?? id,
        noEstimate: Boolean(live.node_meta?.[id]?.no_estimate),
        measured: rn?.daily.find((r) => r.date === shared)?.visitors_est ?? null,
        forecast: fc?.visitors_est ?? null,
        lo: fc?.visitors_lo ?? null,
        hi: fc?.visitors_hi ?? null,
        wape: rn?.forecast?.backtest_wape ?? null,
        hasModel: Boolean(rn?.forecast?.days.length),
      }
    })
  }, [live, registry, real, shared, nextDate])
  const wapes = sites.filter((s) => s.forecast !== null && s.wape !== null).map((s) => s.wape as number)

  const actions = useMemo(() => {
    if (!live) return []
    return computeNudges(live, market, registry?.nodes ?? [], live.today_day ?? 0, thresholds)
      .filter((n) => n.day >= nextDay && n.day < nextDay + 7)
      .sort((a, b) => RANK[priorityOf(a.sev)] - RANK[priorityOf(b.sev)] || b.magnitude - a.magnitude)
      .slice(0, 3)
  }, [live, market, registry, nextDay, thresholds])

  const progress = data.strategy.data?.questions.flatMap((q) => q.cards).find((c): c is ProgressCard => c.type === 'progress')
  const targets = (progress?.rows ?? []).map((r) => {
    const share = (r.current - r.baseline) / (r.target - r.baseline)
    const met = r.current >= r.target
    return { ...r, met, behind: !met && share < (progress?.elapsed_share ?? 0) }
  })
  const met = targets.filter((r) => r.met).length
  const behind = targets.filter((r) => r.behind)

  const sources = Object.entries(live?.sources ?? {}).filter((e): e is [string, SourceInfo] => Boolean(e[1]))
  const fmt = (v: number | null) => (v === null ? '–' : Math.round(v).toLocaleString('en-US'))

  if (data.live.isLoading || data.realLoading) return <Loading what={t('Loading summary…', '概要を読み込み中…')} />

  return (
    <div className="page summary">
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Executive summary', 'エグゼクティブサマリー')}</div>
          <h1 className="page-title">{t('Fukui tourism at a glance', '福井観光の概況')}</h1>
          <p className="page-sub">
            {shared
              ? t(`Real data up to ${fmtDate(shared, lang)}. Forecasts from the FTAS model.`, `${fmtDate(shared, lang)}までの実データ。予測はFTASモデル。`)
              : t('Demo data: numbers are illustrative.', 'デモデータ：数値は例示です。')}
          </p>
        </div>
        <nav className="sum-jump" aria-label={t('Open a view', 'ビューを開く')}>
          <a className="btn btn-accent" href="#/map">
            <Icon name="map" /> {t('Map', '地図')}
          </a>
          <a className="btn" href="#/nodes">
            <Icon name="nodes" /> {t('Nodes', 'ノード')}
          </a>
          <a className="btn" href="#/strategy">
            <Icon name="strategy" /> {t('Strategy', '戦略')}
          </a>
        </nav>
      </div>

      <div className="card-grid">
        <section className="s-card sum-visitors" style={{ ['--span' as string]: 7 }}>
          <div className="sum-card-head">
            <h2 className="card-title">{t('Visitors and forecast', '来訪者数と予測')}</h2>
            <SourceBadge info={{ status: 'mixed', as_of: shared, real: [] }} note={ESTIMATE_NOTE} />
          </div>
          <p className="card-sub">
            {t("Estimated visitors on the latest day with data, and the FTAS model's forecast for the next day with its likely range. Six sites.", '直近のデータ日の推計来訪者数と、翌日のFTASモデル予測（予測範囲付き）。6地点。')}
          </p>
          <div className="sum-table-wrap">
            <table className="sum-table num">
              <thead>
                <tr>
                  <th>{t('Site', '地点')}</th>
                  <th>{t('Latest day (est.)', '直近日（推計）')} {live && dayLabel(live, lastDay, lang, true)}</th>
                  <th>{t('Forecast', '予測')} {live && dayLabel(live, nextDay, lang, true)}</th>
                  <th>{t('Likely range', '予測範囲')}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{t(s.name, s.name_ja)}</th>
                    {s.noEstimate ? (
                      <td colSpan={3} className="sum-muted" title={t('No official visitor count to scale the camera signal to.', 'カメラ信号を換算する公式来訪者数がありません。')}>
                        {t('No official count yet', '公式値なし')}
                      </td>
                    ) : (
                      <>
                        <td>{fmt(s.measured)}</td>
                        {s.hasModel ? (
                          <>
                            <td>{fmt(s.forecast)}</td>
                            <td className="sum-muted">{s.lo !== null && s.hi !== null ? `${fmt(s.lo)}–${fmt(s.hi)}` : '–'}</td>
                          </>
                        ) : (
                          <td colSpan={2} className="sum-muted">
                            {t('No model forecast yet', 'モデル予測なし')}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {wapes.length > 0 && (
            <p className="card-sub">
              {t(
                `In tests over past weeks the model was typically off by ${Math.round(Math.min(...wapes) * 100)}–${Math.round(Math.max(...wapes) * 100)}% a day, depending on the site.`,
                `過去数週間のテストでは、予測の誤差は地点により1日あたり約${Math.round(Math.min(...wapes) * 100)}〜${Math.round(Math.max(...wapes) * 100)}%でした。`,
              )}
            </p>
          )}
        </section>

        <section className="s-card sum-targets" style={{ ['--span' as string]: 5 }}>
          <h2 className="card-title">{t('2029 Vision targets', '2029年ビジョン目標')}</h2>
          {progress ? (
            <>
              <p className="sum-big">
                <strong className="num">
                  {met} / {targets.length}
                </strong>{' '}
                {t('targets already met', '目標を達成済み')}
              </p>
              {behind.length > 0 && (
                <p className="sum-warn">
                  <Icon name="alert" size={14} /> {t(`Behind: ${behind.map((r) => r.label.toLowerCase()).join(', ')}.`, `遅れ：${behind.map((r) => TARGET_JA[r.label] ?? r.label).join('、')}。`)}
                </p>
              )}
              <ul className="sum-list">
                {targets.map((r) => (
                  <li key={r.label}>
                    <span className={`sum-dot ${r.met ? 'met' : r.behind ? 'behind' : 'pace'}`} aria-hidden="true"></span>
                    <span className="sum-label">{t(r.label, TARGET_JA[r.label] ?? r.label)}</span>
                    <span className="num sum-val">
                      {fmtUnit(r.current, r.prefix, r.unit)} / {fmtUnit(r.target, r.prefix, r.unit)}
                    </span>
                    <span className="sum-state">{r.met ? t('Met', '達成') : r.behind ? t('Behind', '遅れ') : t('On pace', '順調')}</span>
                  </li>
                ))}
              </ul>
              <p className="card-sub">{t(`${progress.rows[0]?.current_year ?? '2025'} figures against the Next Fukui Tourism Vision (Mar 2025).`, `${progress.rows[0]?.current_year ?? '2025'}年の実績をネクストふくい観光ビジョン（2025年3月）の目標と比較。`)}</p>
            </>
          ) : (
            <p className="card-sub">{t('Strategy data not loaded.', '戦略データが読み込まれていません。')}</p>
          )}
        </section>

        <section className="s-card sum-actions" style={{ ['--span' as string]: 7 }}>
          <h2 className="card-title">{t('Top 3 actions this week', '今週の優先アクション（上位3件）')}</h2>
          {actions.length === 0 ? (
            <p className="card-sub">{t('No action nudges this week.', '今週の推奨アクションはありません。')}</p>
          ) : (
            <ol className="sum-actions-list">
              {actions.map((n) => {
                const pr = PRIORITY[priorityOf(n.sev)]
                return (
                  <li key={n.id}>
                    <span className="sum-pr" title={t(pr.hint_en, pr.hint_ja)}>
                      <i style={{ background: pr.colour }} aria-hidden="true"></i>
                      {t(pr.en, pr.ja)}
                    </span>
                    <strong className="sum-act-title">{t(n.title_en, n.title_ja)}</strong>
                    <span className="sum-act-do">{t(n.action_en, n.action_ja)}</span>
                  </li>
                )
              })}
            </ol>
          )}
          <a className="btn btn-ghost sum-more" href="#/map">
            {t('See all action nudges on the map', '地図ですべての推奨アクションを見る')} <Icon name="chevron" size={12} />
          </a>
        </section>

        <section className="s-card sum-fresh" style={{ ['--span' as string]: 5 }}>
          <h2 className="card-title">{t('Data freshness', 'データの鮮度')}</h2>
          <ul className="sum-list">
            {sources.map(([id, info]) => {
              const layer = LAYERS.find((l) => l.id === id)
              return (
                <li key={id}>
                  <span className="sum-label">{layer ? t(layer.en, layer.ja) : id}</span>
                  <SourceBadge info={info} />
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
