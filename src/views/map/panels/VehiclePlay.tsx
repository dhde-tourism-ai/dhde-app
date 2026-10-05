import { useLang } from '../../../lib/i18n'
import { vehicleClock } from '../../../lib/vehicleClock'
import { Icon } from '../../../components/icons'
import type { VehicleRun } from '../layers/VehiclesLayer'

/** Simulated minutes per second the control offers. */
const RATES = [1, 5, 15]

/**
 * Buses and trains: Live (where the timetables put them right now, real speed) or
 * Simulated (the same vehicles run on from the time shown at a few minutes a
 * second, so they visibly travel their routes). The timeline's own play button
 * moves the whole dashboard through the hours; this switch only affects the vehicles.
 */
export function VehiclePlay({ run, setRun, rate, setRate, bus, rail }: { run: VehicleRun | null; setRun: (r: VehicleRun | null) => void; rate: number; setRate: (r: number) => void; bus: boolean; rail: boolean }) {
  const { t } = useLang()
  // Start (or re-time at a new speed) from wherever the vehicle clock is now, so nothing jumps.
  const from = (r: number): VehicleRun => ({ iso: vehicleClock.date(), min: vehicleClock.minute(), rate: r })
  const what = bus && rail ? t('bus & train', 'バス・列車') : bus ? t('bus', 'バス') : t('train', '列車')
  return (
    <div className="vehicle-play" role="group" aria-label={t('Moving buses and trains', 'バス・列車の運行')}>
      <div className="seg vp-mode" role="radiogroup" aria-label={t('Vehicle view', '表示')}>
        <button
          role="radio"
          aria-checked={!run}
          aria-pressed={!run}
          onClick={() => setRun(null)}
          title={t('Where each vehicle is right now on its timetable (scheduled positions, not GPS)', '現在時刻の時刻表上の位置（GPSではない）')}
        >
          <span className="vp-dot live" aria-hidden="true"></span>
          {t(`Live ${what} locations`, `${what}の現在位置`)}
        </button>
        <button role="radio" aria-checked={!!run} aria-pressed={!!run} onClick={() => !run && setRun(from(rate))} title={t('Run the vehicles forward along their routes', '路線に沿って早送り')}>
          <Icon name="play" size={12} />
          {t(`Simulated ${what} routes`, `${what}路線のシミュレーション`)}
        </button>
      </div>
      {run && (
        <div className="seg vp-speed" role="group" aria-label={t('Speed', '速度')}>
          {RATES.map((r) => (
            <button
              key={r}
              aria-pressed={rate === r}
              onClick={() => {
                setRate(r)
                setRun(from(r))
              }}
              title={t(`${r} minute${r > 1 ? 's' : ''} of service per second`, `1秒で${r}分`)}
            >
              {t(`${r} min/s`, `${r}分/秒`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
