import { useState } from 'react'
import type { ModeCount, ModeId, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'

/**
 * Series colours: the app's validated categorical slots (tokens.css --s1..--s4,
 * dataviz reference dark steps; passes all checks on --surface). "Other" is a
 * recessive neutral, not a fifth hue.
 */
const MODES: { id: ModeId; colour: string; en: string; ja: string }[] = [
  { id: 'own_car', colour: 'var(--s3)', en: 'Own car', ja: '自家用車' },
  { id: 'rental_car', colour: 'var(--s4)', en: 'Rental car', ja: 'レンタカー' },
  { id: 'bus', colour: 'var(--s2)', en: 'Bus', ja: 'バス' },
  { id: 'train', colour: 'var(--s1)', en: 'Train', ja: '鉄道' },
  { id: 'other', colour: '#4a5770', en: 'Other', ja: 'その他' },
]
const KPI: ModeId[] = ['own_car', 'rental_car', 'bus', 'train']
type Period = 'last_30_days' | 'year_2025'
type Hover = { site: string; mode: ModeId; left: number } | null

const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`)

/**
 * Top of the Transport view: estimated visitors by own car, rental car, bus
 * and train (transport_modes.json). Modelled: each site's visitor estimate x
 * its mode share from the Fukui Prefecture tourism survey.
 */
export function ModeShare({ data, name }: { data: TransportModesFile; name: (id: string) => string }) {
  const { t, lang } = useLang()
  const [period, setPeriod] = useState<Period>('last_30_days')
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [hover, setHover] = useState<Hover>(null)
  const tot = data.totals[period]
  const loc = lang === 'ja' ? 'ja-JP' : 'en-US'
  const short = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 2)}M` : v >= 10_000 ? `${Math.round(v / 1000)}k` : v.toLocaleString(loc)
  const full = (v: number) => v.toLocaleString(loc)
  const label = (m: ModeId) => {
    const s = MODES.find((x) => x.id === m)!
    return t(s.en, s.ja)
  }
  const top = KPI.reduce((a, m) => ((tot.by_mode[m].share ?? 0) > (tot.by_mode[a].share ?? 0) ? m : a), KPI[0])
  const inTen = Math.round((tot.by_mode[top].share ?? 0) * 10)
  const sites = Object.entries(data.nodes)
  const counted = sites.filter(([, n]) => (period === 'last_30_days' ? n.by_mode_30d : n.by_mode_year)).length
  const answers = sites.reduce((a, [, n]) => a + n.responses, 0)
  const when =
    period === 'last_30_days' && tot.period
      ? new Date(`${tot.period[1]}T00:00:00`).toLocaleDateString(loc, { year: 'numeric', month: 'long' })
      : t('2025', '2025年')
  const siteCounts = (id: string): Record<ModeId, ModeCount> | null =>
    period === 'last_30_days' ? data.nodes[id].by_mode_30d : data.nodes[id].by_mode_year
  const siteTotal = (id: string) => (period === 'last_30_days' ? data.nodes[id].visitors_30d : data.nodes[id].official_annual_2025)

  return (
    <section className="s-card ms">
      <header className="ms-head">
        <div>
          <div className="eyebrow">{t('Visitors by mode', '交通手段別の来訪者')}</div>
          <h2 className="ms-title">
            {t(`${inTen} in 10 visitors arrive by ${label(top).toLowerCase()}`, `来訪者の10人に${inTen}人が${label(top)}で来訪`)}
          </h2>
          <p className="ms-sub">
            {t(`${when} · ${short(tot.visitors)} visitors at ${counted} sites`, `${when}・${counted}地点で${short(tot.visitors)}人`)}
            <span className="ms-pill">{t('Modelled', '推計')}</span>
          </p>
        </div>
        <div className="ms-seg" role="tablist" aria-label={t('Period', '期間')}>
          <button role="tab" aria-selected={period === 'last_30_days'} onClick={() => setPeriod('last_30_days')}>
            {t('Last 30 days', '直近30日')}
          </button>
          <button role="tab" aria-selected={period === 'year_2025'} onClick={() => setPeriod('year_2025')}>
            {t('2025', '2025年')}
          </button>
        </div>
      </header>

      <div className="ms-kpis">
        {KPI.map((m) => {
          const v = tot.by_mode[m]
          const st = MODES.find((x) => x.id === m)!
          return (
            <div key={m} className="ms-kpi" title={t(`Range ${full(v.lo)} to ${full(v.hi)} (95%)`, `幅 ${full(v.lo)}〜${full(v.hi)}（95%）`)}>
              <div className="ms-kpi-label">
                <i style={{ background: st.colour }} aria-hidden="true"></i>
                {t(st.en, st.ja)}
              </div>
              <div className="ms-kpi-value num">{short(v.visitors)}</div>
              <div className="ms-kpi-share num">{t(`${pct(v.share)} of visitors`, `来訪者の${pct(v.share)}`)}</div>
            </div>
          )
        })}
      </div>

      <div className="ms-by">
        <div className="ms-by-head">
          <h3 className="ms-h3">{t('By site', '地点別')}</h3>
          <div className="ms-legend">
            {MODES.map((m) => (
              <span key={m.id}>
                <i style={{ background: m.colour }}></i>
                {t(m.en, m.ja)}
              </span>
            ))}
          </div>
          <div className="ms-seg ms-seg-sm" role="tablist" aria-label={t('View', '表示')}>
            <button role="tab" aria-selected={view === 'chart'} onClick={() => setView('chart')}>
              {t('Chart', 'グラフ')}
            </button>
            <button role="tab" aria-selected={view === 'table'} onClick={() => setView('table')}>
              {t('Table', '表')}
            </button>
          </div>
        </div>

        {view === 'chart' ? (
          <div className="ms-rows" onMouseLeave={() => setHover(null)}>
            {sites.map(([id, n]) => {
              const c = siteCounts(id)
              const total = siteTotal(id)
              let acc = 0
              const lead = MODES.reduce((a, m) => ((n.shares[m.id]?.share ?? 0) > (n.shares[a.id]?.share ?? 0) ? m : a), MODES[0])
              return (
                <div key={id} className="ms-row">
                  <div className="ms-site">{name(id)}</div>
                  <div className="ms-track">
                    <div className="ms-bar">
                      {MODES.map((m) => {
                        const s = n.shares[m.id]?.share ?? 0
                        const left = acc
                        acc += s
                        if (s <= 0) return null
                        const on = hover?.site === id && hover.mode === m.id
                        return (
                          <span
                            key={m.id}
                            className={on ? 'on' : hover?.site === id ? 'dim' : ''}
                            style={{ flexGrow: s, background: m.colour }}
                            onMouseEnter={() => setHover({ site: id, mode: m.id, left: left + s / 2 })}
                          ></span>
                        )
                      })}
                    </div>
                    {hover?.site === id && (
                      <div className="ms-tip" style={{ left: `${Math.min(88, Math.max(12, hover.left * 100))}%` }} role="status">
                        <strong>{label(hover.mode)}</strong> <span className="num">{pct(n.shares[hover.mode]?.share)}</span>
                        {c && <span className="num"> · {full(c[hover.mode].visitors)}</span>}
                        <span className="ms-tip-sub num">
                          {t('range', '幅')} {pct(n.shares[hover.mode]?.lo)}–{pct(n.shares[hover.mode]?.hi)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ms-lead">
                    <span className="num">{pct(n.shares[lead.id]?.share)}</span> <span className="muted">{t(lead.en, lead.ja).toLowerCase()}</span>
                  </div>
                  <div className="ms-total num">{total != null && c ? short(total) : <span className="muted">—</span>}</div>
                </div>
              )
            })}
            <div className="ms-row ms-axis" aria-hidden="true">
              <span></span>
              <div className="ms-ticks">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
              <span className="ms-lead muted">{t('largest', '最大')}</span>
              <span className="ms-total muted">{t('visitors', '来訪者')}</span>
            </div>
          </div>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th>{t('Site', '地点')}</th>
                  {MODES.map((m) => (
                    <th key={m.id}>{t(m.en, m.ja)}</th>
                  ))}
                  <th>{t('Visitors', '来訪者')}</th>
                  <th>{t('Answers', '回答数')}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map(([id, n]) => {
                  const c = siteCounts(id)
                  const total = siteTotal(id)
                  return (
                    <tr key={id}>
                      <th>{name(id)}</th>
                      {MODES.map((m) => (
                        <td key={m.id} className="num">
                          {pct(n.shares[m.id]?.share)}
                          {c && <span className="muted"> {short(c[m.id].visitors)}</span>}
                        </td>
                      ))}
                      <td className="num">{total != null && c ? short(total) : '—'}</td>
                      <td className="num">{n.responses.toLocaleString(loc)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="ms-about">
        <summary>{t('How this is estimated', '推計の方法')}</summary>
        <p>
          {t(
            `Each site's visitor estimate (its camera, booking or hotel signal scaled to the official 2025 count) is split by how that site's respondents to the Fukui Prefecture tourism survey got around in Fukui: ${answers.toLocaleString(loc)} answers from ${data.survey.from} to ${data.survey.to}. Several answers count equally; walking counts only when it was the only answer. Ranges (hover a number or a bar) are 95% intervals from the number of answers.`,
            `各地点の来訪者推計（カメラ・予約・宿泊の指標を2025年の公式入込数に換算）を、その地点での福井県観光アンケートの「福井県内での交通手段」の回答で分けたもの（${answers.toLocaleString(loc)}件、${data.survey.from}〜${data.survey.to}）。複数回答は均等に配分、徒歩は単独回答のみ計上。幅（数値やバーにカーソル）は回答数に基づく95%区間。`,
          )}
        </p>
        <p>
          {t(
            'Fukui Station has no visitor estimate, so it shows shares only. Awara Onsen counts overnight hotel guests. Respondents choose to take part, so shares can lean towards visitors who use the survey app.',
            '福井駅は来訪者推計がないため割合のみ。あわら温泉は宿泊客数。回答は任意のため、アンケートアプリ利用者に偏る可能性がある。',
          )}{' '}
          <a href={data.survey.url} target="_blank" rel="noreferrer">
            {t('Survey data (CC BY 4.0)', 'アンケートデータ（CC BY 4.0）')}
          </a>
        </p>
      </details>
    </section>
  )
}
