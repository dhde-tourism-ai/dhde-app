import type { DashboardData, NodeKey } from '../../types/dashboard'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useLang } from '../../lib/i18n'
import { Icon } from '../../components/icons'

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function fmtShortDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return String(dateStr ?? '')
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const BADGE: Record<string, { en: string; ja: string; tone: 'good' | 'warn' | 'serious' | 'crit' }> = {
  HOT: { en: 'Superb', ja: '絶好調', tone: 'good' },
  OK: { en: 'Strong', ja: '好調', tone: 'good' },
  WARN: { en: 'Warning', ja: '注意', tone: 'warn' },
  CRIT: { en: 'Critical', ja: '要警戒', tone: 'crit' },
}

function accuracyBadge(pct: number): 'OK' | 'WARN' | 'CRIT' {
  if (pct <= 20) return 'OK'
  if (pct <= 45) return 'WARN'
  return 'CRIT'
}

function Badge({ code, text }: { code: string; text?: string }) {
  const { t } = useLang()
  const b = BADGE[code] ?? { en: code, ja: code, tone: 'warn' as const }
  return (
    <span className={`tone-badge tone-${b.tone}`}>
      <span className="sw" aria-hidden="true"></span>
      {text ?? t(b.en, b.ja)}
    </span>
  )
}

const S1 = '#3987e5'
const S2 = '#d95926'
const AXIS = { fill: '#7f8ba3', fontSize: 10.5, fontFamily: 'IBM Plex Mono' }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12, color: '#e9eef8' }

