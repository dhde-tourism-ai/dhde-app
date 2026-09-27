import { ICON_PATHS, weatherSvg } from '../lib/icons'
import type { IconName } from '../lib/icons'
import type { WeatherCondition } from '../types/live'

export function Icon({ name, size = 16, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + ICON_PATHS[name] }}
    />
  )
}

export function WeatherIcon({ cond, size = 18 }: { cond: WeatherCondition; size?: number }) {
  return <span className="wx-icon" dangerouslySetInnerHTML={{ __html: weatherSvg(cond, size) }} />
}

