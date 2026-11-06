import { SITE_ID } from '../lib/siteMode'
import { useCallback, useEffect, useState } from 'react'

export type ViewId = 'summary' | 'map' | 'nodes' | 'transport' | 'strategy' | 'site'

export interface Route {
  view: ViewId
  /** Optional node id for #/nodes/<id>, #/map/<id> and #/site/<id>. */
  node?: string
}

const VIEWS: ViewId[] = ['summary', 'map', 'nodes', 'transport', 'strategy', 'site']

function parse(hash: string): Route {
  const [, view, node] = hash.replace(/^#/, '').split('/')
  if (SITE_ID) {
    if (view === 'site' && node === SITE_ID) return { view: 'site', node: SITE_ID }
    if (view === 'map' && (!node || node === SITE_ID)) return { view: 'map', node }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/map`)
    return { view: 'map' }
  }
  // No or unknown hash opens the map.
  const v = VIEWS.includes(view as ViewId) ? (view as ViewId) : 'map'
  return { view: v, node: node ? decodeURIComponent(node) : undefined }
}

/** Tiny hash router (#/summary, #/map, #/nodes/<id>, #/strategy, #/site/<id>): works on static hosting with no server rewrites. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((r: Route) => {
    window.location.hash = `/${r.view}${r.node ? '/' + encodeURIComponent(r.node) : ''}`
  }, [])

  return [route, navigate]
}
