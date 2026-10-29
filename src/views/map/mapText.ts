/**
 * Arabic for the map's numbers, units and data-built texts. English and Japanese
 * pass through unchanged; Arabic digits are swapped on the page (arabicDigits.ts).
 */
import { arText } from '../../lib/i18n'
import type { Lang } from '../../lib/i18n'
import { compactAr, yenAr } from '../../lib/arFormat'
import { fmtCompact, fmtYen, PENDING, sumMetrics } from '../../lib/format'
import type { EconomicsFigures, Metric } from '../../types/economics'

/** A data string (name, note, label) in Arabic from the ar*.json dictionary, else as is. */
export const arOr = (s: string): string => arText(s) ?? s

/** The string for `lang` when only English (and maybe Japanese) exist: Arabic by dictionary. */
export const dataText = (lang: Lang, en: string, ja?: string | null): string => (lang === 'ja' ? ja || en : lang === 'ar' ? arOr(en) : en)

const UNIT_AR: Record<string, string> = {
  'm/s': 'م/ث',
  'mm/h': 'مم/ساعة',
  mm: 'مم',
  cm: 'سم',
  h: 'ساعة',
  km: 'كم',
  min: 'دقيقة',
  '°C': '°م',
}

/** A unit label: "m/s" → "م/ث" in Arabic. */
export const unit = (u: string, lang: Lang): string => (lang === 'ar' ? (UNIT_AR[u] ?? u) : u)

/** A count of days in Arabic, with the noun agreeing with the number: يوم واحد، يومان، 3 أيام، 14 يوماً. */
export function daysAr(n: number): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومان'
  return n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`
}

/** "→ destination": the arrow points the reading way. */
export const arrow = (lang: Lang): string => (lang === 'ar' ? '←' : '→')

export const compact = (n: number, lang: Lang): string => (lang === 'ar' ? compactAr(n) : fmtCompact(n))

const PENDING_AR = '[قيد الانتظار]'

/** fmtMetric in the page's language. */
export function metric(m: Metric | undefined | null, lang: Lang, kind: 'yen' | 'count' = 'count'): string {
  if (!m || m.value === null || m.value === undefined) return lang === 'ar' ? PENDING_AR : PENDING
  if (lang !== 'ar') return kind === 'yen' ? fmtYen(m.value) : fmtCompact(m.value)
  return kind === 'yen' ? yenAr(m.value) : compactAr(m.value)
}

/** fmtLost in the page's language. */
export function lost(f: EconomicsFigures, lang: Lang): string {
  const o = f.opportunity_lost_yen
  const total = sumMetrics([o.overnight_gap, o.weather, o.idle_rooms])
  if (total === null) return lang === 'ar' ? PENDING_AR : PENDING
  return lang === 'ar' ? yenAr(total) : fmtYen(total)
}

/* ---------------- how a site's visitors are estimated (real_data.json) ---------------- */

const SIGNAL_AR: Record<string, string> = {
  'camera detections': 'رصدات الكاميرا',
  'vehicle counts': 'أعداد المركبات',
  'museum bookings': 'حجوزات المتحف',
  'hotel guests': 'نزلاء الفنادق',
  'nearest-camera proxy': 'مؤشر بديل من أقرب كاميرا',
  'survey proxy': 'مؤشر بديل من الاستبيان',
  'guests at the hotels in the feed': 'نزلاء الفنادق المشمولة في البيانات',
  'cars at the summit car parks': 'السيارات في مواقف القمة',
  'no signal': 'لا توجد إشارة',
}
const PER_AR: Record<string, string> = { guest: 'نزيل', response: 'رد', booking: 'حجز', car: 'سيارة', visitor: 'زائر' }

/** "FY2025" → "السنة المالية 2025". */
export const periodAr = (p: string): string => p.replace(/^FY(\d{4})$/, 'السنة المالية $1')

/** A measureLabel() text ("camera detections") in Arabic. */
export const signalAr = (s: string): string => SIGNAL_AR[s] ?? arOr(s)

/** A calibration method_text ("museum bookings x 1.76 visitors per booking (official 1,298,975, FY2025)") in Arabic. */
export function methodAr(en: string): string {
  const per = /^(.+?) x ([\d.,]+) visitors per (\w+) \(official ([\d,]+), (\w+)\)$/.exec(en)
  if (per) return `${signalAr(per[1])} × ${per[2]} زائر لكل ${PER_AR[per[3]] ?? per[3]} (الرقم الرسمي ${per[4]}، ${periodAr(per[5])})`
  const div = /^(.+?) \/ ([\d.,]+) detections per visitor \(official ([\d,]+), (\w+)\)$/.exec(en)
  if (div) return `${signalAr(div[1])} ÷ ${div[2]} رصد لكل زائر (الرقم الرسمي ${div[3]}، ${periodAr(div[4])})`
  return arOr(en)
}

const NAIVE_EN = 'Mean of recent same weekdays (up to 4 in the last 8 weeks; holidays skipped for a normal day), real visitors_est, spread over the day with the demo hourly shape.'
const NAIVE_AR = 'متوسط الأيام المماثلة من الأسبوع مؤخراً (حتى 4 أيام خلال آخر 8 أسابيع، مع استبعاد العطلات عند حساب اليوم العادي)، من تقدير الزوار الحقيقي، موزّعاً على ساعات اليوم بالشكل التجريبي.'

/** real.ts forecastMethod() text in Arabic. */
export function forecastMethodAr(en: string): string {
  if (en === NAIVE_EN) return NAIVE_AR
  const m = /^7-day model forecast \((.+?)\) up to (\S+): backtest error (\S+) vs (\S+) for "same weekday last week"; its range held (\S+) of unseen backtest days\. .*?(?:(\d{4}-\d\d-\d\d(?:, \d{4}-\d\d-\d\d)*): the week-ahead bookings were late.*?)?Later days: /.exec(en)
  if (!m) return arOr(en)
  return (
    `توقع النموذج لسبعة أيام (${m[1]}) حتى ${m[2]}: خطأ الاختبار الرجعي ${m[3]} مقابل ${m[4]} لطريقة "اليوم نفسه من الأسبوع الماضي"، وغطّى نطاقه ${m[5]} من أيام الاختبار غير المستخدمة في التدريب. ` +
    'يُحوَّل بالمعامل نفسه المستخدم للبيانات السابقة ويُوزَّع على ساعات اليوم بالشكل التجريبي. ' +
    (m[6] ? `${m[6]}: وصلت حجوزات الأسبوع المقبل متأخرة، لذا تستخدم هذه الأيام متوسط الأيام المماثلة. ` : '') +
    `الأيام اللاحقة: ${NAIVE_AR}`
  )
}
