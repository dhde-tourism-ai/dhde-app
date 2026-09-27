import type { MetricStatus } from '../types/economics'

const LABELS: Record<MetricStatus, string> = {
  real: 'Real',
  modelled: 'Calculated / modelled',
  illustrative: 'Illustrative',
  pending: 'Data pending',
}

const ORDER: MetricStatus[] = ['real', 'modelled', 'illustrative', 'pending']

/** One of the four provenance pills shared by the Strategy view and the economics layer. */
export function StatusPill({ status, label }: { status: MetricStatus; label?: string }) {
  return (
    <span className={`pill pill-${status}`} title={LABELS[status]}>
      <span className="pill-dot" aria-hidden="true"></span>
      {label ?? LABELS[status]}
    </span>
  )
}

type PillLabels = Partial<Record<MetricStatus, { label: string; description: string }>>

export function PillLegend({ labels }: { labels?: PillLabels }) {
  return (
    <div className="pill-legend">
      {ORDER.map((s) => (
        <span key={s} className="pill-legend-item">
          <StatusPill status={s} label={labels?.[s]?.label} />
          {labels?.[s]?.description && <span className="pill-legend-desc">{labels[s]?.description}</span>}
        </span>
      ))}
    </div>
  )
}
