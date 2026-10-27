import { useJsonResource } from '../../hooks/useJsonResource'
import type { TransportMapFile } from '../../types/transport'
import type { RailRun } from '../../lib/railModel'
import { TransportLayer } from '../map/layers/TransportLayer'
import '../../styles/map-layers.css'

const NO_RUNS: RailRun[] = []

/**
 * Bus routes, stops, walking areas, railway lines and stations on a site map: the
 * main map's Bus and Train routes layers, without the illustrative train service
 * or moving vehicles, so everything drawn is real.
 */
export function SiteTransit() {
  const map = useJsonResource<TransportMapFile>('transport_map.json').data
  if (!map) return null
  return <TransportLayer data={map} bus rail trips={null} runs={NO_RUNS} />
}
