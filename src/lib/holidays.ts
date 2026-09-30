/**
 * Japanese public holidays (substitute and citizens' holidays included), so the
 * naive same-weekday forecast doesn't average a holiday spike into a normal day.
 * Extend the list each year; a date missing here just counts as a normal day.
 */
const HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-02-24', '2025-03-20',
  '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05', '2025-05-06', '2025-07-21',
  '2025-08-11', '2025-09-15', '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23',
  '2025-11-24',
  // 2026
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29',
  '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11',
  '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23',
  // 2027
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22',
  '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11',
  '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23',
])

/**
 * A public holiday, the New Year break (29 Dec to 3 Jan, as in the pipeline's
 * day_off) or Obon (13 to 16 Aug, the pipeline's is_obon): not public holidays,
 * but busy like one, so a normal day shouldn't average them in.
 */
export function isHoliday(iso: string): boolean {
  const md = iso.slice(5)
  return HOLIDAYS.has(iso) || md >= '12-29' || md <= '01-03' || (md >= '08-13' && md <= '08-16')
}
