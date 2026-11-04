import type { Site } from './siteTypes'
import tojinbo from './siteGeometry/tojinbo'
import eiheiji from './siteGeometry/eiheiji'
import rainbow_line from './siteGeometry/rainbow_line'
export type { Site, SitePosition, SitePolygon } from './siteTypes'
/** Static build branches let Rollup discard other sites' geometry. */
export const SITES: Record<string, Site> = import.meta.env.VITE_SITE === 'tojinbo' ? { tojinbo } : import.meta.env.VITE_SITE === 'eiheiji' ? { eiheiji } : import.meta.env.VITE_SITE === 'rainbow_line' ? { rainbow_line } : { tojinbo, eiheiji, rainbow_line }
