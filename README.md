# dhde-app

**DHDE · Fukui Tourism Intelligence**: one app with three views that share one data layer. Dark theme, EN/JA.

- **Map**: full-screen layered map of the six priority nodes. Layers: People, Regional density, People flow, Traffic flow, Weather, Sentiment, Economics, with a timeline across today (hourly) and the next 7 days.
- **Nodes**: per-node dashboards with the daily forecast (Dina Belay's dashboard logic, carried over from dhde-fukui-tourism-dashboard). Priority nodes without published data stay selectable with a "data on its way" panel.
- **Strategy**: the strategy team's five strategic questions (what tourism is worth, visitor flow, visitor value, leaks, returns) as dashboard components.

Every strategy and economics number shows its status: Real, Calculated / modelled, Illustrative or Data pending. Pending values display as "[pending]", never as a made-up number. Every layer running on simulated data shows a **Demo data** badge.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type check + production build into dist/
npm run lint
```

Shareable map state: `#/map/<node>` opens a node's drawer; `?layers=people,flow,traffic&base=dark&t=38` sets layers, basemap (`hybrid`, `dark`, `streets`) and hour index. `?layer=economics` still works.

## Data

The app only reads JSON from `public/data/`. It does no data processing and makes no runtime calls except map tiles.

| File | Produced by | Contents |
|---|---|---|
| `dashboard_data.json` | pipeline (publish step) | per-node daily actuals and forecasts (Nodes view) |
| `nodes.json` | node registry (from dhde-preprocessing-model configs) | node ids, names, coordinates, prefecture, measure type |
| `regional_economics.json` | dhde-ai-demo `economics/build_regional_economics.py` | visitors, revenue, opportunity lost per node and region |
| `strategic_questions.json` | strategy team | numbers and statuses for the Strategy view |
| `routes.json` | `scripts/fetch_routes.mjs` (run once) | road geometry between node pairs, plus the shinkansen line |
| `live_demo.json` | `scripts/gen_live_demo.mjs` (**dummy**) | hourly people, flows, traffic, weather, sentiment for today + 7 days |

The files here are snapshots so the app runs on its own. In production the pipeline publishes them next to the app.

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

## Design system

Tokens in `src/styles/tokens.css`: navy ink ground, one periwinkle accent for interaction, a fixed status scale (good / warning / serious / critical, always with a label), provenance pill colours, and the dataviz reference palette's dark steps for series (validated against the card surface). Bricolage Grotesque for headings, IBM Plex Sans / Plex Sans JP for body and numbers, IBM Plex Mono for axes. Focus rings on every control; `prefers-reduced-motion` freezes particles and pulses.

## Related repos

- `dhde-preprocessing-model`: raw sources to clean per-node tables
- `dhde-terraform-aws`: AWS infrastructure (EventBridge, Lambda, S3, CloudFront, playground EC2)
- `dhde-ai-demo`: the original single-file demo map (showcase)
- `dhde-fukui-tourism-dashboard`: the research repo behind the published paper
