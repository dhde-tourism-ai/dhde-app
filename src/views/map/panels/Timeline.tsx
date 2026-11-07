import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { LiveData } from '../../../types/live'
import { useLang } from '../../../lib/i18n'
import { dayLabel, hourLabel } from '../../../lib/live'
import { clock, vehicleClock } from '../../../lib/vehicleClock'
import { Icon } from '../../../components/icons'
import { SourceBadge } from '../../../components/SourceBadge'

/** Equal-width hours and days keep the past and forecast on the same time scale. */
function xOf(i: number, hours: number): number {
  return i / Math.max(1, hours)
}

function iOf(x: number, hours: number): number {
  return Math.max(0, Math.min(hours - 1, Math.floor(x * hours)))
}

interface Props {
  live: LiveData
  t: number
  setT: (i: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  speed: number
  setSpeed: (s: number) => void
  /** Moving buses or trains are on: show their clock (live at Now, else a preview of the hour). */
  vehicles?: boolean
}

/** The vehicle clock, ticking: HH:MM:SS live, HH:MM in a preview. */
function VehicleTime({ live }: { live: boolean }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), live ? 1000 : 200)
    return () => window.clearInterval(id)
  }, [live])
  const m = vehicleClock.minute()
  const secs = Math.floor((m % 1) * 60)
  return <span className="tl-hour num">{clock(m)}{live ? `:${String(secs).padStart(2, '0')}` : ''}</span>
}

