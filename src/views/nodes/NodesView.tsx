import { useState } from 'react'
import type { ProductData } from '../../hooks/useProductData'
import type { HotelThresholds } from '../../lib/nudges'
import { AsOf } from '../../components/AsOf'
import { Loading, LoadError } from '../../components/StateMsg'
import { Icon } from '../../components/icons'
import { useJsonResource } from '../../hooks/useJsonResource'
import { isEstimatedMeasure, MEASURE_LABEL, nodeSwitcherIds } from '../../lib/nodes'
import { useLang } from '../../lib/i18n'
import { addDays, jstToday } from '../../lib/nodeFigures'
import NodeDashboard from './NodeDashboard'
import '../../styles/pages.css'

/** A node's latest count older than this is flagged Stale. */
const STALE_DAYS = 7

interface Props {
  data: ProductData
  selected?: string
  onSelect: (id: string | undefined) => void
}

export default function NodesView({ data: product, selected, onSelect }: Props) {
  const { t } = useLang()
  const { registry, merged, realLoading } = product
  const thresholds = useJsonResource<HotelThresholds>('hotel_thresholds.json')
  const [today] = useState(jstToday)
  const real = merged?.real
  if (realLoading || product.live.isLoading) return <Loading what={t('Loading node dashboards…', 'ノードを読み込み中…')} />
  if (!real) return <LoadError file="real_data.json" error={null} />

  const inRegistry = (id: string) => !!registry.data?.nodes.some((n) => n.id === id)
  const selectedNode = selected && (real.nodes[selected] || inRegistry(selected)) ? selected : 'all'
  const regNode = registry.data?.nodes.find((n) => n.id === selectedNode)
  const rn = selectedNode !== 'all' ? real.nodes[selectedNode] : undefined
  const measure = regNode?.measure
  const asOf = (rn ? rn.as_of.visitors : real.shared_date) ?? null
  const staleBefore = addDays(today, -STALE_DAYS)
  const ids = nodeSwitcherIds(registry.data, real)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Per-node dashboards', 'ノード別ダッシュボード')}</div>
          <h1 className="page-title">{t('Nodes', 'ノード')}</h1>
          <p className="page-sub">
            {t(
              'Daily demand and forecast for each measured site, for DMOs, hotel operators and municipal planners across Reihoku and Reinan.',
              '嶺北・嶺南のDMO、宿泊事業者、自治体向けの、観測地点ごとの日次需要と予測。',
            )}
          </p>
        </div>
        <div className="freshness">
          <AsOf as_of={asOf ?? undefined} generated_at={real.generated_at} stale={Boolean(asOf && asOf < staleBefore)} label={t('Counts to', '実績')} />
          {measure && <span className={`measure-tag ${isEstimatedMeasure(measure) ? 'est' : ''}`}>{MEASURE_LABEL[measure]}</span>}
        </div>
      </div>

      <nav className="node-switch" aria-label={t('Choose a node', 'ノードを選択')}>
        <button className={`ns-btn ${selectedNode === 'all' ? 'on' : ''}`} aria-pressed={selectedNode === 'all'} onClick={() => onSelect(undefined)}>
          {t('All nodes', '全ノード')}
        </button>
        {ids.map((key) => {
          const has = Boolean(real.nodes[key])
          const reg = registry.data?.nodes.find((r) => r.id === key)
          return (
            <button
              key={key}
              className={`ns-btn ${selectedNode === key ? 'on' : ''} ${has ? '' : 'pending'}`}
              aria-pressed={selectedNode === key}
              onClick={() => onSelect(key)}
              title={has ? undefined : t('Data not published yet', 'データ未公開')}
            >
              {!has && <span className="ns-pending-dot" aria-hidden="true"></span>}
              {t(reg?.name ?? key, reg?.name_ja)}
            </button>
          )
        })}
      </nav>

      {selectedNode !== 'all' && !rn ? (
        <section className="card node-pending">
          <div className="np-icon" aria-hidden="true">
            <Icon name="now" size={26} />
          </div>
          <div>
            <h2 className="card-title">
              {t(regNode?.name ?? selectedNode, regNode?.name_ja)} <span className="ja-sub">{t('data on its way', 'データ準備中')}</span>
            </h2>
            <p className="page-sub">
              {t('No published data for this node yet. Its visitor estimate', 'このノードのデータはまだ公開されていません。来訪者推定')}
              {measure ? ` (${MEASURE_LABEL[measure].toLowerCase()})` : ''}{' '}
              {t('is being added to the data pipeline and will appear here once it is published.', 'はデータパイプラインに追加中で、公開され次第ここに表示されます。')}
            </p>
            <a className="btn" href={`#/map/${selectedNode}`}>
              <Icon name="map" /> {t('See it on the map', '地図で見る')}
            </a>
          </div>
        </section>
      ) : (
        <NodeDashboard
          real={real}
          live={merged?.live ?? null}
          market={merged?.market ?? null}
          registry={registry.data?.nodes ?? []}
          thresholds={thresholds.data}
          ids={ids}
          today={today}
          selectedNode={selectedNode}
          onSelect={(id) => onSelect(id)}
        />
      )}
    </div>
  )
}
