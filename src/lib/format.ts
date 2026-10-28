import type { Metric } from '../types/economics'

export const PENDING = '[pending]'

/** Compact number: 1.2M, 340k, 5,546; with lang 'ar': 1.2 مليون, 340 ألف (same rounding). */
export function fmtCompact(n: number, lang: 'en' | 'ja' | 'ar' = 'en'): string {
  const a = Math.abs(n)
  const ar = lang === 'ar'
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + (ar ? ' مليار' : 'bn')
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + (ar ? ' مليون' : 'M')
  if (a >= 1e4) return Math.round(n / 1e3) + (ar ? ' ألف' : 'k')
  return Math.round(n).toLocaleString('en-US')
}

/** Yen, compact: ¥12bn, ¥340M; in Arabic 12 مليار ين. */
export function fmtYen(n: number, lang: 'en' | 'ja' | 'ar' = 'en'): string {
  return lang === 'ar' ? `${fmtCompact(n, lang)} ين` : '¥' + fmtCompact(n)
}

/** A Metric's value, or "[pending]" when null. Never invents a number. */
export function fmtMetric(m: Metric | undefined | null, kind: 'yen' | 'count' = 'count', lang: 'en' | 'ja' | 'ar' = 'en'): string {
  if (!m || m.value === null || m.value === undefined) return lang === 'ar' ? '[غير متوفر بعد]' : PENDING
  return kind === 'yen' ? fmtYen(m.value, lang) : fmtCompact(m.value, lang)
}

/** Sum of metrics, or null if any is pending. */
export function sumMetrics(ms: Metric[]): number | null {
  let total = 0
  for (const m of ms) {
    if (m.value === null || m.value === undefined) return null
    total += m.value
  }
  return total
}

/** "27 Sep 2026" from an ISO date or datetime. */
export function fmtDate(iso: string | undefined | null, lang: 'en' | 'ja' | 'ar' = 'en'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  if (lang === 'ja') return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  // Gregorian calendar and Western digits, like the rest of the dashboard's numbers.
  if (lang === 'ar') return d.toLocaleDateString('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* JMA forecast text ("くもり 時々 雨") word by word in Arabic, for the Arabic page. */
const JMA_WORD: Record<string, string> = {
  晴れ: 'صحو',
  晴: 'صحو',
  くもり: 'غائم',
  曇り: 'غائم',
  雨: 'مطر',
  大雨: 'مطر غزير',
  雪: 'ثلج',
  大雪: 'ثلج كثيف',
  みぞれ: 'مطر وثلج',
  雷: 'رعد',
  霧: 'ضباب',
  暴風: 'رياح شديدة',
  時々: 'وأحيانًا',
  一時: 'ولفترة',
  のち: 'ثم',
  後: 'ثم',
  から: '',
  で: '',
  を伴う: '',
  強く: 'بغزارة',
  降る: '',
  止む: 'يتوقف',
}
const JMA_WHEN: Record<string, string> = {
  所により: 'في بعض المناطق',
  朝: 'صباحًا',
  明け方: 'فجرًا',
  昼前: 'قبل الظهر',
  昼頃: 'ظهرًا',
  昼過ぎ: 'بعد الظهر',
  日中: 'نهارًا',
  夕方: 'مساءً',
  夜: 'ليلًا',
  夜のはじめ頃: 'أول الليل',
  夜遅く: 'آخر الليل',
  夜半: 'منتصف الليل',
  朝晩: 'صباحًا ومساءً',
}

/** "غائم، بعد الظهر وأحيانًا مطر، في بعض المناطق مع رعد"; the Japanese text when a word is unknown. */
export function jmaWeatherAr(ja: string): string {
  const words = ja.split(/[\s\u3000]+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w in JMA_WHEN) {
      if (out.length) out[out.length - 1] += '،'
      out.push(JMA_WHEN[w])
    } else if (w === '雷' && words[i + 1] === 'を伴う') {
      out.push('مع رعد')
      i++
    } else if (w in JMA_WORD) {
      if (JMA_WORD[w]) out.push(JMA_WORD[w])
    } else {
      return ja
    }
  }
  return out.join(' ').replace(/،$/, '') || ja
}

