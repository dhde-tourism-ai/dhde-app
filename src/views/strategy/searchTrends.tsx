import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SearchTrendsCard } from '../../types/strategy'
import { useLang } from '../../lib/i18n'
import { AXIS, S, TIP, TIP_ITEM, TIP_LABEL } from './chartTheme'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Discover: Fukui's travel searches against Ishikawa + Kanazawa by where the searcher lives, and the monthly trend in Japan. */
export function SearchTrends({ card }: { card: SearchTrendsCard }) {
  const { t } = useLang()
  const lines = [
    { key: 'fukui', name: t('Fukui', '福井'), colour: S[1], width: 2.5 },
    { key: 'ishikawa', name: t('Ishikawa', '石川'), colour: S[0], width: 1.5 },
    { key: 'kansai', name: t('Kansai', '関西'), colour: '#7f8ba3', width: 1.5 },
  ] as const
  const rows = card.trend.months.map((m, i) => {
    const [y, mm] = m.split('-')
    return {
      m,
      label: t(`${MONTHS_EN[Number(mm) - 1]} ${y.slice(2)}`, `${y.slice(2)}年${Number(mm)}月`),
      fukui: card.trend.fukui[i],
      ishikawa: card.trend.ishikawa[i],
      kansai: card.trend.kansai[i],
    }
  })
  const labelOf = (m: string) => rows.find((r) => r.m === m)?.label ?? m

  return (
    <div>
      <h4 className="mini-h">{t(card.markets_label, card.markets_label_ja ?? card.markets_label)}</h4>
      <div className="gn-tiles">
        {card.markets.map((mk) => {
          const ratio = sum(mk.fukui) / sum(mk.ishikawa)
          return (
            <div key={mk.label} className="gn-tile">
              <div className={`gn-val num ${ratio < 0.9 ? 'sum-down' : ''}`}>{ratio.toFixed(2)}×</div>
              <div className="muted small">{t(mk.label, mk.label_ja ?? mk.label)}</div>
            </div>
          )
        })}
      </div>

      <h4 className="mini-h st-trend-h">{t(card.trend.label, card.trend.label_ja ?? card.trend.label)}</h4>
      <div className="chart-key">
        {lines.map((l) => (
          <span key={l.key}>
            <i className="k-line" style={{ borderColor: l.colour }}></i>
            {l.name}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2a3f" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} interval={5} />
          <YAxis tick={AXIS} width={32} tickLine={false} axisLine={false} domain={[0, 40]} ticks={[0, 10, 20, 30, 40]} allowDataOverflow />
          <Tooltip contentStyle={TIP} itemStyle={TIP_ITEM} labelStyle={TIP_LABEL} formatter={(v: unknown, name: unknown) => [Number(v).toFixed(1), String(name)]} />
          {/* Events close together: the first label sits left of its line, the rest to the right. */}
          {card.trend.events?.map((e, i) => (
            <ReferenceLine key={e.month} x={labelOf(e.month)} stroke="#34425e" strokeDasharray="3 3" label={{ value: t(e.label, e.label_ja ?? e.label), position: i === 0 ? 'insideTopRight' : 'insideTopLeft', fill: '#aeb9cd', fontSize: 10 }} />
          ))}
          {lines.map((l) => (
            <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.colour} strokeWidth={l.width} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {card.insight && <p className="flow-insight">{t(card.insight, card.insight_ja ?? card.insight)}</p>}
      <p className="muted small st-asof">{t(card.as_of, card.as_of_ja ?? card.as_of)}</p>
    </div>
  )
}
