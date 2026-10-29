/**
 * Arabic forms of the dashboard's short number and date formats. Digits stay
 * Western here; arabicDigits.ts swaps them on the page.
 */
export const DOW_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

const trim = (x: number, d: number) => String(Number(x.toFixed(d)))

/** 1.2 مليار / 3.4 مليون / 56 ألف / 789. */
export function compactAr(v: number, digits = 1): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `${trim(v / 1e9, digits)} مليار`
  if (a >= 1e6) return `${trim(v / 1e6, digits)} مليون`
  if (a >= 1e3) return `${trim(v / 1e3, digits)} ألف`
  return `${Math.round(v)}`
}

/** Yen amounts: "8.76 مليار ¥". */
export const yenAr = (v: number, digits = 1): string => `${compactAr(v, digits)} ¥`

/** "الأربعاء 28 أكتوبر" from a Date (UTC parts, like the other day labels). */
export const dayAr = (d: Date, short = false): string =>
  short ? `${DOW_AR[d.getUTCDay()]} ${d.getUTCDate()}` : `${DOW_AR[d.getUTCDay()]} ${d.getUTCDate()} ${MON_AR[d.getUTCMonth()]}`
