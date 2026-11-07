import type { SourceInfo } from '../types/live'
import { useLang } from '../lib/i18n'
import { fmtDate } from '../lib/format'
import { DemoBadge } from './DemoBadge'

import type { DataKind } from '../lib/dataProvenance'
const LABELS = {
  observed: ['Observed', '観測・収集', 'مرصود'],
  estimated: ['Estimated', '推計', 'تقديري'],
  forecast: ['Forecast', '予測', 'توقعات'],
  mixed: ['Mixed data', '混合データ', 'بيانات مختلطة'],
} as const

/** Source coverage is not the same as measurement type: derived values need an explicit kind. */
export function SourceBadge({ info, compact = false, note, kind }: { info?: SourceInfo | null; compact?: boolean; note?: readonly [string, string]; kind?: DataKind }) {
  const { t, lang } = useLang()
  if (!info || info.status === 'demo') return <DemoBadge compact={compact} />
  const date = info.as_of ? fmtDate(info.as_of, lang).replace(/ \d{4}$/, '').replace(/^\d{4}年/, '') : ''
  const category = kind ?? (info.status === 'real' ? 'observed' : 'mixed')
  const [en, ja, ar] = LABELS[category]
  const label = t(en, ja, ar)
  const detail = note ? t(note[0], note[1]) : t('Source coverage only; derived values may be estimated or forecast. See the data explanation for this layer.', 'データの収録範囲を示します。加工値には推計・予測を含みます。レイヤーの説明をご確認ください。', 'تغطية المصدر فقط؛ قد تكون القيم المشتقة تقديرية أو متوقعة. راجع شرح بيانات الطبقة.')
  const latest = info.as_of ? t(` Source date: ${info.as_of}.`, ` データ日：${info.as_of}。`, ` تاريخ المصدر: ${info.as_of}.`) : ''
  return (
    <span className={`src-badge ${category === 'observed' ? 'real' : 'mixed'}`} title={`${label}: ${detail}${latest}`}>
      <span className="src-dot" aria-hidden="true"></span>
      <span className="src-label">{label}</span>
      {!compact && date && <span className="src-date">· {date}</span>}
    </span>
  )
}
