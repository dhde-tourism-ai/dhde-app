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
| Mode share | Survey v2 "How did you get here?" | | | Pending: the card shows `[pending]` |

Not checked here because the plan said to go through it first: Tuboer's data source inventory. Compare before adding
any new source.

## What the data shows (reference week of 5 Oct 2026)

| Node | Weekday departures | Fastest from Fukui Station | Last public transport back to Fukui Station |
|---|---|---|---|
| Tojinbo | 26 bus | 79 min | 18:47 (weekend 18:18) |
| Katsuyama (Dinosaur Museum) | 7 bus | 72 min (weekend 61) | **17:06**, every day |
| Eiheiji | 21 bus | 37 min | 18:10, **weekend 16:36** |
| Awara Onsen | 93 (67 rail, 26 bus) | 46 min | 22:13 |
| Rainbow Line | none on weekdays; 6 weekend summit buses (Jul to Nov) | no public transport link | car only |
| Fukui Station (hub) | 471 | | |

This supports the plan's day-trip hypothesis: from the Dinosaur Museum, the last way back without a car leaves at
17:06, and from Eiheiji at 16:36 at weekends. The card flags any last return at 17:30 or earlier.

## How the numbers are made

- **Stops serving a node**: every stop within `radius_m` (straight line) of the node's access point. The access
  point is the node's map pin, except Katsuyama, which uses the Dinosaur Museum.
- **Departures**: trips that leave a node stop for somewhere else, each trip counted once.
- **Journeys**: a Connection Scan over all the feeds together for one service day, with walking changes between stops
  up to 300 m apart (+3 min to change). Walking is straight-line distance × 1.3 at 80 m/min, including the walk
  between the stop and the access point. "Fastest" is the quickest journey of the day that no later departure beats.
  "Last return" is the latest departure that still reaches Fukui Station by 24:59.
- **Day types**: the next Wednesday, Saturday and Sunday. A feed that doesn't cover the date uses the same weekday 52
  weeks earlier, so seasonal services such as the Rainbow Line summit bus stay in season.
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
