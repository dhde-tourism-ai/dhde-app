import { PillLegend } from '../../components/StatusPill'
import { CONGESTION_TIERS } from '../../lib/nodes'

export function MapLegend({ showEconomics }: { showEconomics: boolean }) {
  return (
    <div className="map-legend">
      <div className="legend-group">
        <div className="legend-title">Congestion</div>
        {CONGESTION_TIERS.map((t) => (
          <span key={t.label} className="legend-item">
            <span className="legend-dot" style={{ background: t.colour }}></span>
            {t.label} <span className="ja">{t.label_ja}</span>
          </span>
        ))}
      </div>
      <div className="legend-group">
        <div className="legend-title">Markers</div>
        <span className="legend-item">
          <span className="legend-dot solid"></span>Actual
        </span>
        <span className="legend-item">
          <span className="legend-dot ring"></span>Predicted
        </span>
        <span className="legend-item">
          <span className="legend-dot est"></span>Estimated (proxy / bookings)
        </span>
        <span className="legend-item">
          <span className="legend-dot none"></span>No live data yet
        </span>
      </div>
      {showEconomics && (
        <div className="legend-group">
          <div className="legend-title">Economics: circle = revenue, dashed line = visitor flow</div>
          <PillLegend />
        </div>
      )}
    </div>
  )
}
