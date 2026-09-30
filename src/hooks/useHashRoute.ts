import { useCallback, useEffect, useState } from 'react'

export type ViewId = 'summary' | 'map' | 'nodes' | 'strategy'

export interface Route {
  view: ViewId
  /** Optional node id for #/nodes/<id> and #/map/<id>. */
  node?: string
}

const VIEWS: ViewId[] = ['summary', 'map', 'nodes', 'strategy']

function parse(hash: string): Route {
  const [, view, node] = hash.replace(/^#/, '').split('/')
  // No or unknown hash opens the executive summary.
  const v = VIEWS.includes(view as ViewId) ? (view as ViewId) : 'summary'
  return { view: v, node: node ? decodeURIComponent(node) : undefined }
}

/** Tiny hash router (#/summary, #/map, #/nodes/<id>, #/strategy): works on static hosting with no server rewrites. */
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
