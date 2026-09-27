import { lazy, Suspense } from 'react'
import { useProductData } from './hooks/useProductData'
import { useHashRoute } from './hooks/useHashRoute'
import type { ViewId } from './hooks/useHashRoute'
import NodeDashboard from './views/NodeDashboard'
import { AsOf } from './components/AsOf'
import { isEstimatedMeasure, MEASURE_LABEL, nodeSwitcherIds } from './lib/nodes'

// Map (Leaflet) and Strategy are split into their own chunks.
const MapView = lazy(() => import('./views/map/MapView'))
const StrategyView = lazy(() => import('./views/strategy/StrategyView'))

const TABS: { id: ViewId; label: string; ja: string }[] = [
  { id: 'map', label: 'Map', ja: '地図' },
  { id: 'nodes', label: 'Nodes', ja: 'ノード' },
  { id: 'strategy', label: 'Strategy', ja: '戦略' },
]

function Loading({ what }: { what: string }) {
  return (
    <div className="state-msg">
      <p className="font-display">Loading {what}...</p>
    </div>
  )
}

function LoadError({ file, error }: { file: string; error: Error | null }) {
  return (
    <div className="state-msg error">
      <p>Could not load data/{file}. Make sure this file is served alongside index.html.</p>
      <p className="small">{error ? error.message : 'Unknown error'}</p>
    </div>
  )
}

export default function App() {
  const { dashboard, registry, economics, strategy } = useProductData()
  const [route, navigate] = useHashRoute()
  const data = dashboard.data
  const liveNodes = data?.nodes ?? {}
  const inRegistry = (id: string) => !!registry.data?.nodes.some((n) => n.id === id)
  const selectedNode =
    route.view === 'nodes' && route.node && (liveNodes[route.node] || inRegistry(route.node)) ? route.node : 'all'
  const regNode = registry.data?.nodes.find((n) => n.id === selectedNode)
  const activeLive = selectedNode !== 'all' ? liveNodes[selectedNode] : undefined
  const measure = regNode?.measure ?? activeLive?.measure

  return (
    <>
      <header className={`hero ${route.view === 'nodes' ? '' : 'hero-compact'}`}>
        <div className="grain"></div>
        <div className="hero-inner">
          <div className="hero-top">
            <div>
              <div className="eyebrow">福井県観光データ分析システム · Fukui Tourism Analytics System</div>
              <h1 className="font-display hero-title">FTAS Executive Dashboard</h1>
              {route.view === 'nodes' && (
                <p className="hero-sub">
                  Operational demand intelligence for DMOs, hotel operators, and municipal planners across the Reihoku and Reinan corridors.
                </p>
              )}
            </div>
            <div className="hero-right">
              <span className="status-pill">
                <span className="status-dot"></span> Live pipeline
              </span>
              <div className="hero-generated">
                {data?.generated_at
                  ? 'Generated ' + new Date(data.generated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                  : ''}
              </div>
            </div>
          </div>

          <nav className="view-tabs" aria-label="Views">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#/${t.id}`}
                className={`view-tab ${route.view === t.id ? 'active' : ''}`}
                aria-current={route.view === t.id ? 'page' : undefined}
              >
                {t.label} <span className="ja">{t.ja}</span>
              </a>
            ))}
          </nav>

          {route.view === 'nodes' && data && (
            <div className="node-bar">
              <button className={`node-btn ${selectedNode === 'all' ? 'active' : ''}`} onClick={() => navigate({ view: 'nodes' })}>
                All Nodes Overview
              </button>
              {nodeSwitcherIds(registry.data, data).map((key) => {
                const n = liveNodes[key]
                const reg = registry.data?.nodes.find((r) => r.id === key)
                const label = n?.label ?? reg?.name ?? key
                return (
                  <button
                    key={key}
                    className={`node-btn ${selectedNode === key ? 'active' : ''} ${n ? '' : 'pending'}`}
                    onClick={() => navigate({ view: 'nodes', node: key })}
                    title={n ? undefined : 'Data not published yet'}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <svg className="wave-divider" viewBox="0 0 1200 28" preserveAspectRatio="none">
          <path d="M0,14 C150,28 350,0 600,14 C850,28 1050,0 1200,14 L1200,28 L0,28 Z" fill="#F7F3EA" />
        </svg>
      </header>

      <main>
        {route.view === 'map' && (
          <Suspense fallback={<Loading what="map" />}>
            <MapView
              registry={registry.data}
              dashboard={data}
              economics={economics.data}
              economicsError={economics.error}
              selectedId={route.node}
              onSelect={(id) => navigate({ view: 'map', node: id })}
              onOpenNode={(id) => navigate({ view: 'nodes', node: id })}
            />
          </Suspense>
        )}

        {route.view === 'nodes' &&
          (dashboard.isLoading ? (
            <Loading what="Fukui Tourism Analytics System" />
          ) : dashboard.error || !data ? (
            <LoadError file="dashboard_data.json" error={dashboard.error} />
          ) : (
            <>
              <div className="freshness-strip">
                <AsOf
                  as_of={activeLive?.as_of}
                  generated_at={data.generated_at}
                  shared_date={activeLive?.shared_date ?? data.shared_date}
                  is_estimated={activeLive?.is_estimated}
                  stale={activeLive?.stale}
                  label="Data as of"
                />
                {measure && (
                  <span className={`measure-tag ${isEstimatedMeasure(measure, activeLive) ? 'est' : ''}`}>{MEASURE_LABEL[measure]}</span>
                )}
              </div>
              {selectedNode !== 'all' && !activeLive ? (
                <section className="node-pending">
                  <h2>
                    {regNode?.name ?? selectedNode} <span className="ja">{regNode?.name_ja}</span>
                  </h2>
                  <p>
                    No published data for this node yet. Its visitor estimate
                    {measure ? ` (${MEASURE_LABEL[measure].toLowerCase()})` : ''} is being added to the data pipeline
                    and will appear here once it is published.
                  </p>
                </section>
              ) : (
                <NodeDashboard data={data} selectedNode={selectedNode} />
              )}
            </>
          ))}

        {route.view === 'strategy' &&
          (strategy.isLoading ? (
            <Loading what="strategic questions" />
          ) : strategy.error || !strategy.data ? (
            <LoadError file="strategic_questions.json" error={strategy.error} />
          ) : (
            <Suspense fallback={<Loading what="strategy view" />}>
              <StrategyView data={strategy.data} />
            </Suspense>
          ))}
      </main>

      <footer className="site">Fukui Tourism Analytics System — Distributed Human Data Engine · React 18 Migration</footer>
    </>
  )
}
