# Transport track

How visitors can reach the six priority nodes without a car: which modes serve them, how long the journey takes, how
often services run, and when the last one leaves. This builds Steps 0 to 2 of the DHDE Transportation Track plan
(2 Oct 2026). Step 3 (mode share from Survey v2, cycling and parking from the Federation) waits on that data.

| Output (`public/data/`) | Built by | Refresh | Shown in the app |
|---|---|---|---|
| `transport.json` | `build_transport.py` | weekly (`.github/workflows/transport-data.yml`) | "Getting here" card in the node drawer |
| `transport_map.json` | `build_transport.py` (+ `walk_areas.json`) | weekly | Map → Movement → **Public transport** layer |
| `transport_trends.json` | `collect_trends.py` | weekly, kept if Google refuses | sparklines in that layer's legend |
| `transport/walk_areas.json` | `fetch_walk_areas.py` | by hand (paths rarely change) | walking areas on the layer |

```bash
pip install -r transport/requirements.txt
python transport/build_transport.py            # downloads the feeds into transport/.cache on first run
python transport/build_transport.py --refresh  # re-download
python transport/collect_trends.py
python transport/fetch_walk_areas.py           # 6 requests to the public Valhalla server
python -m pytest transport/tests -q
node scripts/check_transport.mjs               # also runs in the Pages deploy
```

## Visitors by mode (top of the Transport page)

`build_modes.py` → `public/data/transport_modes.json`, rebuilt daily in `daily-data.yml` right after `real_data.json`.

**visitors by mode = the site's visitor estimate × the site's mode share**

