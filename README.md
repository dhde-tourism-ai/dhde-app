# dhde-app

**DHDE · Fukui Tourism Intelligence**: one app with three views that share one data layer. Dark theme, EN/JA.

- **Map**: full-screen layered map of the six priority nodes. Layer groups: Actions (Nudges) · Movement (People, Regional density, People flow, Traffic flow) · Conditions (Weather) · Voice of visitor (Survey, Social media, Reviews, Sentiment) · Market (Hotels, Search intent) · Economics. A timeline covers today (hourly) and the next 7 days; a Nudges panel runs the three nudge loops.
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

Shareable map state: `#/map/<node>` opens a node's drawer; `?layers=people,flow,traffic&base=dark&t=38&panel=nudges` sets layers, basemap (`hybrid`, `dark`, `streets`), hour index and the right-hand panel. `?layer=economics` still works.

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
| `market_voice_demo.json` | `scripts/gen_market_voice_demo.mjs` (**dummy**, fictional posts and reviews) | hotels, search intent, survey, social media, reviews |

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

Each nudge carries severity, node, time, the triggering signals, the suggested action and a Demo pill; clicking one moves the timeline and flies the map to it.

## Deploy

`.github/workflows/pages.yml` builds on every push to `main` and publishes `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages` (plus a `404.html` copy). Enable Pages in the repo settings (Source: GitHub Actions) for it to go live; the workflow changes no settings.

## Design system

Tokens in `src/styles/tokens.css`: navy ink ground, one periwinkle accent for interaction, a fixed status scale (good / warning / serious / critical, always with a label), provenance pill colours, and the dataviz reference palette's dark steps for series (validated against the card surface). Bricolage Grotesque for headings, IBM Plex Sans / Plex Sans JP for body and numbers, IBM Plex Mono for axes. Focus rings on every control; `prefers-reduced-motion` freezes particles and pulses.

## Related repos

- `dhde-preprocessing-model`: raw sources to clean per-node tables
- `dhde-terraform-aws`: AWS infrastructure (EventBridge, Lambda, S3, CloudFront, playground EC2)
- `dhde-ai-demo`: the original single-file demo map (showcase)
- `dhde-fukui-tourism-dashboard`: the research repo behind the published paper
