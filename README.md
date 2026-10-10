# dhde-app

**DHDE · Fukui Tourism Intelligence**: one app with three views that share one data layer. Dark theme, EN/JA.

- **Map**: full-screen layered map of the six priority nodes. Layer groups: Actions (Action nudges) · Movement (People, Regional density, People flow, Traffic flow) · Conditions (Weather) · Voice of visitor (Survey, Social media, Reviews, Sentiment) · Market (Hotels, Search intent) · Economics. A timeline covers today (hourly) and the next 7 days; an Action nudges panel runs the three nudge loops, each nudge labelled High, Medium or Low priority.
- **Nodes**: per-node dashboards with the daily forecast (Dina Belay's dashboard logic, carried over from dhde-fukui-tourism-dashboard). Priority nodes without published data stay selectable with a "data on its way" panel.
- **Strategy**: the strategy team's five strategic questions (what tourism is worth, visitor flow, visitor value, leaks, returns) as dashboard components.

Every strategy and economics number shows its status: Real, Estimated, Illustrative or Data pending. Pending values display as "[pending]", never as a made-up number. Every layer running on simulated data shows a **Demo data** badge.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type check + production build into dist/
npm run lint
```

Shareable map state: `#/map/<node>` opens a node's drawer; `?layers=people,flow,traffic&base=dark&t=38&panel=nudges` sets layers, basemap (`hybrid`, `dark`, `streets`), hour index and the right-hand panel. `?layer=economics` still works.

## Data

The app only reads JSON from `data/`: the live CloudFront copy when configured (see Hosting), otherwise the `public/data/` snapshot. It does no data processing and makes no runtime calls except map tiles.

| File | Produced by | Contents |
|---|---|---|
| `dashboard_data.json` | pipeline (publish step) | per-node daily actuals and forecasts (Nodes view) |
| `nodes.json` | node registry (from dhde-preprocessing-model configs) | node ids, names, coordinates, prefecture, measure type |
| `regional_economics.json` | dhde-ai-demo `economics/build_regional_economics.py` | visitors, revenue, opportunity lost per node and region |
| `strategic_questions.json` | strategy team | numbers and statuses for the Strategy view |
| `routes.json` | `scripts/fetch_routes.mjs` (run once) | road geometry between node pairs, plus the shinkansen line |
| `real_data.json` | `scripts/build_real_data.py` from dhde-preprocessing-model (**real**, refreshed daily) | last 90 days per node: visitors estimate, weather, traffic, hotels, survey counts, Google Maps metrics; hotel forward bookings |
| `live_demo.json` | `scripts/gen_live_demo.mjs` (**dummy**) | hourly people, flows, traffic, weather, sentiment for today + 7 days |
| `transport.json`, `transport_map.json`, `transport_modes.json`, `transport_trends.json` | dhde-preprocessing-model `scripts/build_transport.py` (see its [docs/transport.md](https://github.com/dhde-tourism-ai/dhde-preprocessing-model/blob/main/docs/transport.md)), **refreshed daily** in `daily-data.yml` | public transport access per node from GTFS-JP bus timetables, route lines, stops, walking areas; tourists by mode and spend (tourism survey); Google Trends interest (Illustrative) |
| `market_voice_demo.json` | `scripts/gen_market_voice_demo.mjs` (**dummy**, fictional posts and reviews) | hotels, search intent, survey, social media, reviews |

The demo files are snapshots so the app runs on its own; `real_data.json` is refreshed daily by the Data refresh workflow.

Known data caveat: JTA monthly figures for Fukui municipalities jump sharply from March 2026. Check them before quoting any town-level number (the economics layer shows this warning).

### routes.json

Fetched once from the public OSRM demo server (`router.project-osrm.org`, driving profile, OpenStreetMap data, 8 requests) for Fukui Station ↔ Tojinbo, Eiheiji, Awara Onsen, Katsuyama, Rainbow Line (via Tsuruga); Awara Onsen ↔ Tojinbo; Kanazawa → Awara Onsen; and an inland alternate Fukui Station → Tojinbo via Maruoka. The Hokuriku Shinkansen entries (`kind: "rail"`) are hand-digitised and approximate. Refresh with `node scripts/fetch_routes.mjs`. Shape: `{ generated_at, source, note, routes: [{ id, from, to, via, kind, label, label_ja, distance_km, duration_min, path: [[lat, lon], ...] }] }`.

### live_demo.json (dummy today, same shape for the real feed)

Simulated, reproducible (`node scripts/gen_live_demo.mjs --start 2026-09-27 --now 14`). Daily scale follows the prefecture's 2025 annual visitors (Tojinbo 651k, Katsuyama 1.56M, Rainbow Line 443k, Eiheiji 518k, Awara Onsen 658k), so sites see low thousands a day; Fukui Station assumes ~4,800 tourists a day through the east exit. Arrivals peak 10:00–13:00, returns 15:00–18:00, weekends higher, onsen check-in mid-afternoon, Kanazawa/shinkansen inflow to Awara and Fukui Station. The real pipeline replaces the file with `"demo": false` and the badge disappears.

All hourly arrays have `hours` entries starting 00:00 JST on `start` (index = day × 24 + hour). Types: `src/types/live.ts`.

```jsonc
{
  "demo": true, "note": "...", "generated_at": "ISO", "timezone": "Asia/Tokyo",
  "start": "2026-09-27", "step_minutes": 60, "hours": 192,
  "observed_until": 14,                       // last hour index with actuals
  "days": [{ "date": "2026-09-27", "dow": "Sun", "weekend": true, "holiday": false }],
  "nodes": {
    "tojinbo": {
      "measure": "people",                    // people | vehicles | proxy | reservations
      "annual_visitors_2025": 651000,
      "comfortable_capacity": 650,            // people on site; drives the crowding tier
      "on_site":  { "actual": [n|null], "predicted": [n], "lo": [n], "hi": [n] },
      "arrivals": { "actual": [n|null], "predicted": [n] },
      "weather":  { "station": "Mikuni", "station_ja": "三国", "temp_c": [], "precip_pct": [], "precip_mm": [], "wind_ms": [], "condition": ["clear|partly|cloudy|rain|heavy_rain|thunder|..."] },
      "sentiment": { "score": [-1..1 per day], "posts": [per day], "keywords": [[{ "en": "", "ja": "" }]] }
    }
  },
  "flows":   { "<route id>": { "mode": "road|rail", "forward": [people/h from→to], "reverse": [people/h to→from], "unit": "people_per_hour" } },
  "traffic": { "<route id>": { "segments": [[0, 0.18], ...], "congestion": [[0..1 per hour] per segment], "vehicles_per_hour": [] } },
  "advisories": [{ "id": "", "corridor": "<route id>", "alternate": "<route id>", "start": 12, "end": 14, "reason_en": "", "reason_ja": "" }],
  "weather_alerts": [{ "id": "", "type": "heavy_rain|wind|thunder|waves|snow|heat", "level": "advisory|warning", "nodes": [], "start": 0, "end": 0, "title_en": "", "title_ja": "", "detail_en": "", "detail_ja": "" }]
}
```

### real_data.json and the fallback rule

Built by `scripts/build_real_data.py` (the lead's adapter; its docstring has the schema and calibration) from dhde-preprocessing-model's per-node master tables: 6 nodes, the last 90 days daily plus hotel forward bookings up to 90 days, per-node calibration and an `as_of` date per source group. Types: `src/types/real.ts`.

**Rule: real wins where it exists, demo fills the rest, nothing breaks.** The file is optional. `src/lib/real.ts` validates it field by field (`parseReal`) and merges it over the demo files (`mergeAll`); a missing or malformed file, node or field falls back to the demo value, and a merge error falls back to the whole demo. Each layer's badge says what it runs on: "Demo data", "Real · <date>", or "Mixed" when only some nodes, roads or areas are real.

| Layer | Real from real_data.json | Still demo |
|---|---|---|
| People / density | per-node daily `visitors_est` (modelled: the node's signal scaled to the prefecture's 2025 official annual count; confidence high / medium / low shown). The timeline gains the last 7 observed days. Future days: mean of the same weekday over the last 4 weeks. | hourly shape (scaled so each day adds up to the real total). Fukui Station has no official count: camera detections only, no visitor number |
| People flow | route volumes follow the destination's real day total | split by road and hour |
| Weather | hourly where the sources below have it: JMA observations (past days) and the JMA-model forecast (ahead). Other days: daily `temp_c`, `precip_mm`, `wind_ms`, `sun_h`, `humidity_pct`, `snow_cm` (hourly curve synthesised). Weather warnings: JMA's in force, read live (below) | demo warnings only if JMA can't be reached (marked Demo) |
| Traffic | roads with a counter (Katsuyama, Eiheiji, Rainbow Line): demo congestion profile scaled by the day's `traffic_volume` vs the 90-day mean. Zero or today's partial counts are treated as no reading | roads without a counter (Tojinbo, Awara), future days |
| Hotels | `hotel_occ`, `hotel_adr_yen`, rooms sold / total per day; `hotel_forward` for nights ahead (Fukui Station, Awara, regional coast feed for Echizen, Mikata for Rainbow Line) | Rakuten availability |
| Search intent | Google Maps Business Profile map views, search views, directions with a 14-day sparkline (lags about 5 days; `as_of` shown) for the node in each area | Ono, Tsuruga |
| Reviews | rating (30-day average of new Google reviews, weighted by count) and new reviews in 30 days | total count, snippets (fictional) |
| Survey | responses in 30 days (sum of `survey_responses`) | satisfaction, NPS, reasons, origin |
| Social, sentiment | | all |
| Action nudges | demand vs normal = real 90-day mean `visitors_est`; booking balance from real occupancy and forward bookings; weather-route from the real hourly weather | |

The header chip shows `shared_date` (the latest day every node has data for).

### Read live by the browser

Besides the bundled files, the app reads these sources itself, at page load and then on a timer. Either can fail on its own; the app then keeps what it has.

| Source | What | Notes |
|---|---|---|
| dhde-preprocessing-model `live-data` branch, `weather_hourly/{node}.csv` (raw.githubusercontent.com; root in `LIVE_DATA_URL`, override with `VITE_LIVE_DATA_URL`) | JMA observations and the collector's saved forecast | GitHub runs the collector only a few times a day, so observations arrive as whole past days |
| JMA warnings, `bosai/warning/data/r8/180000.json` (Fukui; every 10 minutes, `src/lib/jmaWarnings.ts`) | warnings and advisories in force at the six nodes | JMA's level system since May 2026. After 30 minutes without a good read they're shown as unconfirmed |
| `data/weather_forecast.json` from the live source (`VITE_DATA_BASE_URL`, CloudFront; never bundled) | the [Open-Meteo](https://open-meteo.com/) JMA-model forecast (`models=jma_seamless`), 9 days, all nodes | Written every hour by the `dhde-dev-weather-forecast` Lambda in dhde-terraform-aws, which also archives each run for training. Used while under 3 hours old (`S3_FORECAST_MAX_AGE_MS`) |
| [Open-Meteo](https://open-meteo.com/) forecast API, `models=jma_seamless`, one request | fallback only: nodes the S3 file lacks, or all of them when it is missing or stale | Data CC BY 4.0, credited in the weather tooltip and layer note. **The free API is for non-commercial use only** ([terms](https://open-meteo.com/en/terms)). The Lambda calls it once an hour; a viewer's browser calls it only in this fallback. If the dashboard is or becomes commercial, it needs an Open-Meteo API plan. |

`scripts/check_data.mjs` validates the file (exit 1 when malformed, 0 when valid or absent). The Pages workflow runs it before the build, so a bad data push fails the deploy and the previous site stays up.

## Data refresh

`.github/workflows/daily-data.yml` runs every day at 00:00 UTC (09:00 JST, after all sources publish) and on demand. It checks out the public dhde-preprocessing-model into `$RUNNER_TEMP/ws`, restores the JMA hourly cache (`ws/jma_cache`; a cold run backfills about 12 minutes per node), runs `fetch_data.py` and `build_node.py` for the six nodes (a single node may fail; fewer than 4 master files fails the job), builds `real_data.json` with `scripts/build_real_data.py` (which writes nothing if its own validation fails), checks it with `scripts/check_data.mjs`, commits it to `main` as github-actions[bot] when it changed, and dispatches `pages.yml` (pushes made with `GITHUB_TOKEN` do not trigger other workflows). No secrets are used: TomTom and Rakuten report "not set" and the build continues. Python deps for the adapter: `requirements-ci.txt`.

### market_voice_demo.json (dummy today, same shape for the real feeds)

Simulated by `node scripts/gen_market_voice_demo.mjs` (run after `gen_live_demo.mjs`; it reads the days and demand from it). Every social post, handle and review snippet is **fictional**; thumbnails are abstract gradient motifs drawn by the app, never photos. Per-day arrays have `days` entries starting on `start`. Types: `src/types/market.ts`.

```jsonc
{
  "demo": true, "note": "...", "generated_at": "ISO", "start": "2026-09-27", "days": 8,
  // Hotels: one entry per FTAS reservation feed (Fukui Station, Awara, Echizen coast regional, Mikata Five Lakes)
  "hotels": [{
    "id": "awara_onsen", "name": "", "name_ja": "", "lat": 0, "lon": 0,
    "node": "awara_onsen",                  // node whose demand it serves (nudge #3)
    "feed": "FTAS reservations: Awara", "rooms_total": 1180,
    "occupancy_pct": [per night], "rooms_left": [per night],
    "booking_curve": { "target_day": 6, "points": [{ "days_ahead": 30, "booked_pct": 48, "last_year_pct": 42 }] },
    "rakuten": { "radius_km": 3, "hotels_checked": 21, "share_with_rooms_pct": { "d1": 12, "d7": 30, "d30": 52 } }
  }],
  // Search intent: route-search / online interest index per municipality
  "rsi": [{ "id": "katsuyama", "name": "", "name_ja": "", "lat": 0, "lon": 0, "index": 82, "history": [14 days, oldest first], "change_7d_pct": 12.5 }],
  // Survey (FTAS / tourism federation), per node
  "survey": { "tojinbo": { "responses_30d": 120, "satisfaction": 4.2, "nps": 31,
               "top_reasons": [{ "en": "", "ja": "", "share": 45 }], "origin_share": [{ "en": "", "ja": "", "share": 18 }], "source": "" } },
  // Social media, per node
  "social": { "tojinbo": { "posts_24h": 68, "images_24h": 51, "comments_24h": 132, "avg_sentiment": 0.4,
               "feed": [{ "id": "", "kind": "photo|short|comment", "handle": "", "hours_ago": 3, "sentiment": 0.8, "en": "", "ja": "",
                          "likes": 0, "comments": 0, "thumb": { "motif": "cliff|train|dino|lake|onsen|temple", "hue": 200 } }] } },
  // Reviews (Google-reviews shape), per node
  "reviews": { "tojinbo": { "rating": 4.2, "count": 6467, "rating_30d_ago": 4.2, "new_30d": 137,
                "distribution_pct": [5★, 4★, 3★, 2★, 1★], "snippets": [{ "stars": 5, "en": "", "ja": "", "days_ago": 4 }], "source": "" } }
}
```

### Nudge loops

Computed in the app (`src/lib/nudges.ts`) from the two files above, so the real feeds drive them unchanged:

1. **Demand alert**: a node's forecast daily visitors ≥ 35% above or below normal (2025 annual ÷ 365) → staff / parking, or a same-week offer.
2. **Weather-route**: rain ≥ 8 mm/h or wind ≥ 13 m/s at a coastal node (Tojinbo, Rainbow Line) → recommend an indoor site and draw the inland route.
3. **Booking balance**: hotel occupancy ≥ 85% while the served node's demand is ≥ 15% above normal → raise rates and redirect to the nearest area with rooms; occupancy ≤ 40% → promote stay packages.

Each nudge carries a priority (High, Medium or Low, from its severity), node, time, the triggering signals, the suggested action and a Demo pill; clicking one moves the timeline and flies the map to it.

## Deploy

`.github/workflows/pages.yml` builds on every push to `main` and publishes `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages` (plus a `404.html` copy). Enable Pages in the repo settings (Source: GitHub Actions) for it to go live; the workflow changes no settings.

## Hosting

- **App:** GitHub Pages at https://dhde-tourism-ai.github.io/dhde-app/, deployed by the workflow above.
- **Data:** read live from CloudFront. The repo variable `DATA_BASE_URL` (Settings > Secrets and variables > Actions > Variables, e.g. `https://dxxxx.cloudfront.net`, no trailing slash) is passed to the build as `VITE_DATA_BASE_URL`; the app then fetches `${DATA_BASE_URL}/data/<file>`. The CloudFront origin must allow CORS from `https://dhde-tourism-ai.github.io`.
- **Fallback:** the `public/data/` files are bundled into every build as a snapshot. If `DATA_BASE_URL` is empty the app reads them directly; if a live fetch fails it falls back to the bundled copy and shows "Showing saved data from <date>".
- **Local:** `VITE_DATA_BASE_URL=https://... npm run dev` tests against the live source; without it, dev reads `public/data/`.

## Design system

Tokens in `src/styles/tokens.css`: navy ink ground, one periwinkle accent for interaction, a fixed status scale (good / warning / serious / critical, always with a label), provenance pill colours, and the dataviz reference palette's dark steps for series (validated against the card surface). Bricolage Grotesque for headings, IBM Plex Sans / Plex Sans JP for body and numbers, IBM Plex Mono for axes. Focus rings on every control; `prefers-reduced-motion` freezes particles and pulses.

## Related repos

- `dhde-preprocessing-model`: raw sources to clean per-node tables
- `dhde-terraform-aws`: AWS infrastructure (EventBridge, Lambda, S3, CloudFront, playground EC2)
- `dhde-ai-demo`: the original single-file demo map (showcase)
- `dhde-fukui-tourism-dashboard`: the research repo behind the published paper
