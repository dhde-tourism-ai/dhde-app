import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GuestNightsMonthsCard, TargetPaceCard } from '../../types/strategy'
import type { MonthlyForecastFile } from '../../types/monthly'
import { useJsonResource } from '../../hooks/useJsonResource'
import { measuredYear, monthsOf, pathTarget } from '../../lib/monthly'
import { fmtCompact } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import { AXIS, S, TIP, TIP_ITEM, TIP_LABEL } from './chartTheme'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_JA = MONTHS_EN.map((_, i) => `${i + 1}月`)
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
/** 1.62M, 161.2k: two or one decimals, for figures quoted in text. */
const fmtFig = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : Math.round(v).toLocaleString('en-US'))
const signed = (v: number) => `${v >= 0 ? '+' : ''}${(Math.round(v * 10) / 10).toFixed(1)}%`

function useMonthly() {
  return useJsonResource<MonthlyForecastFile>('monthly_forecast.json')
}

/** Guest-nights by month, domestic vs foreign, last year (faded) vs this year (solid), with the foreign share on top. */
export function GuestNightsMonths({ card }: { card: GuestNightsMonthsCard }) {
  const { t, lang } = useLang()
  const file = useMonthly()
  if (file.isLoading) return <p className="muted small">{t('Loading…', '読み込み中…')}</p>
  const find = (id: string) => file.data?.series.find((s) => s.id === id)
  const total = find(card.total)
  const dom = find(card.domestic)
  const fgn = find(card.foreign)
  if (!total || !dom || !fgn) return <p className="muted small">{t('Guest-night data is not published yet.', '宿泊データはまだ公開されていません。')}</p>

  const year = fgn.data_through.slice(0, 4)
  const prev = String(Number(year) - 1)
  const [t1, t0, d1, d0, f1, f0] = [monthsOf(total, year), monthsOf(total, prev), monthsOf(dom, year), monthsOf(dom, prev), monthsOf(fgn, year), monthsOf(fgn, prev)]
  const share = (f: number | null, tot: number | null) => (f !== null && tot ? Math.round((f / tot) * 1000) / 10 : null)
  const names = lang === 'ja' ? MONTHS_JA : MONTHS_EN
  const rows = names.map((m, i) => {
    const s1 = share(f1[i], t1[i])
    return { m, d0: d0[i], f0: f0[i], d1: d1[i], f1: f1[i], lab1: s1, lab0: s1 === null ? share(f0[i], t0[i]) : null }
  })

  // Months of this year with every series published, from January on.
  let n = 0
  while (n < 12 && t1[n] !== null && d1[n] !== null && f1[n] !== null) n++
  const cut = <T,>(xs: T[]) => xs.slice(0, n)
  const shareNow = n ? (sum(cut(f1)) / sum(cut(t1))) * 100 : null
  const shareBefore = n ? (sum(cut(f0)) / sum(cut(t0))) * 100 : null
  const domChange = n ? (sum(cut(d1)) / sum(cut(d0)) - 1) * 100 : null
  const fgnChange = n ? (sum(cut(f1)) / sum(cut(f0)) - 1) * 100 : null
  const span = n ? t(`Jan–${MONTHS_EN[n - 1]} ${year}`, `${year}年1〜${n}月`) : ''
  const label = (v: unknown) => (v === null || v === undefined ? '' : `${Number(v).toFixed(1)}%`)

  return (
    <div>
      <div className="chart-key">
        <span>
          <i className="k-band" style={{ background: S[0] }}></i>
          {t('Domestic', '国内')}
        </span>
        <span>
          <i className="k-band" style={{ background: S[1] }}></i>
          {t('Foreign', '外国人')}
        </span>
        <span className="muted">{t(`Faded bar = ${prev} · solid bar = ${year} · % = foreign share (${year} where published)`, `薄い棒＝${prev}年・濃い棒＝${year}年・％＝外国人の割合（${year}年は公表月）`)}</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#1f2a3f" vertical={false} />
          <XAxis dataKey="m" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} />
          <YAxis tick={AXIS} tickFormatter={(v: number) => fmtCompact(v)} width={48} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TIP} itemStyle={TIP_ITEM} labelStyle={TIP_LABEL} cursor={{ fill: 'rgba(139,157,255,.08)' }} formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString('en-US'), String(name)]} />
          <Bar dataKey="d0" name={t(`Domestic ${prev}`, `国内 ${prev}`)} stackId="prev" fill={S[0]} fillOpacity={0.35} isAnimationActive={false} />
          <Bar dataKey="f0" name={t(`Foreign ${prev}`, `外国人 ${prev}`)} stackId="prev" fill={S[1]} fillOpacity={0.35} isAnimationActive={false}>
            <LabelList dataKey="lab0" position="top" fill="#aeb9cd" fontSize={10} formatter={label} />
          </Bar>
          <Bar dataKey="d1" name={t(`Domestic ${year}`, `国内 ${year}`)} stackId="now" fill={S[0]} isAnimationActive={false} />
          <Bar dataKey="f1" name={t(`Foreign ${year}`, `外国人 ${year}`)} stackId="now" fill={S[1]} isAnimationActive={false}>
            <LabelList dataKey="lab1" position="top" fill="#e9eef8" fontSize={10.5} formatter={label} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {n > 0 && shareNow !== null && shareBefore !== null && domChange !== null && fgnChange !== null && (
        <div className="gn-tiles">
          <div className="gn-tile">
            <div className="gn-val num">{shareNow.toFixed(1)}%</div>
            <div className="muted small">{t(`foreign share of guest-nights, ${span} (${shareBefore.toFixed(1)}% a year earlier)`, `延べ宿泊者数に占める外国人の割合、${span}（前年同期${shareBefore.toFixed(1)}%）`)}</div>
          </div>
          <div className="gn-tile">
            <div className={`gn-val num ${domChange < 0 ? 'sum-down' : 'sum-up'}`}>{signed(domChange)}</div>
            <div className="muted small">{t(`domestic guest-nights, ${span}, vs the same months of ${prev}`, `国内の延べ宿泊者数、${span}、前年同期比`)}</div>
          </div>
          <div className="gn-tile">
            <div className={`gn-val num ${fgnChange < 0 ? 'sum-down' : 'sum-up'}`}>{signed(fgnChange)}</div>
            <div className="muted small">{t(`foreign guest-nights, ${span}, vs the same months of ${prev}`, `外国人の延べ宿泊者数、${span}、前年同期比`)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Running total this year against the year's steady-growth target, one chart per series. */
export function TargetPace({ card }: { card: TargetPaceCard }) {
  const { t, lang } = useLang()
  const file = useMonthly()
  if (file.isLoading) return <p className="muted small">{t('Loading…', '読み込み中…')}</p>
  const names = lang === 'ja' ? MONTHS_JA : MONTHS_EN

  return (
    <div className="gn-pace">
      {card.items.map((it) => {
        const s = file.data?.series.find((x) => x.id === it.series)
        if (!s) return null
        const year = s.data_through.slice(0, 4)
        const prev = String(Number(year) - 1)
        const prevTotal = measuredYear(s, prev)
        if (prevTotal === null) return null
        const target = pathTarget(it.baseline, it.baseline_year, it.target, it.target_year, Number(year))
        const prevMonths = monthsOf(s, prev)
        const now = monthsOf(s, year)
        let cumT = 0
        let cumA = 0
        const rows = names.map((m, i) => {
          cumT += (target * (prevMonths[i] ?? 0)) / prevTotal
          const a = now[i]
          if (a !== null) cumA += a
          return { m, target: Math.round(cumT), actual: a !== null ? cumA : null }
        })
        const last = rows.reduce((k, r, i) => (r.actual !== null ? i : k), -1)
        const pct = last >= 0 ? (rows[last].actual! / rows[last].target) * 100 : null
        const behind = pct !== null && pct < 90
        return (
          <div key={it.series} className="gn-pace-item">
            <h4 className="mini-h">
              {t(it.label, it.label_ja ?? it.label)} · {t(`${year} target`, `${year}年目標`)} <span className="num">{fmtFig(target)}</span>
            </h4>
            <div className="chart-key">
              <span>
                <i className="k-line" style={{ borderColor: S[0] }}></i>
                {t('Actual, running total', '実績（累計）')}
              </span>
              <span>
                <i className="k-line dash" style={{ borderColor: '#aeb9cd' }}></i>
                {t('Target, running total', '目標（累計）')}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1f2a3f" vertical={false} />
                <XAxis dataKey="m" tick={{ ...AXIS, fontSize: 9.5 }} tickLine={false} axisLine={{ stroke: '#34425e' }} interval={0} />
                <YAxis tick={AXIS} tickFormatter={(v: number) => fmtCompact(v)} width={48} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TIP} itemStyle={TIP_ITEM} labelStyle={TIP_LABEL} formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString('en-US'), String(name)]} />
                <Line dataKey="target" name={t('Target', '目標')} stroke="#aeb9cd" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line
                  dataKey="actual"
                  name={t('Actual', '実績')}
                  stroke={S[0]}
                  strokeWidth={2.5}
                  connectNulls={false}
                  isAnimationActive={false}
                  // A dot on the latest actual month, so it doesn't read as the next month's tick.
                  dot={(p: { cx?: number; cy?: number; index?: number }) => (p.index === last && p.cx !== undefined && p.cy !== undefined ? <circle key="end" cx={p.cx} cy={p.cy} r={4.5} fill={S[0]} stroke="#121c2f" strokeWidth={2} /> : <g key={`d${p.index}`} />)}
                />
              </LineChart>
            </ResponsiveContainer>
            {pct !== null && (
              <p className="gn-pace-note num">
                <strong>{fmtFig(rows[last].actual!)}</strong> {t('nights', '泊')} ·{' '}
                <span className={behind ? 'sum-down' : ''}>
                  {t(`${Math.round(pct)}% of the ${fmtFig(rows[last].target)} target to ${MONTHS_EN[last]}`, `${last + 1}月までの目標${fmtFig(rows[last].target)}の${Math.round(pct)}%`)}
                </span>
                <span className="muted small">
                  {' '}
                  · {t(`${MONTHS_EN[last]} ${year} is the latest month JTA has published`, `観光庁の最新公表月は${year}年${last + 1}月`)}
                </span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
