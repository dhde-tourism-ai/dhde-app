import { useEffect, useRef, useState } from 'react'
import type { TransportTripsFile } from '../../../types/transport'
import { nextBuses } from '../../../lib/busSchedule'
import { nextTrains } from '../../../lib/railModel'
import type { RailRun } from '../../../lib/railModel'
import { clock, dayTypeOf, vehicleClock } from '../../../lib/vehicleClock'
import { useLang } from '../../../lib/i18n'
import { placeEn, routeEn } from '../../../lib/transportNames'

/** Re-render every 2 s while shown (hover cards stay mounted once opened, so skip when hidden). */
function useTicking() {
  const ref = useRef<HTMLDivElement>(null)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (ref.current?.offsetParent) tick((n) => n + 1)
    }, 2000)
    return () => window.clearInterval(id)
  }, [])
  return ref
}

function ClockLabel() {
  const { t } = useLang()
  const mode = vehicleClock.mode()
  const live = mode === 'live'
  return (
    <span className={`sched-clock${live ? ' live' : ''}`}>
      {live ? t('Live', 'ライブ') : mode === 'run' ? t('Simulated', 'シミュレーション') : t('Preview', 'プレビュー')} {clock(vehicleClock.minute())}
    </span>
  )
}

/** A bus stop's next departures from the bus timetables, at the vehicle clock's time. */
export function BusStopSchedule({ trips, stopId }: { trips: TransportTripsFile | null; stopId: string }) {
  const { t, lang } = useLang()
  const ref = useTicking()
  if (!trips) return null
  const rows = nextBuses(trips, dayTypeOf(vehicleClock.date()), stopId, Math.floor(vehicleClock.minute()))
  return (
    <div ref={ref} className="sched">
      <div className="sched-head">
        {t('Next buses', '次のバス')} <ClockLabel />
      </div>
      {rows.length === 0 ? (
        <div className="sched-none">{t('No more buses today', '本日の運行は終了')}</div>
      ) : (
        rows.map((r, i) => (
          <div key={i} className="sched-row">
            <span className="num">{clock(r.min)}</span>
            <span>
              {lang === 'ja' ? r.route : routeEn(r.route)} <span className="sched-to">→ {lang === 'ja' ? r.to : placeEn(r.to)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/** A station's next trains on the illustrative rail model. */
export function StationSchedule({ runs, stationId }: { runs: RailRun[]; stationId: string }) {
  const { t, lang } = useLang()
  const ref = useTicking()
  const rows = nextTrains(runs, stationId, vehicleClock.minute())
  if (!runs.some((r) => r.stops.some((s) => s.id === stationId))) return null
  return (
    <div ref={ref} className="sched">
      <div className="sched-head">
        {t('Next trains', '次の列車')} <span className="sched-ill">{t('Illustrative', '参考')}</span> <ClockLabel />
      </div>
      {rows.length === 0 ? (
        <div className="sched-none">{t('No more trains today', '本日の運行は終了')}</div>
      ) : (
        rows.map((r, i) => (
          <div key={i} className="sched-row">
            <span className="num">{clock(r.min)}</span>
            <span>
              {t(...r.line)} <span className="sched-to">→ {lang === 'ja' ? r.to : placeEn(r.to)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  )
}
