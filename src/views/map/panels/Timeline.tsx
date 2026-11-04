import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { LiveData } from '../../../types/live'
import { useLang } from '../../../lib/i18n'
import { dayLabel, hourLabel } from '../../../lib/live'
import { clock, vehicleClock } from '../../../lib/vehicleClock'
import { Icon } from '../../../components/icons'
import { SourceBadge } from '../../../components/SourceBadge'

/** Track shares: observed past days (when real data adds them), today (hourly), the next days. */
interface Scale {
  t0: number
  hours: number
  pastW: number
  todayW: number
}

function scaleFor(live: LiveData): Scale {
  const t0 = (live.today_day ?? 0) * 24
  return { t0, hours: live.hours, pastW: t0 > 0 ? 0.2 : 0, todayW: t0 > 0 ? 0.3 : 0.36 }
}

function xOf(i: number, s: Scale): number {
  const rest = Math.max(1, s.hours - s.t0 - 24)
  if (i <= s.t0) return s.t0 > 0 ? (i / s.t0) * s.pastW : 0
  const j = i - s.t0
  if (j <= 24) return s.pastW + (j / 24) * s.todayW
  return s.pastW + s.todayW + ((j - 24) / rest) * (1 - s.pastW - s.todayW)
}

function iOf(x: number, s: Scale): number {
  const rest = Math.max(1, s.hours - s.t0 - 24)
  let i: number
  if (x <= s.pastW && s.t0 > 0) i = (x / s.pastW) * s.t0
  else if (x <= s.pastW + s.todayW) i = s.t0 + ((x - s.pastW) / s.todayW) * 24
  else i = s.t0 + 24 + ((x - s.pastW - s.todayW) / (1 - s.pastW - s.todayW)) * rest
  return Math.max(0, Math.min(s.hours - 1, Math.round(i)))
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
  const sc = scaleFor(live)
  const todayDay = live.today_day ?? 0
  const observed = t <= now
  const isLive = !playing && t === nowIdx

  // Total people on site across all nodes, per hour: the day's rhythm behind the scrubber.
  const spark = useMemo(() => {
    const s2 = scaleFor(live)
    const tot = Array.from({ length: live.hours }, (_, i) =>
      Object.values(live.nodes).reduce((a, n) => a + (n.on_site.actual[i] ?? n.on_site.predicted[i] ?? 0), 0),
    )
    const max = Math.max(1, ...tot)
    const pts = tot.map((v, i) => `${(xOf(i + 0.5, s2) * 1000).toFixed(1)},${(40 - (v / max) * 36).toFixed(1)}`)
    return `M0,40 L${pts.join(' L')} L1000,40 Z`
  }, [live])

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    setT(iOf((e.clientX - r.left) / r.width, sc))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 24, PageDown: -24 }
    if (e.key in step) {
      e.preventDefault()
      setPlaying(false)
      setT(Math.max(0, Math.min(H - 1, t + step[e.key])))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setT(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setT(H - 1)
    }
  }

  const day = Math.floor(t / 24)
  const valueText = `${dayLabel(live, day, lang)} ${hourLabel(t)}, ${observed ? tr('observed', '実測') : tr('forecast', '予測')}`

  return (
    <div className="timeline" aria-label={tr('Timeline', 'タイムライン')}>
      <button className="play-btn" onClick={() => setPlaying(!playing)} aria-label={playing ? tr('Pause', '一時停止') : tr('Play', '再生')}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>

      <div className="tl-readout">
        <div className="tl-time">
          <span className="tl-day">{dayLabel(live, day, lang)}</span>
          {/* While playing, the timeline's hour (the vehicles run on at their own, slower pace). */}
          {vehicles && !playing ? <VehicleTime live={isLive} /> : <span className="tl-hour num">{hourLabel(t)}</span>}
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
          <span className={`tl-mode ${observed ? 'obs' : 'fc'}`}>{observed ? tr('Observed', '実測') : tr('Forecast', '予測')}</span>
        )}
      </div>

      <div className="tl-track-wrap">
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
          <div className="tl-future" style={{ left: `${xOf(now + 1, sc) * 100}%` }}></div>
          {live.days.map((d, k) => (
            <div key={d.date} className={`tl-day-seg ${k === todayDay ? 'today' : ''} ${k < todayDay ? 'past' : ''} ${d.weekend ? 'wknd' : ''}`} style={{ left: `${xOf(k * 24, sc) * 100}%`, width: `${(xOf((k + 1) * 24, sc) - xOf(k * 24, sc)) * 100}%` }}>
              <span className="tl-day-lab">
                <span className="lab-long">{k === todayDay ? tr('Today', '今日') : k < todayDay ? live.days[k].date.slice(8).replace(/^0/, '') : dayLabel(live, k, lang, true)}</span>
                <span className="lab-short">{k === todayDay ? tr('Today', '今日') : live.days[k].date.slice(8).replace(/^0/, '')}</span>
              </span>
            </div>
          ))}
          {[6, 12, 18].map((h) => (
             <span key={h} className={`tl-hour-tick h${h}`} style={{ left: `${xOf(sc.t0 + h, sc) * 100}%` }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
          <div className="tl-now" style={{ left: `${xOf(now + 0.5, sc) * 100}%` }} title={tr('Latest observation', '最新の観測')}>
            <span>{todayDay > 0 ? tr('data', '実測') : tr('now', '現在')}</span>
          </div>
          {nowIdx !== now && <div className="tl-clock" style={{ left: `${xOf(nowIdx + 0.5, sc) * 100}%` }} title={tr('Now', '現在')}></div>}
          <div className="tl-thumb" style={{ left: `${xOf(t + 0.5, sc) * 100}%` }}></div>
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
        {live.demo && <SourceBadge info={live.sources?.people} compact note={['Past days: real daily visitor totals with a simulated hourly shape. Future days: forecast.', '過去日：来訪者の日合計は実データ、時間別は模擬。将来日：予測。']} />}
      </div>
    </div>
  )
}
