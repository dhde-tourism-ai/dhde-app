import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MarketStatus, ModeId, TransportFile, TransportMarketFile, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'
import { Exhibit } from './Exhibit'

/** Series colours: the dashboard's categorical tokens, one per mode family. */
const MODE_FILL: Record<string, string> = { taxi: '#c98500', bus: '#3987e5', rail: '#d95926', car: '#199e70' }
const SPEND_FILL: Record<ModeId, string> = { own_car: '#199e70', rental_car: '#c98500', bus: '#3987e5', train: '#d95926', other: '#4a5770' }
const SPEND_NAME: Record<ModeId, [string, string]> = {
  rental_car: ['Rental car', 'レンタカー'],
  bus: ['Bus', 'バス'],
  train: ['Train', '鉄道'],
  own_car: ['Own car', '自家用車'],
  other: ['Other', 'その他'],
}
const AXIS = { fill: '#aeb9cd', fontSize: 12.5 }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12.5, color: '#e9eef8' }
const CURSOR = { fill: 'rgba(160,185,230,.06)' }

const yenShort = (v: number, lang: string) =>
  lang === 'ja' ? (v >= 1e8 ? `${(v / 1e8).toFixed(1)}億円` : `${Math.round(v / 1e4).toLocaleString()}万円`) : v >= 1e9 ? `¥${(v / 1e9).toFixed(2)}bn` : `¥${Math.round(v / 1e6)}M`
const people = (v: number, lang: string) => (lang === 'ja' ? `${(v / 1e4).toFixed(0)}万人` : `${(v / 1e6).toFixed(2)}M`)

function Badge({ status }: { status: MarketStatus }) {
  const { t } = useLang()
  if (status === 'official') return <span className="mk-badge off">{t('Official', '公式')}</span>
  if (status === 'press') return <span className="mk-badge press">{t('Press', '報道')}</span>
  return <span className="mk-badge none">{t('Not published', '非公表')}</span>
}

/**
 * "Fares and revenue" page: published revenue and ridership by operator group,
 * how full services run, fares from Fukui Station to each site (operators'
 * fare tables), and transport spend per visitor from the prefecture survey.
 */
