import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

/**
 * Running total this year against the year's steady-growth target, every series on one
 * chart as % of its target to date (100% = on target). All guest-nights and foreign ones
 * differ ~24x in size, so in raw numbers the smaller would sit flat at the bottom.
 */
export function TargetPace({ card }: { card: TargetPaceCard }) {
  const { t, lang } = useLang()
  const file = useMonthly()
  if (file.isLoading) return <p className="muted small">{t('Loading…', '読み込み中…')}</p>
  const names = lang === 'ja' ? MONTHS_JA : MONTHS_EN

  const series = card.items.flatMap((it, k) => {
    const s = file.data?.series.find((x) => x.id === it.series)
    if (!s) return []
    const year = s.data_through.slice(0, 4)
    const prevTotal = measuredYear(s, String(Number(year) - 1))
    if (prevTotal === null) return []
    const target = pathTarget(it.baseline, it.baseline_year, it.target, it.target_year, Number(year))
    const prevMonths = monthsOf(s, String(Number(year) - 1))
    const now = monthsOf(s, year)
    let cumT = 0
    let cumA = 0
    const pct: (number | null)[] = []
    const cum: { actual: number; target: number }[] = []
    names.forEach((_, i) => {
      cumT += (target * (prevMonths[i] ?? 0)) / prevTotal
      const a = now[i]
      if (a !== null) cumA += a
      pct.push(a !== null && cumT > 0 ? Math.round((cumA / cumT) * 1000) / 10 : null)
      cum.push({ actual: cumA, target: Math.round(cumT) })
    })
    const last = pct.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1)
    return [{ key: `s${k}`, it, year, target, pct, cum, last, colour: S[k % S.length] }]
  })
  if (series.length === 0) return <p className="muted small">{t('Guest-night data is not published yet.', '宿泊データはまだ公開されていません。')}</p>

  const rows = names.map((m, i) => Object.fromEntries([['m', m], ...series.map((x) => [x.key, x.pct[i]])]))
  const values = series.flatMap((x) => x.pct.filter((v): v is number => v !== null))
  const lo = Math.max(0, Math.floor((Math.min(100, ...values) - 10) / 10) * 10)
  const hi = Math.ceil((Math.max(100, ...values) + 5) / 10) * 10

  return (
    <div className="gn-pace-one">
      <div className="chart-key">
        {series.map((x) => (
          <span key={x.key}>
            <i className="k-line" style={{ borderColor: x.colour }}></i>
            {t(x.it.label, x.it.label_ja ?? x.it.label)}
          </span>
        ))}
        <span>
          <i className="k-line dash" style={{ borderColor: '#aeb9cd' }}></i>
          {t('Target (100%)', '目標（100%）')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2a3f" vertical={false} />
          <XAxis dataKey="m" tick={{ ...AXIS, fontSize: 9.5 }} tickLine={false} axisLine={{ stroke: '#34425e' }} interval="preserveStartEnd" />
          <YAxis tick={AXIS} domain={[lo, hi]} tickFormatter={(v: number) => `${v}%`} width={44} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TIP} itemStyle={TIP_ITEM} labelStyle={TIP_LABEL} formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}% ${t('of target to date', '（目標比・累計）')}`, String(name)]} />
          <ReferenceLine y={100} stroke="#aeb9cd" strokeDasharray="5 4" strokeWidth={1.5} />
          {series.map((x) => (
            <Line
              key={x.key}
              dataKey={x.key}
              name={t(x.it.label, x.it.label_ja ?? x.it.label)}
              stroke={x.colour}
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive={false}
              // A dot on the latest month, so it doesn't read as the next month's tick.
              dot={(p: { cx?: number; cy?: number; index?: number }) => (p.index === x.last && p.cx !== undefined && p.cy !== undefined ? <circle key="end" cx={p.cx} cy={p.cy} r={4.5} fill={x.colour} stroke="#121c2f" strokeWidth={2} /> : <g key={`d${p.index}`} />)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {series.map(
        (x) =>
          x.last >= 0 && (
            <p key={x.key} className="gn-pace-note num">
              <i className="k-band" style={{ background: x.colour }}></i> <strong>{fmtFig(x.cum[x.last].actual)}</strong> {t('nights', '泊')} ·{' '}
              <span className={x.pct[x.last]! < 90 ? 'sum-down' : ''}>
                {t(`${Math.round(x.pct[x.last]!)}% of the ${fmtFig(x.cum[x.last].target)} target to ${MONTHS_EN[x.last]}`, `${x.last + 1}月までの目標${fmtFig(x.cum[x.last].target)}の${Math.round(x.pct[x.last]!)}%`)}
              </span>
              <span className="muted small">
                {' '}
                · {t(`${x.year} target ${fmtFig(x.target)}`, `${x.year}年目標${fmtFig(x.target)}`)}
              </span>
            </p>
          ),
      )}
      {series[0].last >= 0 && <p className="muted small">{t(`${MONTHS_EN[series[0].last]} ${series[0].year} is the latest month JTA has published.`, `観光庁の最新公表月は${series[0].year}年${series[0].last + 1}月。`)}</p>}
    </div>
  )
}