- **Mode share**: the Fukui Prefecture tourism survey ([code4fukui/fukui-kanko-survey](https://github.com/code4fukui/fukui-kanko-survey),
  CC BY 4.0, about 104,000 responses since 2022), question 福井県内での交通手段 ("how did you get around in Fukui").
  Responses are matched to a site by answer area, with the same area ids as the preprocessing node configs, over the
  last 12 months. Answers map to **train** (在来線, 新幹線), **bus** (路線バス, 旅行会社ツアーバス), **own car** (自家用車),
  **rental car** (レンタカー) and **other** (taxi, rental bike, other; walking only when it is the only answer).
  Several answers split equally. Range: 95% interval from the number of answers.
- **Visitors**: `visitors_est` in `real_data.json` (each site's signal scaled to its official 2025 count) for the
  last 30 days, and the official 2025 count for the year. Fukui Station has no visitor estimate, so it shows shares
  only. Awara Onsen's estimate is overnight hotel guests.
- Last 30 days (Sep 2026), five sites, 447k visitors: train 25k (6%), bus 66k (15%), own car 277k (62%), rental
  car 64k (14%), other 16k (3%).
- Caveats: respondents choose to answer (survey app users), so shares can lean that way; Katsuyama has the most
  visitors, so its car-heavy split weighs most in the total.

```bash
python transport/build_modes.py --survey-dir path/to/fukui-kanko-survey   # default $DHDE_WORKSPACE_ROOT/fukui-kanko-survey
```

## Step 0: sources checked

| Mode | Source | What's in it | Licence | Status |
|---|---|---|---|---|
| Bus | [Fukui Prefecture GTFS-JP page](https://www.pref.fukui.lg.jp/doc/dx-suishin/opendata/gtfs_jp.html): Keifuku Bus, Fukutetsu Bus, Katsuyama, Eiheiji and Sakai community buses (26 feeds on the page; the 5 serving the nodes are used) | Full timetables, stops, Keifuku route shapes | CC BY 4.0 per the prefecture | **Keifuku: confirm.** Its own `feed_info` says to get the bus company's permission before using it to guide passengers, and forbids registering it under a CC licence. Fukutetsu's file expired 31 Mar 2026 (the build uses the same week a year earlier) |
| Rail | [University of Tokyo research GTFS](https://gtfs-gis.jp/gtfs4research/): Fukui Railway (Fukubu line) and Echizen Railway (Mikuni-Awara, Katsuyama-Eiheiji lines) | Timetables as of 1 Oct 2024, valid to 14 Mar 2025 | **Research and survey use only**; not official, not operator-approved | **Needs the operators' data or approval** before the public site shows it. Times may be out of date |
| Rail | Hokuriku Shinkansen, JR Obama Line (JR West) | Not published as open data. Not in the national [GTFS data repository](https://gtfs-data.jp/) either (no Fukui feeds there at all) | | Kanazawa and Kyoto journey times are **Estimated** (config `long_distance`) |
| Car | JARTIC, TomTom, Rainbow Line cameras | Already live in the Traffic layer | | Parking capacity still to source |
| Walking | [Valhalla](https://valhalla1.openstreetmap.de) pedestrian isochrones on OpenStreetMap | 15 and 30-minute walking areas per node | ODbL, © OpenStreetMap contributors | Real |
| Cycling | No open rental data found | | | Pending (Federation ask) |
| Interest | Google Trends via pytrends | Weekly 0-100 index for えちぜん鉄道, 京福バス, 北陸新幹線 福井, レンタカー 福井, レンタサイクル 福井 | Google terms; unofficial API | Illustrative. Route Searches are already in the Search intent layer |
| Mode share | Fukui Prefecture tourism survey, 福井県内での交通手段 (already ingested by the preprocessing repo) | Per-response mode answers at each site's survey area | CC BY 4.0 | Modelled (top of the Transport page). Survey v2's own question can replace or check it later |

Not checked here because the plan said to go through it first: Tuboer's data source inventory. Compare before adding
any new source.

## What the data shows (reference week of 5 Oct 2026)

**Buses only.** Timetables that ended before the reference week are left out entirely: today that is the Fukui
Railway + Echizen Railway research feed (ended 14 Mar 2025) and Fukutetsu Bus (ended 31 Mar 2026). With no current
open rail timetable, trips that visitors would normally make by train show the slower bus-only route, so the
Katsuyama, Awara Onsen and Tojinbo journey times below overstate the real trip. Rail is Pending until Echizen Railway
and Fukui Railway publish a timetable.

| Node | Weekday departures (any direction) | Quickest bus trip from Fukui Station | Last bus back to Fukui Station (weekday / Sat) |
|---|---|---|---|
| Tojinbo | 26 | 2 h 10 min | 18:53 / 17:23 |
| Katsuyama (Dinosaur Museum) | 7 | 3 h 59 min (bus only; by train about 1 h) | 17:07 / 16:30 |
| Eiheiji | 21 | 28 min, + 9 min walk to the temple | 16:56 / 16:45 |
| Awara Onsen | 26 | 1 h 58 min | 18:27 / 16:57 |
| Rainbow Line | none: the Gokoichi bus is in the expired Fukutetsu feed | — | car only |
| Fukui Station (hub) | 345 | | |

Eiheiji, whose direct buses are in a current feed, still shows the early last return the plan expected (16:45 at
weekends). The other last returns are bus-only and need the rail timetable before they can be quoted.

## How the numbers are made

- **Stops serving a node**: every stop within `radius_m` (straight line) of the node's access point. The access
  point is the node's map pin, except Katsuyama, which uses the Dinosaur Museum.
- **Departures**: trips that leave a node stop for somewhere else, each trip counted once.
- **Journeys**: a Connection Scan over all the feeds together for one service day, stop to stop, with walking
  changes between stops up to 300 m apart (walk + 3 min). Walking is straight-line distance × 1.3 at 80 m/min. The
  walk from the nearest stop to the site is shown separately, not added. Every trip shown carries its itinerary,
  and its minutes are arrive minus depart in whole clock minutes, so the numbers always add up
  (`check_transport.mjs` enforces this). "Quickest" is the shortest such trip of the day. "Last back" is the last bus
  or train leaving the site's stops that still reaches Fukui Station by 24:59.
- **Kanazawa and Kyoto**: JR timetables are not open data, so the JR leg is a fixed estimate to a gateway station:
  Fukui (Kanazawa 25 min, Kyoto 90 min) or Awara-Onsen (Kanazawa 25, Kyoto 100), then 5 min to change and the quickest
  local trip from that gateway on the selected day. The faster gateway wins, so the result changes by day and Awara
  Onsen is no longer routed through Fukui.
- **Day types and expired feeds**: the next Wednesday, Saturday and Sunday. A feed that ended before that week is not
  used at all (the page lists it as "Expired · not used"). A feed that hasn't started yet uses the same weekday 52
  weeks earlier, so seasonal services stay in season.
- **Status badge on the card**: "Real · timetable" when every feed behind the numbers is openly licensed, "licence
  to confirm" when Keifuku is involved, and "Research timetable" when rail is involved. Journey times can use any
  feed, so any node with a journey shows the research badge until the rail data question is settled.

## Data fields (to agree with Sohail)

`transport.json` → `nodes.<id>`:

| Field | Meaning |
|---|---|
| `anchor`, `radius_m`, `stops[]` | access point; stops in range with `distance_m`, `walk_min` |
| `days.<weekday\|saturday\|sunday>.departures`, `departures_by_mode`, `first_departure`, `last_departure`, `first_arrival`, `last_arrival` | service level; times `HH:MM`, past 24:00 for after midnight |
| `days.*.routes[]` | routes calling there: `name`, `mode`, `feed`, `trips` |
| `days.*.from_hub` | `fastest_min`, `typical_min`, `journeys`, `first_arrival`, `leave_0900 {depart, arrive, minutes}` |
| `days.*.to_hub` | `leave`, `from_stop`, `arrive_hub`, `minutes`; `car_only_after` = `to_hub.leave` or `"all day"` |
| `from_far.<kanazawa\|kyoto>` | `minutes` (estimated JR leg + typical local journey), `basis` |
| `modes`, `feeds` | modes serving the node; feeds behind it |

Top level: `sources[]` (licence, `publish_status` `ok` / `check` / `research_only`, validity), `reference_days`,
`timetable_dates` (the date actually used per feed). Types: `src/types/transport.ts`.

## Open questions

1. **Rail data**: ask Echizen Railway and Fukui Railway for their own GTFS, or for approval to show figures derived
   from the research feed. Until then, should the public site hide rail-based journey times?
2. **Keifuku Bus**: confirm the licence with the company. It is the main operator for Tojinbo, Eiheiji and Awara.
3. **Shinkansen and JR**: is the estimated Kanazawa (34 min) and Kyoto (90 min) leg good enough, or is it worth a
   paid timetable source?
4. From the plan: priority (what's available vs what's used), Google Routes API vs free OpenStreetMap routing (OSM
   used here), real-time data (out of scope here).
