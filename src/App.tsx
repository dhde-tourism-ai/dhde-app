import { lazy, Suspense } from 'react'
import { useProductData } from './hooks/useProductData'
import { useHashRoute } from './hooks/useHashRoute'
import { useDataFallback } from './hooks/useDataFallback'
import type { ViewId } from './hooks/useHashRoute'
import { useLang } from './lib/i18n'
import { Icon } from './components/icons'
import type { IconName } from './lib/icons'
import { fmtDate } from './lib/format'
import { Loading, LoadError } from './components/StateMsg'

// Every view is its own chunk (Leaflet for the map, recharts for Nodes and Strategy).
const MapView = lazy(() => import('./views/map/MapView'))
const StrategyView = lazy(() => import('./views/strategy/StrategyView'))
const NodesView = lazy(() => import('./views/nodes/NodesView'))
const SummaryView = lazy(() => import('./views/summary/SummaryView'))

const TABS: { id: ViewId; en: string; ja: string; icon: IconName }[] = [
  { id: 'summary', en: 'Summary', ja: '概要', icon: 'home' },
  { id: 'map', en: 'Map', ja: '地図', icon: 'map' },
  { id: 'nodes', en: 'Nodes', ja: 'ノード', icon: 'nodes' },
  { id: 'strategy', en: 'Strategy', ja: '戦略', icon: 'strategy' },
]

function BrandMark() {
  // Six nodes on a flow arc: the product in one glyph.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#17233a" />
      <path d="M6 22c4-9 9-12 20-13" stroke="#8b9dff" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="1 3.2" />
      <circle cx="7" cy="21.5" r="2.6" fill="#3987e5" />
      <circle cx="15.5" cy="13.5" r="3.4" fill="#8b9dff" />
      <circle cx="25" cy="9.3" r="2.2" fill="#d55181" />
    </svg>
  )
}

export default function App() {
  const data = useProductData()
  const { dashboard, registry, economics, strategy, live, routes, market, merged, realLoading } = data
  const [route, navigate] = useHashRoute()
  const { lang, setLang, t } = useLang()
  const fallback = useDataFallback()

  const shared = merged?.real?.shared_date ?? null
  const generated = shared ?? live.data?.generated_at ?? dashboard.data?.generated_at
  const isDemo = !shared && live.data?.demo

  return (
    <div className={`app view-${route.view}`}>
      <header className="appbar">
        <a className="brand" href="#/summary" aria-label="DHDE · Fukui Tourism Intelligence">
          <BrandMark />
          <span className="brand-name">
            DHDE<span className="dot">·</span>
            <span className="brand-sub">{t('Fukui Tourism Intelligence', '福井観光インテリジェンス')}</span>
          </span>
        </a>

        <nav className="tabs" aria-label={t('Views', 'ビュー')}>
          {TABS.map((tab) => (
            <a key={tab.id} href={`#/${tab.id}`} className="tab" aria-current={route.view === tab.id ? 'page' : undefined}>
              <Icon name={tab.icon} />
              <span className="tab-label">{t(tab.en, tab.ja)}</span>
            </a>
          ))}
        </nav>

        <div className="appbar-right">
          {generated && (
            <span className={`fresh-chip ${isDemo ? 'stale' : ''}`} title={isDemo ? t('Live layers run on demo data', 'ライブレイヤーはデモデータです') : t('Real data up to this date (shared date across nodes); some layers still use demo data', 'この日までの実データ（全ノード共通日）。一部レイヤーはデモ')}>
              <span className="fresh-dot" aria-hidden="true"></span>
              <span className="fresh-text-long">{shared ? t('Real data to', '実データ') : t('Data', 'データ')}</span> {fmtDate(generated, lang)}
            </span>
          )}
          <div className="lang-toggle" role="group" aria-label={t('Language', '言語')}>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button aria-pressed={lang === 'ja'} onClick={() => setLang('ja')} lang="ja">
              日本語
            </button>
          </div>
        </div>
      </header>

      {fallback && (
        <div className="saved-data-note" role="status">
          {fallback.date
            ? t(`Showing saved data from ${fmtDate(fallback.date, lang)}`, `${fmtDate(fallback.date, lang)}時点の保存データを表示中`)
            : t('Showing saved data', '保存データを表示中')}
        </div>
      )}

      <main id="main">
        {route.view === 'summary' && (
          <Suspense fallback={<Loading what={t('Loading summary…', '概要を読み込み中…')} />}>
            <SummaryView data={data} />
          </Suspense>
        )}

        {route.view === 'map' && (live.isLoading || realLoading) && <Loading what={t('Loading map…', '地図を読み込み中…')} />}
        {route.view === 'map' && !live.isLoading && !realLoading && (
          <Suspense fallback={<Loading what={t('Loading map…', '地図を読み込み中…')} />}>
            <MapView
              registry={registry.data}
              dashboard={dashboard.data}
              economics={economics.data}
              economicsError={economics.error}
              live={merged?.live ?? live.data}
              liveError={live.error}
              routes={routes.data}
              market={merged?.market ?? market.data}
              selectedId={route.node}
              onSelect={(id) => navigate({ view: 'map', node: id })}
              onOpenNode={(id) => navigate({ view: 'nodes', node: id })}
            />
          </Suspense>
        )}

        {route.view === 'nodes' && (
          <Suspense fallback={<Loading what={t('Loading node dashboards…', 'ノードを読み込み中…')} />}>
            <NodesView data={data} selected={route.node} onSelect={(id) => navigate({ view: 'nodes', node: id })} />
          </Suspense>
        )}

        {route.view === 'strategy' &&
          (strategy.isLoading ? (
            <Loading what={t('Loading strategic questions…', '戦略課題を読み込み中…')} />
          ) : strategy.error || !strategy.data ? (
            <LoadError file="strategic_questions.json" error={strategy.error} />
          ) : (
            <Suspense fallback={<Loading what={t('Loading strategy view…', '読み込み中…')} />}>
              <StrategyView data={strategy.data} focus={route.node} />
            </Suspense>
          ))}
      </main>

      {route.view !== 'map' && (
        <footer className="site-foot">
          DHDE · {t('Fukui Tourism Intelligence', '福井観光インテリジェンス')} · {t('Distributed Human Data Engine, Sakura Science Program. Node forecasts from the FTAS pipeline.', '分散型ヒューマンデータエンジン（さくらサイエンスプログラム）。ノード予測はFTASパイプラインより。')}
        </footer>
      )}
    </div>
  )
}
