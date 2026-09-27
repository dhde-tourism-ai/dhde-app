import { useMemo, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { LiveData } from '../../../types/live'
import { useLang } from '../../../lib/i18n'
import { dayLabel, hourLabel } from '../../../lib/live'
import { Icon } from '../../../components/icons'
import { DemoBadge } from '../../../components/DemoBadge'

/** Share of the track given to today (hourly); the next 7 days share the rest. */
const TODAY_W = 0.36

function xOf(i: number, hours: number): number {
  const rest = Math.max(1, hours - 24)
  return i <= 24 ? (i / 24) * TODAY_W : TODAY_W + ((i - 24) / rest) * (1 - TODAY_W)
}

function iOf(x: number, hours: number): number {
  const rest = Math.max(1, hours - 24)
  const i = x <= TODAY_W ? (x / TODAY_W) * 24 : 24 + ((x - TODAY_W) / (1 - TODAY_W)) * rest
  return Math.max(0, Math.min(hours - 1, Math.round(i)))
}

interface Props {
  live: LiveData
  t: number
  setT: (i: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  speed: number
  setSpeed: (s: number) => void
}

export function Timeline({ live, t, setT, playing, setPlaying, speed, setSpeed }: Props) {
  const { t: tr, lang } = useLang()
  const track = useRef<HTMLDivElement>(null)
  const H = live.hours
  const now = live.observed_until
  const observed = t <= now

  // Total people on site across all nodes, per hour: the day's rhythm behind the scrubber.
  const spark = useMemo(() => {
    const tot = Array.from({ length: H }, (_, i) =>
      Object.values(live.nodes).reduce((a, n) => a + (n.on_site.actual[i] ?? n.on_site.predicted[i] ?? 0), 0),
    )
    const max = Math.max(1, ...tot)
    const pts = tot.map((v, i) => `${(xOf(i + 0.5, H) * 1000).toFixed(1)},${(40 - (v / max) * 36).toFixed(1)}`)
    return `M0,40 L${pts.join(' L')} L1000,40 Z`
  }, [live, H])

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
          <span className="tl-hour num">{hourLabel(t)}</span>
        </div>
        <span className={`tl-mode ${observed ? 'obs' : 'fc'}`}>{observed ? tr('Observed', '実測') : tr('Forecast', '予測')}</span>
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
          <div className="tl-future" style={{ left: `${xOf(now + 1, H) * 100}%` }}></div>
          {live.days.map((d, k) => (
            <div key={d.date} className={`tl-day-seg ${k === 0 ? 'today' : ''} ${d.weekend ? 'wknd' : ''}`} style={{ left: `${xOf(k * 24, H) * 100}%`, width: `${(xOf((k + 1) * 24, H) - xOf(k * 24, H)) * 100}%` }}>
              <span className="tl-day-lab">
                <span className="lab-long">{k === 0 ? tr('Today', '今日') : dayLabel(live, k, lang, true)}</span>
                <span className="lab-short">{k === 0 ? tr('Today', '今日') : live.days[k].date.slice(8).replace(/^0/, '')}</span>
              </span>
            </div>
          ))}
          {[6, 12, 18].map((h) => (
             <span key={h} className={`tl-hour-tick h${h}`} style={{ left: `${xOf(h, H) * 100}%` }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
          <div className="tl-now" style={{ left: `${xOf(now + 0.5, H) * 100}%` }} title={tr('Latest observation', '最新の観測')}>
            <span>{tr('now', '現在')}</span>
          </div>
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
            setT(now)
          }}
        >
          <Icon name="now" /> {tr('Now', '現在')}
        </button>
        {live.demo && <DemoBadge compact />}
      </div>
    </div>
  )
}
