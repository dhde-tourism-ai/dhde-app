import { isHoliday } from './holidays'

/** How many weeks back to look for the same weekday, and how many of those days to average. */
export const NORMAL_WEEKS = 8
export const NORMAL_DAYS = 4

const addDays = (iso: string, k: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + k)
  return d.toISOString().slice(0, 10)
}

/** Median: one Silver Week day or one glitchy count doesn't move it. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * A site's normal day for `date`: the median visitors of the last NORMAL_DAYS same
 * weekdays measured in the NORMAL_WEEKS weeks before it, holidays and Obon left out
 * (a holiday Tuesday isn't a normal one). Null with fewer than two such days.
 *
 * The demand alerts (nudges.ts, loop #1) and the Strategy 7-day card both use it,
 * so they can't disagree. It replaced the mean over the whole ~90-day history, which
 * held the summer and Silver Week peaks: an ordinary autumn day read as -60 to -78%
 * against it, and one site filled the Summary's top 3 with "quiet day" alerts.
 *
 * A median, and so is the naive forecast it's compared with on days without a model
 * forecast (real.ts): the two changed together, as Dina asked on #26, so those days
 * read about 0% and only the model's forecast raises an alert. A mean was thrown by
 * single days: Katsuyama's Silver Week Sunday (30,673 against ~6,500) made an
 * ordinary Sunday read -55%, and Awara's 93 on 2 Sep made a normal Wednesday +67%.
 */
export function weekdayNormal(valueOn: (date: string) => number | null | undefined, date: string): number | null {
  const vals: number[] = []
  for (let w = 1; w <= NORMAL_WEEKS && vals.length < NORMAL_DAYS; w++) {
    const day = addDays(date, -7 * w)
    const v = valueOn(day)
    if (v !== null && v !== undefined && !isHoliday(day)) vals.push(v)
  }
  return vals.length >= 2 ? median(vals) : null
}