/**
 * Dina's node dashboard (FTAS executive dashboard). The data logic is unchanged:
 * per-node summary, 14-day weather strip, actual vs model forecast, estimated
 * outlook, day-by-day pacing and nudges. Only the presentation moved to the
 * DHDE design system.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function NodeDashboard({ data, selectedNode }: { data: DashboardData; selectedNode: NodeKey | 'all' }) {
  const { t } = useLang()
  const nodes = data.nodes || {}
  const activeNodeKey = selectedNode !== 'all' ? (selectedNode as NodeKey) : undefined
  const activeNodeData = activeNodeKey ? nodes[activeNodeKey] : undefined

  // Fallback to Tojinbo or first node in the overview, as in the original dashboard.
  const defaultNode = nodes['tojinbo' as NodeKey] || Object.values(nodes)[0]
  const summary = activeNodeData?.summary || (data as any).summary || defaultNode?.summary || {}
  const p30 = summary.past_30_day || {}
  const week = summary.this_week_pacing || {}
  const modelAccuracy = summary.model_accuracy
  const weatherStrip = activeNodeData?.weather_strip || (data as any).weather_strip || defaultNode?.weather_strip || []
  const demandForecast = activeNodeData?.demand_forecast || (data as any).demand_forecast || defaultNode?.demand_forecast || []
  const estimatedOutlook = activeNodeData?.estimated_outlook || (data as any).estimated_outlook || defaultNode?.estimated_outlook || []
  const pacingRows = activeNodeData?.weekly_pacing || (data as any).weekly_pacing || defaultNode?.weekly_pacing || []
  const nudges = activeNodeData?.nudges || (data as any).nudges || defaultNode?.nudges || []

  const yoy = p30.yoy_pct
  const yoyUp = yoy !== null && yoy !== undefined && yoy >= 0
  const yoyText = yoy === null || yoy === undefined ? '—' : (yoyUp ? '+' : '') + yoy + '%'

  return (
    <div className="nd">
      {/* Executive summary */}
      <section className="nd-section">
        <div className="nd-head">
          <h2 className="nd-title">
            {activeNodeData ? `${activeNodeData.label}` : t('All nodes overview', '全ノード概要')}
            <span className="nd-title-sub">{t('Executive summary', '概要')}</span>
          </h2>
          {activeNodeData && <p className="nd-desc">{activeNodeData.description}</p>}
        </div>

        {selectedNode === 'all' && data.aggregate && (
          <div className="tile-grid two">
            <div className="tile tile-lead">
              <div className="tile-label">{t('Annual opportunity gap (¥)', '年間の機会損失（円）')}</div>
              <div className="tile-value">¥{fmtNum(data.aggregate.opportunity_gap_yen)}</div>
              <div className="tile-foot">{t('Weather-induced demand deficit', '天候による需要不足')}</div>
            </div>
            <div className="tile">
              <div className="tile-label">{t('Opportunity gap (visitors)', '機会損失（来訪者数）')}</div>
              <div className="tile-value">{fmtNum(data.aggregate.opportunity_gap_visitors)}</div>
              <div className="tile-foot">{t('Annual deficit across active nodes', '稼働ノード合計の年間不足')}</div>
            </div>
          </div>
        )}

        <div className="tile-grid">
          <div className="tile">
            <div className="tile-label">{t('Past 30 days', '過去30日')}</div>
            <div className="tile-value">{fmtNum(p30.current_total)}</div>
            <div className={`tile-delta ${yoyUp ? 'up' : 'down'}`}>
              {yoyUp ? '▲' : '▼'} {yoyText} {t('YoY', '前年比')}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">{t('Same period last year', '前年同期')}</div>
            <div className="tile-value">{fmtNum(p30.previous_year_total)}</div>
            <div className="tile-foot">{t('Baseline', '基準')}</div>
          </div>
          <div className="tile">
            <div className="tile-label">{t('Net difference', '差分')}</div>
            <div className="tile-value">
              {p30.diff !== undefined && p30.diff >= 0 ? '+' : ''}
              {fmtNum(p30.diff)}
            </div>
            <div className="tile-foot">{t('Visitors vs last year', '前年比の来訪者数')}</div>
          </div>
          <div className="tile">
            <div className="tile-label">{t('This week pacing', '今週の達成率')}</div>
            <div className="tile-value">{week.rate !== undefined ? (week.rate * 100).toFixed(0) + '%' : '—'}</div>
            <div className="tile-foot">{week.badge && <Badge code={week.badge} />}</div>
          </div>
        </div>
      </section>

      {/* Weather strip */}
      <section className="nd-section">
        <div className="nd-head row">
          <h3 className="card-title">{t('14-day weather and pacing strip', '14日間の天気と達成率')}</h3>
          <span className="card-sub">{t('Rain risk ≥ 40% outlined', '降水確率40%以上を強調')}</span>
        </div>
        <div className="wx-strip" role="list">
          {weatherStrip.length === 0 ? (
            <p className="muted">{t('Weather forecast unavailable.', '天気予報を取得できません。')}</p>
          ) : (
            weatherStrip.map((d: any, i: number) => (
              <div key={i} role="listitem" className={`wx-day ${d.rain_risk ? 'risk' : ''}`}>
                <div className="wx-date">{fmtShortDate(d.date)}</div>
                <div className="wx-desc" lang="ja">
                  {d.weather || '—'}
                </div>
                <div className="wx-pop num">
                  {d.rain_risk && <Icon name="umbrella" size={12} />}
                  {d.precipitation_pct !== null && d.precipitation_pct !== undefined ? `${d.precipitation_pct}%` : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Actual vs forecast */}
      <section className="nd-section card">
        <div className="nd-head row">
          <div>
            <h3 className="card-title">{t('Actual vs model forecast', '実績とモデル予測')}</h3>
            <p className="card-sub">
              {t('Last 60 days · Random Forest', '直近60日・ランダムフォレスト')} {selectedNode === ('fukui_station' as NodeKey) ? t('(with hotel reservation lags)', '（ホテル予約ラグ込み）') : ''}
            </p>
          </div>
          {modelAccuracy && modelAccuracy.mae_pct_of_mean !== null && (
            <span title={t('Mean absolute error from walk-forward backtesting (expanding-window refits), as a % of the average daily count: out-of-sample accuracy, not an in-sample fit.', 'ウォークフォワード検証の平均絶対誤差（日平均に対する%）。')}>
              <Badge code={accuracyBadge(modelAccuracy.mae_pct_of_mean)} text={`${t('Model accuracy', 'モデル精度')} ±${modelAccuracy.mae_pct_of_mean.toFixed(0)}% MAE`} />
            </span>
          )}
        </div>
        <div className="chart-key">
          <span>
            <i className="k-band" style={{ background: 'rgba(57,135,229,.35)' }}></i>
            {t('Actual visitors', '実績来訪者数')}
          </span>
          <span>
            <i className="k-line dash" style={{ borderColor: S2 }}></i>
            {t('Model forecast', 'モデル予測')}
          </span>
        </div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandForecast} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ndActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={S1} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={S1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickFormatter={fmtShortDate} tickLine={false} axisLine={{ stroke: '#34425e' }} minTickGap={24} />
              <YAxis tick={AXIS} tickFormatter={(val: number) => Number(val).toLocaleString('en-US')} tickLine={false} axisLine={false} width={56} />
              <Tooltip contentStyle={TIP} formatter={(val: unknown, name: unknown) => [Number(val).toLocaleString('en-US'), String(name)]} labelFormatter={fmtShortDate} />
              <Area type="monotone" dataKey="actual" name={t('Actual visitors', '実績来訪者数')} stroke={S1} strokeWidth={2} fill="url(#ndActual)" isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" name={t('Model forecast', 'モデル予測')} stroke={S2} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Estimated outlook */}
      {estimatedOutlook.length > 0 && (
        <section className="nd-section">
          <div className="nd-head row">
            <h3 className="card-title">{t('Near-term outlook (estimated)', '直近の見通し（推定）')}</h3>
            <span className="card-sub">{t('Based on the live weather forecast', '最新の天気予報に基づく')}</span>
          </div>
          <div className="banner banner-warn">
            <Icon name="alert" />
            <span>
              {t(
                'Local weather history is catching up, so these days are an approximate estimate from the live forecast and recent averages, not a full model prediction. Treat as directional only.',
                '気象履歴の更新待ちのため、最新予報と直近平均からの概算です。方向性の参考としてご覧ください。',
              )}
            </span>
          </div>
          <div className="outlook-row">
            {estimatedOutlook.map((d: any, i: number) => (
              <div key={i} className="outlook-day">
                <div className="wx-date">{fmtShortDate(d.date)}</div>
                <div className="wx-desc" lang="ja">
                  {d.weather || '—'}
                </div>
                <div className="outlook-value">{fmtNum(d.estimated_demand)}</div>
                <span className="asof-flag est">{t('Estimated', '推定')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="nd-two">
        {/* Pacing table */}
        <section className="nd-section card">
          <div className="nd-head row">
            <h3 className="card-title">{t('Day-by-day pacing', '日別の達成率')}</h3>
            <span className="card-sub">{t('Rate = actual ÷ forecast', '達成率＝実績÷予測')}</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Date', '日付')}</th>
                  <th className="num">{t('Actual', '実績')}</th>
                  <th className="num">{t('Forecast', '予測')}</th>
                  <th className="num">{t('Rate', '達成率')}</th>
                  <th>{t('Status', '状態')}</th>
                </tr>
              </thead>
              <tbody>
                {pacingRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      {t('No pacing data available.', '達成率データがありません。')}
                    </td>
                  </tr>
                ) : (
                  pacingRows
                    .slice()
                    .reverse()
                    .map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="mono">{r.date}</td>
                        <td className="num">{fmtNum(r.actual)}</td>
                        <td className="num">{fmtNum(r.forecast)}</td>
                        <td className="num">{r.rate !== undefined ? `${(r.rate * 100).toFixed(0)}%` : '—'}</td>
                        <td>{r.badge && <Badge code={r.badge} />}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Nudges */}
        <section className="nd-section card">
          <div className="nd-head row">
            <h3 className="card-title">{t('Action nudges for government and vendors', '行政・事業者向け推奨アクション')}</h3>
          </div>
          {nudges.length === 0 ? (
            <p className="muted">{t('No active recommendations: pacing and weather are within normal range.', '推奨事項はありません。')}</p>
          ) : (
            <ul className="nudges">
              {nudges.map((n: any, i: number) => (
                <li key={i} className={`nudge ${n.type}`}>
                  <div className="nudge-type">
                    <Icon name={n.type === 'weather' ? 'weather' : 'people'} size={13} />
                    {n.type === 'weather' ? t('Weather risk', '天候リスク') : t('Demand signal', '需要シグナル')} · <span className="mono">{n.date}</span>
                  </div>
                  <div>{n.message}</div>
                </li>
              ))}
            </ul>
          )}
          <button className="btn nd-export" onClick={() => window.print()}>
            {t('Export PDF summary', 'PDFで出力')}
          </button>
        </section>
      </div>
    </div>
  )
}
