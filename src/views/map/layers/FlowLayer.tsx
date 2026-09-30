import { useEffect } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import type { LiveData } from '../../../types/live'
import type { RoutesFile } from '../../../types/routes'
import { FlowCanvas } from '../canvas/FlowCanvas'
import type { Stream } from '../canvas/FlowCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'
import { reversePath, routeById } from '../../../lib/routes'
import { activeAdvisories } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'

export const ARRIVE = '#3987e5'
export const DEPART = '#d55181'

/** Share of a corridor's flow that follows the recommended alternate while an advisory is active. */
const DIVERT = 0.4

function streamFor(key: string, path: [number, number][], flow: number, dir: 1 | -1, rail: boolean): Stream {
  const v = Math.min(1, flow / 400)
  return {
    key,
    path,
    colour: dir === 1 ? ARRIVE : DEPART,
    kind: rail ? 'rail' : 'person',
    // Density and speed both scale with volume: a busy road reads as a dense, brisk stream.
    density: flow <= 0 ? 0 : 0.6 + flow / 45,
    speed: (22 + 40 * v) * (rail ? 1.9 : 1),
    lane: rail ? 2.5 : 3.2,
    size: rail ? 2.8 : 2.6,
  }
}

/**
 * People flow: particles moving along real road geometry (and the shinkansen)
 * in both directions, density and speed proportional to people per hour.
 */
export function FlowLayer({ live, routes, t, paused }: { live: LiveData; routes: RoutesFile; t: number; paused: boolean }) {
  const { t: tr } = useLang()
  const canvas = useLeafletLayer(() => new FlowCanvas())
  useEffect(() => {
    canvas.setPaused(paused)
  }, [canvas, paused])

  useEffect(() => {
    const adv = activeAdvisories(live, t)
    const streams: Stream[] = []
    for (const [rid, f] of Object.entries(live.flows)) {
      const r = routeById(routes, rid)
      if (!r) continue
      const rail = f.mode === 'rail'
      let fw = f.forward[t] ?? 0
      let rv = f.reverse[t] ?? 0
      const a = adv.find((x) => x.corridor === rid)
      const alt = a && routeById(routes, a.alternate)
      if (alt) {
        streams.push(streamFor(`${alt.id}:f`, alt.path, fw * DIVERT, 1, false))
        streams.push(streamFor(`${alt.id}:r`, reversePath(alt.path), rv * DIVERT, -1, false))
        fw *= 1 - DIVERT
        rv *= 1 - DIVERT
      }
      streams.push(streamFor(`${rid}:f`, r.path, fw, 1, rail))
      streams.push(streamFor(`${rid}:r`, reversePath(r.path), rv, -1, rail))
    }
    canvas.setStreams(streams)
  }, [canvas, live, routes, t])

  return (
    <>
      {Object.entries(live.flows).map(([rid, f]) => {
        const r = routeById(routes, rid)
        if (!r) return null
        const rail = f.mode === 'rail'
        return (
          <Polyline
            key={rid}
            positions={r.path}
            pathOptions={{
              color: rail ? '#c9d4ff' : '#dfe7f5',
              weight: rail ? 2 : 2.5,
              opacity: rail ? 0.55 : 0.28,
              dashArray: rail ? '2 7' : undefined,
              lineCap: 'round',
            }}
          >
            <Tooltip sticky className="map-tip">
              <strong>{tr(r.label, r.label_ja)}</strong>
              <div className="tip-row">
                <i className="k-line" style={{ borderColor: ARRIVE }}></i>
                {tr('Arriving', '到着')} <b className="num">{(f.forward[t] ?? 0).toLocaleString('en-US')}</b> {tr('people/h', '人/時')}
              </div>
              <div className="tip-row">
                <i className="k-line" style={{ borderColor: DEPART }}></i>
                {tr('Departing', '出発')} <b className="num">{(f.reverse[t] ?? 0).toLocaleString('en-US')}</b> {tr('people/h', '人/時')}
              </div>
              <div className="tip-sub">
                {rail ? tr('Hokuriku Shinkansen, line approximate', '北陸新幹線（線形は概略）') : `${r.distance_km} km · ${r.duration_min} min ${tr('by road', '（道路）')}`}
              </div>
            </Tooltip>
          </Polyline>
        )
      })}
    </>
  )
}
