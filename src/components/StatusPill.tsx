import type { MetricStatus } from '../types/economics'
import { useLang } from '../lib/i18n'

const LABELS: Record<MetricStatus, [string, string, string]> = {
  real: ['Real', '実データ', 'حقيقي'],
  modelled: ['Estimated', '推計', 'تقديري'],
  illustrative: ['Illustrative', '例示', 'للتوضيح'],
  pending: ['Data pending', 'データ待ち', 'البيانات قيد الانتظار'],
}

const ORDER: MetricStatus[] = ['real', 'modelled', 'illustrative', 'pending']

/** One of the four provenance pills shared by the Strategy view and the economics layer. */
export function StatusPill({ status, label }: { status: MetricStatus; label?: string }) {
  const { t, lang } = useLang()
  // A custom label is English (from the data): Arabic shows the standard label instead.
  const text = lang === 'ja' ? LABELS[status][1] : lang === 'ar' ? LABELS[status][2] : (label ?? LABELS[status][0])
  return (
    <span className={`pill pill-${status}`} title={t(...LABELS[status])}>
      <span className="pill-dot" aria-hidden="true"></span>
      {text}
    </span>
  )
}

type PillLabels = Partial<Record<MetricStatus, { label: string; description: string }>>

export function PillLegend({ labels }: { labels?: PillLabels }) {
  const { t } = useLang()
  return (
    <div className="pill-legend">
      {ORDER.map((s) => (
        <span key={s} className="pill-legend-item">
          <StatusPill status={s} label={labels?.[s]?.label} />
          {labels?.[s]?.description && <span className="pill-legend-desc">{t(labels[s]?.description ?? '')}</span>}
        </span>
      ))}
    </div>
  )
}
