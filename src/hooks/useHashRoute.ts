import { useCallback, useEffect, useState } from 'react'

export type ViewId = 'map' | 'nodes' | 'strategy'

export interface Route {
  view: ViewId
  /** Optional node id for #/nodes/<id> and #/map/<id>. */
  node?: string
}

const VIEWS: ViewId[] = ['map', 'nodes', 'strategy']

function parse(hash: string): Route {
  const [, view, node] = hash.replace(/^#/, '').split('/')
  const v = VIEWS.includes(view as ViewId) ? (view as ViewId) : 'map'
  return { view: v, node: node ? decodeURIComponent(node) : undefined }
}

/** Tiny hash router (#/map, #/nodes/<id>, #/strategy): works on static hosting with no server rewrites. */
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