export function Timeline({ live, t, setT, playing, setPlaying, speed, setSpeed, vehicles = false }: Props) {
  const { t: tr, lang } = useLang()
  const track = useRef<HTMLDivElement>(null)
  const H = live.hours
  const now = live.observed_until
  const nowIdx = live.now_index ?? now
  const todayDay = live.today_day ?? 0
  const pastDays = todayDay
  const futureDays = Math.max(0, live.days.length - todayDay - 1)
  const rangeLabel = tr(`Past ${pastDays} days · Today · Next ${futureDays} days`, `過去${pastDays}日間・今日・今後${futureDays}日間`, `آخر ${pastDays} أيام · اليوم · الأيام ${futureDays} القادمة`)
  const demoOnly = !live.sources?.people || live.sources.people.status === 'demo'
  const observed = t <= now
  const isLive = !playing && t === nowIdx

  // Total people on site across all nodes, per hour: the day's rhythm behind the scrubber.
  const spark = useMemo(() => {
    const tot = Array.from({ length: live.hours }, (_, i) =>
      Object.values(live.nodes).reduce((a, n) => a + (n.on_site.actual[i] ?? n.on_site.predicted[i] ?? 0), 0),
    )
    const max = Math.max(1, ...tot)
    const pts = tot.map((v, i) => `${(xOf(i + 0.5, live.hours) * 1000).toFixed(1)},${(40 - (v / max) * 36).toFixed(1)}`)
    return `M0,40 L${pts.join(' L')} L1000,40 Z`
  }, [live])

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    setT(iOf((e.clientX - r.left) / r.width, H))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 24, PageDown: -24 }
    if (e.key in step) {
      e.preventDefault()
      setPlaying(false)
      setT(Math.max(0, Math.min(H - 1, t + step[e.key])))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPlaying(false)
      setT(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPlaying(false)
      setT(H - 1)
    }
  }

  const dateLabels = useMemo(() => {
    const locale = lang === 'ja' ? 'ja-JP' : lang === 'ar' ? 'ar' : 'en-GB'
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'Asia/Tokyo' })
    const monthDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' })
    return live.days.map(({ date }) => {
      const at = new Date(`${date}T12:00:00+09:00`)
      return { weekday: weekday.format(at), date: monthDay.format(at) }
    })
  }, [live.days, lang])

  const day = Math.floor(t / 24)
  const valueText = `${dayLabel(live, day, lang)} ${hourLabel(t)}, ${demoOnly ? tr('demo', 'デモ', 'تجريبي') : observed ? tr('estimated', '推計', 'تقديري') : tr('forecast', '予測')}`

  return (
    <div className="timeline" aria-label={tr('Timeline', 'タイムライン')}>
      <button className="play-btn" onClick={() => setPlaying(!playing)} aria-label={playing ? tr('Pause', '一時停止') : tr('Play', '再生')}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>

      <div className="tl-readout">
        <strong className="tl-title">{tr('Visitor Trends & Forecast', '来訪者の推移と予測', 'اتجاهات الزوار والتوقعات')}</strong>
        <div className="tl-time">
          <span className="tl-day">{dayLabel(live, day, lang)}</span>
          {/* While playing, the timeline's hour (the vehicles run on at their own, slower pace). */}
          {vehicles && !playing ? <VehicleTime live={isLive} /> : <span className="tl-hour num">{hourLabel(t)}</span>}
          <span className="tl-zone">JST</span>
        </div>
        {vehicles && !isLive && !playing ? (
          <span className="tl-mode run" title={tr('Off Now, buses and trains are simulated from the time shown (scheduled positions)', '現在以外の時刻：表示時刻からのシミュレーション（時刻表上の位置）')}>
            {tr('Simulated', 'シミュレーション')}
          </span>
        ) : vehicles && isLive ? (
          <span className="tl-mode live" title={tr('Buses and trains on the real clock (scheduled positions, not GPS)', '実時刻のバス・列車（時刻表上の位置、GPSではない）')}>
            {tr('Live', 'ライブ')}
          </span>
        ) : (
          <span className={`tl-mode ${observed ? 'obs' : 'fc'}`}>{demoOnly ? tr('Demo', 'デモ', 'تجريبي') : observed ? tr('Estimated', '推計', 'تقديري') : tr('Forecast', '予測')}</span>
        )}
      </div>

      <div className="tl-track-wrap">
        <div className="tl-chart-heading">
          <span className="tl-range">{rangeLabel}</span>
          <span>{tr('Estimated people on site · all available sites', '推計滞在人数・データのある全地点', 'الأشخاص المقدّرون في المواقع · جميع المواقع المتاحة')}</span>
          <span>{tr('Drag to update map · shaded = forecast', 'ドラッグで地図の時刻を変更・斜線＝予測', 'اسحب لتحديث الخريطة · التظليل = توقعات')}</span>
        </div>
        <div
          ref={track}
          className="tl-track"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={H - 1}
          aria-valuenow={t}
          aria-valuetext={valueText}
          aria-label={tr('Time', '時刻')}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setPlaying(false)
            pick(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) pick(e)
          }}
        >
          <svg className="tl-spark" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
            <path d={spark} />
          </svg>
          <div className="tl-future" style={{ left: `${xOf(now + 1, H) * 100}%` }}></div>
          {live.days.map((d, k) => (
            <div key={d.date} className={`tl-day-seg ${k === 0 ? 'first' : ''} ${k === todayDay ? 'today' : ''} ${k < todayDay ? 'past' : ''} ${d.weekend ? 'wknd' : ''}`} style={{ left: `${xOf(k * 24, H) * 100}%`, width: `${(xOf((k + 1) * 24, H) - xOf(k * 24, H)) * 100}%` }}>
              <span className="tl-day-lab">
                <span>{dateLabels[k].weekday}</span>
                <span>{dateLabels[k].date}</span>
              </span>
              {k === todayDay && <span className="tl-today-label">{tr('Today', '今日', 'اليوم')}</span>}
            </div>
          ))}
          <div className="tl-now" style={{ left: `${xOf(now + 0.5, H) * 100}%` }} title={tr('Latest observation', '最新の観測')}>
            <span>{tr('Latest data', '最新データ', 'أحدث البيانات')}</span>
          </div>
          {nowIdx !== now && <div className="tl-clock" style={{ left: `${xOf(nowIdx + 0.5, H) * 100}%` }} title={tr('Now', '現在')}></div>}
          <div className="tl-thumb" style={{ left: `${xOf(t + 0.5, H) * 100}%` }}></div>
        </div>
      </div>

      <div className="tl-controls">
        <div className="seg" role="group" aria-label={tr('Playback speed', '再生速度')}>
          {[1, 2, 4].map((s) => (
            <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost tl-nowbtn"
          onClick={() => {
            setPlaying(false)
            setT(nowIdx)
          }}
        >
          <Icon name="now" /> {tr('Now', '現在')}
        </button>
        {live.demo && <SourceBadge info={live.sources?.people} kind={observed ? 'estimated' : 'forecast'} compact note={['Past days: calibrated daily visitor estimates with a simulated hourly shape. Future days: forecast.', '過去日：日合計は校正済みの推計、時間別は模擬。将来日：予測。']} />}
      </div>
    </div>
  )
}