export function TransportMarket({ market, data, modes, name }: { market: TransportMarketFile; data: TransportFile; modes: TransportModesFile | null; name: (id: string) => string }) {
  const { t, lang } = useLang()
  const rev = market.revenue.filter((r) => r.yen != null).sort((a, b) => (b.yen ?? 0) - (a.yen ?? 0))
  const missing = market.revenue.filter((r) => r.yen == null)
  const ride = market.ridership.slice().sort((a, b) => b.passengers - a.passengers)
  const spend = modes?.spend_per_visitor
  const spendRows = spend
    ? (['rental_car', 'bus', 'train', 'own_car'] as ModeId[])
        .map((m) => ({ id: m, name: t(...SPEND_NAME[m]), yen: spend.visitors_from_outside[m]?.yen ?? 0, local: spend.fukui_residents[m]?.yen ?? null }))
        .filter((r) => r.yen > 0)
    : []
  const sites = Object.keys(data.nodes).filter((id) => id !== data.hub)
  const top2 = rev.slice(0, 2)

  return (
    <>
      <div className="mk-util">
        {market.utilisation.map((u) => (
          <a key={u.id} className="mk-util-tile" href={u.url} target="_blank" rel="noreferrer" title={t(u.detail, u.detail_ja)}>
            <span className="mk-util-value num">{u.value}</span>
            <span className="mk-util-label">{t(u.label, u.label_ja)}</span>
            <span className="mk-util-meta">
              {u.period} · <Badge status={u.status} />
            </span>
          </a>
        ))}
      </div>

      <Exhibit
        n={4}
        title={
          top2.length === 2
            ? t(
                `${top2[0].label.split(' (')[0]} and ${top2[1].label.split(' (')[0].toLowerCase()} each take in over ¥3 billion a year in Fukui`,
                `福井県では${top2[0].label_ja.split('（')[0]}と${top2[1].label_ja.split('（')[0]}がそれぞれ年30億円超の収入`,
              )
            : t('Published transport revenue in Fukui', '福井県の交通の公表収入')
        }
        sub={t('Annual operating or fare revenue, latest published year, yen', '年間の営業収入・運賃収入（最新の公表年度、円）')}
        source={t(
          'Sources: Chubu District Transport Bureau (taxis, route buses; official), Fukui Shimbun (Hapi-line; press). Operators that do not publish revenue are listed below the chart.',
          '出典：中部運輸局（タクシー・路線バス、公式）、福井新聞（ハピラインふくい、報道）。収入を公表していない事業者はグラフの下に記載。',
        )}
      >
        <div className="mk-chart" style={{ height: 40 + rev.length * 52 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rev.map((r) => ({ ...r, name: t(r.label, r.label_ja) }))} layout="vertical" margin={{ top: 4, right: 96, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={240} />
              <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [yenShort(Number(v), lang), t('revenue', '収入')]} />
              <Bar dataKey="yen" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {rev.map((r) => (
                  <Cell key={r.id} fill={MODE_FILL[r.mode] ?? '#5a6782'} />
                ))}
                <LabelList dataKey="yen" position="right" formatter={(v) => yenShort(Number(v), lang)} style={{ fill: '#e9eef8', fontSize: 13, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mk-rows">
          {rev.map((r) => (
            <li key={r.id}>
              <span>{t(r.label, r.label_ja)}</span>
              <span className="muted">
                {r.period} · {t(r.detail, r.detail_ja)}
              </span>
              <a href={r.url} target="_blank" rel="noreferrer">
                <Badge status={r.status} />
              </a>
            </li>
          ))}
          {missing.map((r) => (
            <li key={r.id} className="mk-missing">
              <span>{t(r.label, r.label_ja)}</span>
              <span className="muted">{t(r.detail, r.detail_ja)}</span>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer">
                  <Badge status={r.status} />
                </a>
              ) : (
                <Badge status={r.status} />
              )}
            </li>
          ))}
        </ul>
      </Exhibit>

      <Exhibit
        n={5}
        title={t(
          'Rail carries the most passengers: the Shinkansen and Hapi-line each carry 7–8 million a year',
          '最も多いのは鉄道：北陸新幹線とハピラインふくいがそれぞれ年700〜800万人',
        )}
        sub={t('Passengers a year, latest published period', '年間輸送人員（最新の公表期間）')}
        source={t('Sources: JR West via Wakasa Bay, Fukui Shimbun, Chunichi Shimbun (press); Chubu District Transport Bureau (official). Periods differ by operator; see each row.', '出典：JR西日本（若狭湾経由）、福井新聞、中日新聞（報道）、中部運輸局（公式）。期間は事業者ごとに異なる。')}
      >
        <div className="mk-chart" style={{ height: 40 + ride.length * 48 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ride.map((r) => ({ ...r, name: t(r.label, r.label_ja) }))} layout="vertical" margin={{ top: 4, right: 96, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={260} />
              <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [Number(v).toLocaleString(), t('passengers', '人')]} />
              <Bar dataKey="passengers" barSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {ride.map((r) => (
                  <Cell key={r.id} fill={MODE_FILL[r.mode] ?? '#5a6782'} />
                ))}
                <LabelList dataKey="passengers" position="right" formatter={(v) => people(Number(v), lang)} style={{ fill: '#e9eef8', fontSize: 13, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mk-rows">
          {ride.map((r) => (
            <li key={r.id}>
              <span>{t(r.label, r.label_ja)}</span>
              <span className="muted">
                {r.period} · {t(r.detail, r.detail_ja)}
              </span>
              <a href={r.url} target="_blank" rel="noreferrer">
                <Badge status={r.status} />
              </a>
            </li>
          ))}
        </ul>
      </Exhibit>

      <Exhibit
        n={6}
        title={t('A bus trip from Fukui Station to a site costs ¥1,000–2,400 each way', '福井駅から各地点へのバス運賃は片道1,000〜2,400円')}
        sub={t('Adult cash fare, one way, for the quickest bus trip shown on this page, and the matching rail fares', '大人・片道・現金。このページの最短のバス経路の運賃と、対応する鉄道運賃')}
        source={t(
          'Bus: operators’ fare tables in the GTFS-JP timetables, summed over each bus taken; Eiheiji Liner ¥1,000 from 2026-10-01 (Keifuku Bus). Rail and taxi: operators’ published fare tables. Tokyo–Fukui: secondary source.',
          'バス：GTFS-JP時刻表の運賃表（乗車ごとの合計）。永平寺ライナーは2026年10月1日から1,000円（京福バス）。鉄道・タクシー：事業者の運賃表。東京〜福井：二次資料。',
        )}
      >
        <div className="tx-table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th>{t('Site', '地点')}</th>
                <th>
                  {t('Bus fare', 'バス運賃')}
                  <span>{t('weekday', '平日')}</span>
                </th>
                <th>
                  {t('Bus fare', 'バス運賃')}
                  <span>{t('Saturday', '土曜')}</span>
                </th>
                <th>
                  {t('Buses taken', '乗車回数')}
                  <span>{t('weekday', '平日')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sites.map((id) => {
                const wk = data.nodes[id].days.weekday?.from_hub?.fastest
                const sat = data.nodes[id].days.saturday?.from_hub?.fastest
                const legs = wk?.legs.filter((l) => l.mode !== 'walk').length
                const yen = (v: number | null | undefined) => (v != null ? `¥${v.toLocaleString()}` : <span className="tx-dim">—</span>)
                return (
                  <tr key={id}>
                    <th>{name(id)}</th>
                    <td className="num">{yen(wk?.fare_yen)}</td>
                    <td className="num">{yen(sat?.fare_yen)}</td>
                    <td className="num">{legs ?? <span className="tx-dim">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <h3 className="mk-h3">{t('Published rail, Shinkansen and taxi fares', '鉄道・新幹線・タクシーの公表運賃')}</h3>
        <ul className="mk-fares">
          {market.fares.map((f, i) => (
            <li key={i}>
              <span className="mk-fare-route">
                {f.group === 'taxi' ? t(`${f.operator}, ${f.to}`, `${f.operator_ja}、${f.to_ja}`) : t(`${f.from} → ${f.to}`, `${f.from_ja}→${f.to_ja}`)}
              </span>
              <span className="muted">{f.group === 'taxi' ? f.period : t(`${f.operator}, ${f.period}`, `${f.operator_ja}、${f.period}`)}</span>
              <span className="mk-fare-yen num">¥{f.yen.toLocaleString()}</span>
              <a href={f.url} target="_blank" rel="noreferrer">
                <Badge status={f.status} />
              </a>
            </li>
          ))}
        </ul>
        <p className="tx-table-note">
          {t(
            'The Dinosaur Bus (Saturdays) is a direct ¥2,400 service; on weekdays the trip is three buses for ¥2,060, or Echizen Railway to Katsuyama (¥820) plus the city bus.',
            '恐竜バス（土曜）は直通で2,400円。平日はバス3本で2,060円、またはえちぜん鉄道で勝山（820円）＋市のバス。',
          )}
        </p>
      </Exhibit>

      {spend && spendRows.length > 0 && (
        <Exhibit
          n={7}
          title={t(
            `Visitors who get around by rental car or bus spend 2–3 times more on transport than drivers`,
            'レンタカーやバスで移動する来訪者は、自家用車の来訪者の2〜3倍を交通費に使う',
          )}
          sub={t(
            `Average transport spend per visitor for the whole trip (including getting to Fukui), visitors from outside Fukui, by how they got around in Fukui`,
            '来訪者1人当たりの旅行全体の交通費（福井までを含む）、県外からの来訪者、県内での交通手段別',
          )}
          source={t(
            `Estimate. Source: Fukui Prefecture tourism survey, 交通費 (answer bands, midpoints), ${spend.responses.toLocaleString()} answers in the last 12 months. Fukui residents shown in each row for comparison.`,
            `推計値。出典：福井県観光アンケートの交通費（回答区分の中央値）、直近12か月の回答${spend.responses.toLocaleString()}件。県内在住者の値を各行に併記。`,
          )}
        >
          <div className="mk-chart" style={{ height: 40 + spendRows.length * 52 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendRows} layout="vertical" margin={{ top: 4, right: 220, left: 8, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={110} />
                <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [`¥${Number(v).toLocaleString()}`, t('per visitor', '1人当たり')]} />
                <Bar dataKey="yen" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {spendRows.map((r) => (
                    <Cell key={r.id} fill={SPEND_FILL[r.id]} />
                  ))}
                  <LabelList
                    dataKey="yen"
                    position="right"
                    content={(p) => {
                      const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number }
                      const r = spendRows[index]
                      return (
                        <text x={Number(x) + Number(width) + 10} y={Number(y) + Number(height) / 2 + 4} fill="#e9eef8" fontSize={13} fontWeight={600}>
                          ¥{r.yen.toLocaleString()}
                          <tspan fill="#7f8ba3" fontWeight={400}>
                            {r.local != null ? t(`   residents ¥${r.local.toLocaleString()}`, `   県内在住 ¥${r.local.toLocaleString()}`) : ''}
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Exhibit>
      )}
    </>
  )
}
