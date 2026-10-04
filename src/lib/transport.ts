import type { DayType, PublishStatus, TransportFile, TransportMode, TransportNode, TransportSource } from '../types/transport'

export const MODE_COLOUR: Record<TransportMode, string> = {
  rail: '#f0a43a',
  bus: '#4fb3ff',
  car: '#9aa7c0',
  ferry: '#5fd3c4',
}

/** Railway lines and stations on the map's Public transport layer. */
export const RAIL_LINE_COLOUR = '#e5484d'

export const MODE_LABEL: Record<TransportMode, [string, string]> = {
  rail: ['Rail', '鉄道'],
  bus: ['Bus', 'バス'],
  car: ['Car', '車'],
  ferry: ['Ferry', 'フェリー'],
}

export const DAY_LABEL: Record<DayType, [string, string]> = {
  weekday: ['Weekday', '平日'],
  saturday: ['Saturday', '土曜'],
  sunday: ['Sunday / holiday', '日祝'],
}

/** Day type of a date for the access card (Japanese holidays count as Sunday). */
export function dayTypeOf(d: Date, isHoliday: (d: Date) => boolean): DayType {
  if (isHoliday(d) || d.getDay() === 0) return 'sunday'
  return d.getDay() === 6 ? 'saturday' : 'weekday'
}

/**
 * Feeds behind a node's numbers: the ones calling at the node, plus every feed
 * when journeys from the hub are shown, since a journey can use any of them.
 */
export function sourcesFor(file: TransportFile, node: TransportNode): TransportSource[] {
  const journeys = Object.values(node.days).some((d) => d?.from_hub || d?.to_hub)
  return file.sources.filter((s) => journeys || node.feeds.includes(s.id))
}

/** Worst publish status among the feeds behind a node's numbers. */
export function worstStatus(sources: TransportSource[]): PublishStatus {
  if (sources.some((s) => s.publish_status === 'research_only')) return 'research_only'
  if (sources.some((s) => s.publish_status === 'check')) return 'check'
  return 'ok'
}

/** "17:06" -> minutes after midnight; "24:02" stays 1442. */
export function clockMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** "24:02" -> "00:02 (+1)" for display. */
export function clockLabel(hhmm: string | null | undefined): string {
  const m = clockMinutes(hhmm)
  if (m == null) return '—'
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  return h >= 24 ? `${String(h - 24).padStart(2, '0')}:${mm} (+1)` : `${String(h).padStart(2, '0')}:${mm}`
}

/** Departures of 17:30 or earlier back to the hub cut the evening short: the day-trip hypothesis. */
export const EARLY_LAST_RETURN_MIN = 17 * 60 + 30

export function fmtMinutes(min: number | null | undefined, lang: string): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (lang === 'ja') return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
