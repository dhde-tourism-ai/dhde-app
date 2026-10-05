import { useLang } from '../../../lib/i18n'
import { vehicleClock } from '../../../lib/vehicleClock'
import { Icon } from '../../../components/icons'
import type { VehicleRun } from '../layers/VehiclesLayer'

/** Simulated minutes per second the control offers. */
const RATES = [1, 5, 15]

/**
 * "Play buses & trains": runs the moving buses and trains on from the time shown,
 * a few minutes a second, so they visibly travel their routes (at real speed they
 * barely move at prefecture zoom). The timeline's own play button moves the whole
 * dashboard through the hours; this one only moves the vehicles.
 */
export function VehiclePlay({ run, setRun, rate, setRate, bus, rail }: { run: VehicleRun | null; setRun: (r: VehicleRun | null) => void; rate: number; setRate: (r: number) => void; bus: boolean; rail: boolean }) {
  const { t } = useLang()
  // Start (or re-time at a new speed) from wherever the vehicle clock is now, so nothing jumps.
  const from = (r: number): VehicleRun => ({ iso: vehicleClock.date(), min: vehicleClock.minute(), rate: r })
  const what = bus && rail ? t('buses & trains', 'バス・列車') : bus ? t('buses', 'バス') : t('trains', '列車')
  return (
    <div className="vehicle-play" role="group" aria-label={t('Moving buses and trains', 'バス・列車の運行')}>
      <button className={`vp-btn ${run ? 'on' : ''}`} onClick={() => setRun(run ? null : from(rate))} aria-pressed={!!run}>
        <Icon name={run ? 'pause' : 'play'} size={14} />
        {run ? t(`Pause ${what}`, `${what}を一時停止`) : t(`Play ${what}`, `${what}を再生`)}
      </button>
      <div className="seg" role="group" aria-label={t('Speed', '速度')}>
        {RATES.map((r) => (
          <button
            key={r}
            aria-pressed={rate === r}
            onClick={() => {
              setRate(r)
              if (run) setRun(from(r))
            }}
            title={t(`${r} minute${r > 1 ? 's' : ''} of service per second`, `1秒で${r}分`)}
          >
            {t(`${r} min/s`, `${r}分/秒`)}
          </button>
        ))}
      </div>
    </div>
  )
}
