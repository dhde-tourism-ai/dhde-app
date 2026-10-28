import { compactAr, MON_AR } from '../../lib/arFormat'
import { fmtCompact, fmtYen } from '../../lib/format'
import type { Lang } from '../../lib/i18n'

/**
 * Number and month formats for the Summary and Strategy pages in the page's
 * language: Arabic gets words (مليون، مليار، ين) where English has M, bn and ¥.
 */

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Month `i` (0 = January): Jan / 1月 / يناير. */
export const monthName = (i: number, lang: Lang): string => (lang === 'ja' ? `${i + 1}月` : lang === 'ar' ? MON_AR[i] : MONTHS_EN[i])

/** Compact number with fmtCompact's rounding: 1.2M, 340k, 5,546; in Arabic 1.2 مليون, 340 ألف. */
export function compact(v: number, lang: Lang): string {
  if (lang !== 'ar') return fmtCompact(v)
  const a = Math.abs(v)
  if (a < 1e4) return Math.round(v).toLocaleString('en-US')
  return compactAr(v, a >= 1e9 ? (a >= 1e10 ? 0 : 1) : a >= 1e6 ? (a >= 1e7 ? 0 : 1) : 0)
}

/** Compact yen: ¥12bn; in Arabic 12 مليار ين. */
export const yen = (v: number, lang: Lang): string => (lang === 'ar' ? `${compact(v, lang)} ين` : fmtYen(v))

const UNIT_AR: Record<string, string> = { M: 'مليون', bn: 'مليار', tn: 'تريليون', k: 'ألف', m: 'مليون' }

/** A figure with the data's prefix and unit (¥ … bn, … M, … %): "¥198.7bn" or "198.7 مليار ين". */
export function withUnit(v: number | string, prefix: string, unit: string, lang: Lang): string {
  const n = typeof v === 'number' ? v.toLocaleString('en-US') : v
  if (lang !== 'ar') return `${prefix}${n}${unit}`
  const word = UNIT_AR[unit]
  const u = word ? ` ${word}` : unit
  return `${prefix === '¥' ? '' : prefix}${n}${u}${prefix === '¥' ? ' ين' : ''}`
}

/** Short figures inside a data string ("400k − 108.6k", "21.44M × ¥24,675") in Arabic words; other languages unchanged. */
export function figures(text: string, lang: Lang): string {
  if (lang !== 'ar') return text
  return text
    .replace(/(¥)?(\[?\d[\d.,]*\]?)(bn|tn|M|m|k)?\b/g, (all, y: string | undefined, n: string, u: string | undefined) => (y || u ? withUnit(n, y ?? '', u ?? '', lang) : all))
}

/** The left-to-right arrow of the English text, pointing the reading way in Arabic. */
export const arrow = (lang: Lang): string => (lang === 'ar' ? '←' : '→')
