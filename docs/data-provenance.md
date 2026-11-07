# Data labels and forecasting evidence

Labels describe displayed values, not merely whether an input file was collected.

| Label | Meaning |
| --- | --- |
| Observed | Collected records, such as bookings, survey answers or weather observations; not necessarily a physical visitor count. |
| Estimated | Calculated, calibrated, model-scored or simulated values. |
| Forecast | Predicted values for a forecast period. |
| Demo | Illustrative fallback data. |
| Mixed data | The layer combines types; open Data details for the distinction. |

## Verified transformations

- People and density: daily visitor estimates are calibrated from source signals; the regional map distributes these using simulated hourly profiles. Future hours use forecasts. They are not live turnstile counts.
- People flow: destination totals scale simulated road/hour allocations.
- Traffic: available daily counters inform some roads; other roads/future data use demo shapes. The layer is mixed.
- Weather: `hourly_source` identifies observed or forecast hourly rows. Missing hourly values can use synthesized daily weather or demo fallback. Full node coverage does not make every hour observed.
- Hotels: available booking/availability records are collected data, including forward bookings. Missing coverage can remain demo; forward bookings are not themselves a forecast of realized occupancy.
- Social: collected counts coexist with model-scored sentiment and demo fallbacks. Sentiment is estimated, not observed visitor opinion ground truth.
- Reviews and survey: collected aggregates can coexist with fictional snippets or other demo fields.

Implementation evidence: `src/lib/real.ts` (`mergeReal`, `mergeMarket`, `forecastMethod`), `src/lib/weatherHourly.ts`, `scripts/build_real_data.py`. Map and Summary use the same layer classification helper. Missing/demo metadata always retains the Demo badge.

## Visitor forecast model and reported performance

Snapshot: bundled `public/data/real_data.json`, generated 2026-11-06T07:01:30+00:00, source commit `de18acb` in `dhde-tourism-ai/dhde-preprocessing-model`. These are upstream-reported 26-week backtest metrics, not an independent validation or an accuracy percentage for current park entries.

| Site | Model identifier | WAPE error | Same weekday last week baseline WAPE |
| --- | --- | --- | --- |
| Rainbow Line | lightgbm | 35.0% | 49.5% |
| Tojinbo | lightgbm | 27.6% | 39.5% |
| Awara Onsen | regression | 2.7% | 23.4% |
| Fukui Station | regression | 15.3% | 20.8% |
| Katsuyama | regression | 12.8% | 69.2% |

Lower WAPE is better. Do not convert WAPE to “accuracy = 100% minus error.” Models predict source signals, then calibration converts eligible outputs into visitor estimates. Different sites/signals are not directly comparable. This audit does not establish which weather features the upstream training code uses. No visitor-model block was present for Eiheiji in this snapshot.

## Updates and fallback

- `.github/workflows/daily-data.yml`: scheduled at 00:23 UTC (09:23 JST) daily; execution may be delayed. It checks out the preprocessing repository and invokes `scripts/build_forecast.py` before building the dashboard data. This is a configured schedule, not proof of the last successful run.
- `src/lib/weatherHourly.ts`: page-load fetch and 30-minute refresh; observations take precedence over forecasts, then daily/demo fallback.
- `src/lib/real.ts`: if model days are absent or week-ahead bookings are flagged missing, use the mean of recent matching weekdays (up to four within eight weeks, excluding holidays for normal days). Hours still use a simulated profile.
- Source dates, model issue dates, file generation times, page refresh and model training are different timestamps. The upstream training implementation must be checked before making claims about retraining cadence or weather sensitivity.
