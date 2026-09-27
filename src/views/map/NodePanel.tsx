import type { DashboardData } from '../../types/dashboard'
import type { EconomicsFigures, Metric, RegionalEconomics } from '../../types/economics'
import { AsOf } from '../../components/AsOf'
import { StatusPill } from '../../components/StatusPill'
import { fmtCompact, fmtDate, fmtMetric } from '../../lib/format'
import { congestionTier, isEstimatedMeasure, latestReading, MEASURE_LABEL } from '../../lib/nodes'
import { econNodeFor, fmtLost } from '../../lib/economics'
import type { MapNode } from '../../lib/nodes'

interface NodePanelProps {
  node?: MapNode
  nodes: MapNode[]
  dashboard: DashboardData | null
  economics: RegionalEconomics | null
  onSelect: (id: string | undefined) => void
  onOpenNode: (id: string) => void
}

function MetricRow({ label, m, kind }: { label: string; m: Metric; kind?: 'yen' | 'count' }) {
  return (
    <div className="panel-row">
      <span>{label}</span>
      <span className="panel-val">
        {fmtMetric(m, kind)} <StatusPill status={m.status} />
      </span>
    </div>
  )
}

function EconomicsBlock({ title, f }: { title: string; f: EconomicsFigures }) {
  const o = f.opportunity_lost_yen
  return (
    <div className="panel-block">
      <div className="panel-block-title">{title}</div>
      <MetricRow label="Visitors" m={f.visitors} />
      <MetricRow label="Revenue" m={f.revenue_yen} kind="yen" />
      <div className="panel-row">
        <span>Opportunity lost (total)</span>
        <span className="panel-val">{fmtLost(f)}</span>
      </div>
      <MetricRow label="· overnight gap" m={o.overnight_gap} kind="yen" />
      <MetricRow label="· weather" m={o.weather} kind="yen" />
      <MetricRow label="· idle rooms" m={o.idle_rooms} kind="yen" />
    </div>
  )
}

/** Side panel: selected node detail, or the node list when nothing is selected. */
export function NodePanel({ node, nodes, dashboard, economics, onSelect, onOpenNode }: NodePanelProps) {
  const econFooter = economics && (
    <div className="panel-foot">
      Economics{economics.sample ? ' (SAMPLE)' : ''} · year {economics.as_of_year} · generated {fmtDate(economics.generated_at)}
    </div>
  )

  if (!node) {
    return (
      <aside className="node-panel">
        <div className="panel-head">
          <div className="panel-title">Nodes</div>
          <AsOf generated_at={dashboard?.generated_at} shared_date={dashboard?.shared_date} label="Data as of" />
        </div>
        <div className="panel-list">
          {nodes.map((n) => {
            const r = latestReading(n.live)
            const tier = r ? congestionTier(r.congestionIndex) : null
            return (
              <button key={n.id} className="panel-list-row" onClick={() => onSelect(n.id)}>
                <span className="legend-dot" style={{ background: tier?.colour ?? '#c3cad4' }}></span>
                <span className="grow">
                  {n.name} <span className="ja">{n.name_ja}</span>
                </span>
                <span className="panel-val">{tier ? tier.label : 'No data yet'}</span>
              </button>
            )
          })}
        </div>
        {economics && <EconomicsBlock title="Prefecture" f={economics.prefecture} />}
        {econFooter}
        <p className="panel-hint">Select a node on the map for detail.</p>
      </aside>
    )
  }

  const live = node.live
  const reading = latestReading(live)
  const tier = reading ? congestionTier(reading.congestionIndex) : null
  const measure = node.measure ?? live?.measure
  const estimated = isEstimatedMeasure(measure, live)
  const pacing = live?.summary?.this_week_pacing
  const econNode = econNodeFor(node, economics)
  const econRegion = econNode && economics?.regions.find((r) => r.id === econNode.region)

  return (
    <aside className="node-panel">
      <div className="panel-head">
        <button className="panel-back" onClick={() => onSelect(undefined)} aria-label="Back to node list">
          ← All nodes
        </button>
        <div className="panel-title">{node.name}</div>
        <div className="panel-ja">{node.name_ja}</div>
        {node.role && <div className="panel-role">{node.role}</div>}
      </div>

      <div className="panel-block">
        <div className="panel-row">
          <span>Measure</span>
          <span className="panel-val">
            {measure ? MEASURE_LABEL[measure] : 'Not yet measured'}
            {estimated && <span className="asof-flag est">Estimated</span>}
          </span>
        </div>
        {node.secondary_measures?.map((m) => (
          <div key={m} className="panel-row">
            <span>Also</span>
            <span className="panel-val">{MEASURE_LABEL[m]}</span>
          </div>
        ))}
        {node.coords_approx && <div className="panel-note">Coordinates approximate; no data feed yet.</div>}
      </div>

      {reading ? (
        <div className="panel-block">
          <div className="panel-block-title">Latest day · {fmtDate(reading.date)}</div>
          <div className="panel-kpis">
            <div>
              <div className="kpi-label">Actual</div>
              <div className={`panel-kpi ${estimated ? 'est' : ''}`}>{fmtCompact(reading.actual)}</div>
            </div>
            <div>
              <div className="kpi-label">Predicted</div>
              <div className="panel-kpi pred">{fmtCompact(reading.forecast)}</div>
            </div>
          </div>
          <div className="panel-row">
            <span>Congestion</span>
            <span className="panel-val">
              <span className="legend-dot" style={{ background: tier!.colour }}></span>
              {tier!.label}
            </span>
          </div>
          <div className="panel-note">
            {reading.congestionSource === 'road_congestion'
              ? `TomTom road congestion ${(live!.road_congestion! * 100).toFixed(0)}%${live?.road_congestion_as_of ? ', as of ' + fmtDate(live.road_congestion_as_of) : ''}`
              : 'Tier from visitors relative to the 60-day peak (road congestion not yet in data).'}
          </div>
          {pacing && (
            <div className="panel-row">
              <span>This week pacing</span>
              <span className={`badge badge-${pacing.badge}`}>
                {(pacing.rate * 100).toFixed(0)}% · {pacing.label}
              </span>
            </div>
          )}
          <AsOf
            as_of={live?.as_of}
            generated_at={dashboard?.generated_at}
            shared_date={live?.shared_date ?? dashboard?.shared_date}
            is_estimated={live?.is_estimated}
            stale={live?.stale}
          />
          <button className="export-btn panel-open" onClick={() => onOpenNode(node.id)}>
            Open node dashboard →
          </button>
        </div>
      ) : (
        <div className="panel-block">
          <div className="panel-note">No live data for this node yet in dashboard_data.json.</div>
        </div>
      )}

      {econNode && (
        <EconomicsBlock
          title={`Node economics${economics?.visitor_window?.nodes ? ' · ' + economics.visitor_window.nodes : ''}`}
          f={econNode}
        />
      )}
      {econNode?.annotation && <div className="panel-note">{econNode.annotation}</div>}
      {econRegion && <EconomicsBlock title={`${econRegion.name} (${econRegion.name_ja})`} f={econRegion} />}
      {econFooter}
    </aside>
  )
}
