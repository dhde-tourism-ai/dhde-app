import type { ProductData } from '../../hooks/useProductData'
import { AsOf } from '../../components/AsOf'
import { Loading, LoadError } from '../../components/StateMsg'
import { Icon } from '../../components/icons'
import { isEstimatedMeasure, MEASURE_LABEL, nodeSwitcherIds } from '../../lib/nodes'
import { useLang } from '../../lib/i18n'
import NodeDashboard from './NodeDashboard'
import '../../styles/pages.css'

interface Props {
  data: ProductData
  selected?: string
  onSelect: (id: string | undefined) => void
}

export default function NodesView({ data: product, selected, onSelect }: Props) {
  const { t } = useLang()
  const { dashboard, registry } = product
  const data = dashboard.data
  if (dashboard.isLoading) return <Loading what={t('Loading node dashboards…', 'ノードを読み込み中…')} />
  if (dashboard.error || !data) return <LoadError file="dashboard_data.json" error={dashboard.error} />

  const liveNodes = data.nodes ?? {}
  const inRegistry = (id: string) => !!registry.data?.nodes.some((n) => n.id === id)
  const selectedNode = selected && (liveNodes[selected] || inRegistry(selected)) ? selected : 'all'
  const regNode = registry.data?.nodes.find((n) => n.id === selectedNode)
  const activeLive = selectedNode !== 'all' ? liveNodes[selectedNode] : undefined
  const measure = regNode?.measure ?? activeLive?.measure

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
          <AsOf
            as_of={activeLive?.as_of}
            generated_at={data.generated_at}
            shared_date={activeLive?.shared_date ?? data.shared_date}
            is_estimated={activeLive?.is_estimated}
            stale={activeLive?.stale}
            label={t('Data as of', 'データ時点')}
          />
          {measure && <span className={`measure-tag ${isEstimatedMeasure(measure, activeLive) ? 'est' : ''}`}>{MEASURE_LABEL[measure]}</span>}
        </div>
      </div>

      <nav className="node-switch" aria-label={t('Choose a node', 'ノードを選択')}>
        <button className={`ns-btn ${selectedNode === 'all' ? 'on' : ''}`} aria-pressed={selectedNode === 'all'} onClick={() => onSelect(undefined)}>
          {t('All nodes', '全ノード')}
        </button>
        {nodeSwitcherIds(registry.data, data).map((key) => {
          const n = liveNodes[key]
          const reg = registry.data?.nodes.find((r) => r.id === key)
          const label = t(n?.label ?? reg?.name ?? key, reg?.name_ja)
          return (
            <button
              key={key}
              className={`ns-btn ${selectedNode === key ? 'on' : ''} ${n ? '' : 'pending'}`}
              aria-pressed={selectedNode === key}
              onClick={() => onSelect(key)}
              title={n ? undefined : t('Data not published yet', 'データ未公開')}
            >
              {!n && <span className="ns-pending-dot" aria-hidden="true"></span>}
              {label}
            </button>
          )
        })}
      </nav>

      {selectedNode !== 'all' && !activeLive ? (
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
        <NodeDashboard data={data} selectedNode={selectedNode} />
      )}
    </div>
  )
}
