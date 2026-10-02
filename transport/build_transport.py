#!/usr/bin/env python3
"""
Build public/data/transport.json and public/data/transport_map.json: how
visitors can reach each of the six priority nodes by public transport.

Per node and day type (weekday, Saturday, Sunday/holiday), from the open
GTFS-JP timetables listed in transport/config.json:

- the stops serving the node (within `radius_m` of its access point) and
  the routes calling there
- departures and arrivals per day, by mode, and the first and last of each
- from Fukui Station: the fastest journey, and the journey leaving at 09:00
- back to Fukui Station: the last departure that still gets there today,
  which is also the "car only after HH:MM" time
- Kanazawa and Kyoto: the Fukui Station journey plus an estimated JR leg

The map file holds the route lines and stops serving the nodes, plus the
walking areas from transport/walk_areas.json (fetch_walk_areas.py).

Usage:
    python transport/build_transport.py                 # reference days from today (JST)
    python transport/build_transport.py --date 2026-10-07
    python transport/build_transport.py --refresh       # re-download the feeds
"""
from __future__ import annotations

import argparse
import bisect
import json
import statistics
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gtfs import INF, Network, build_network, earliest_arrival, haversine_m, hhmm, latest_departure, load_feed, walk_seconds  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = HERE / ".cache"
JST = timezone(timedelta(hours=9))
DAY_END = 24 * 3600 + 59 * 60  # trips after midnight still count for the service day
HUB_WINDOW = (5 * 3600, 21 * 3600)  # departures from the hub considered for "from Fukui Station"
DAY_TYPES = {"weekday": 2, "saturday": 5, "sunday": 6}  # Wednesday stands in for a weekday


def reference_days(start: date) -> dict[str, date]:
    try:
        import jpholiday  # optional: skip a weekday that is a public holiday
    except ImportError:
        jpholiday = None
    out = {}
    for name, wd in DAY_TYPES.items():
        d = start + timedelta(days=(wd - start.weekday()) % 7)
        while name == "weekday" and jpholiday and jpholiday.is_holiday(d):
            d += timedelta(days=7)
        out[name] = d
    return out


def fetch(feed: dict, refresh: bool) -> Path:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{feed['id']}.zip"
    if refresh or not path.exists():
        r = requests.get(feed["url"], timeout=120, headers={"User-Agent": "dhde-transport/1.0"})
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


def node_stops(net: Network, anchor: tuple[float, float], radius: float, walk: dict) -> list[dict]:
    out = []
    for i, r in enumerate(net.stops.itertuples()):
        d = haversine_m(anchor[0], anchor[1], r.lat, r.lon)
        if d <= radius:
            out.append({"idx": i, "id": r.stop_id, "name": r.stop_name, "feed": r.feed, "lat": round(r.lat, 6),
                        "lon": round(r.lon, 6), "distance_m": round(d), "walk_s": walk_seconds(d, walk)})
    return out


def service_counts(net: Network, stops: list[dict]) -> dict:
    ids = {s["id"] for s in stops}
    calls = net.calls
    first_seq = calls.groupby("trip_id")["seq"].transform("min")
    last_seq = calls.groupby("trip_id")["seq"].transform("max")
    here = calls[calls["stop_id"].isin(ids)]
    dep = here[here["seq"] < last_seq[here.index]].sort_values("dep").drop_duplicates("trip_id")
    arr = here[here["seq"] > first_seq[here.index]].sort_values("arr").drop_duplicates("trip_id", keep="last")
    by_mode = {m: int(n) for m, n in dep.groupby("mode").size().items()}
    routes = (here.drop_duplicates("trip_id").groupby(["route_id", "name", "mode", "feed"]).size()
              .reset_index(name="calls").sort_values("calls", ascending=False))
    return {
        "departures": int(len(dep)),
        "arrivals": int(len(arr)),
        "departures_by_mode": by_mode,
        "first_departure": hhmm(dep["dep"].min()) if len(dep) else None,
        "last_departure": hhmm(dep["dep"].max()) if len(dep) else None,
        "first_arrival": hhmm(arr["arr"].min()) if len(arr) else None,
        "last_arrival": hhmm(arr["arr"].max()) if len(arr) else None,
        "routes": [{"id": r.route_id, "name": r.name, "mode": r.mode, "feed": r.feed, "trips": int(r.calls)}
                   for r in routes.itertuples()],
    }


def journeys_from_hub(net: Network, hub: list[dict], nodes: dict[str, list[dict]]) -> dict[str, dict]:
    """Every departure time from the hub in HUB_WINDOW -> earliest arrival at each node's access point."""
    times = sorted({int(t) for t in net.calls[net.calls["stop_id"].isin({s["id"] for s in hub})]["dep"]
                    if HUB_WINDOW[0] <= t <= HUB_WINDOW[1]})
    found: dict[str, list[tuple[int, int]]] = {k: [] for k in nodes}
    for t in times:
        ea = earliest_arrival(net, {s["idx"]: t for s in hub})
        for k, stops in nodes.items():
            a = min((ea[s["idx"]] + s["walk_s"] for s in stops if ea[s["idx"]] < INF), default=INF)
            if a < INF:
                found[k].append((t, a))
    out = {}
    for k, pairs in found.items():
        # keep only journeys nobody would beat by leaving later (same or earlier arrival)
        best: list[tuple[int, int]] = []
        for t, a in sorted(pairs, key=lambda p: (-p[0], p[1])):
            if not best or a < best[-1][1]:
                best.append((t, a))
        best.sort()
        if not best:
            out[k] = None
            continue
        mins = [(a - t) / 60 for t, a in best]
        nine = next(((t, a) for t, a in best if t >= 9 * 3600), None)
        out[k] = {
            "journeys": len(best),
            "fastest_min": round(min(mins)),
            "typical_min": round(statistics.median(mins)),
            "first_arrival": hhmm(best[0][1]),
            "leave_0900": None if nine is None else {"depart": hhmm(nine[0]), "arrive": hhmm(nine[1]),
                                                      "minutes": round((nine[1] - nine[0]) / 60)},
        }
    return out


def last_return(net: Network, hub: list[dict], stops: list[dict]) -> dict | None:
    """Latest time to leave the node's access point and still reach the hub today."""
    ld = latest_departure(net, {s["idx"]: DAY_END for s in hub})
    cands = [(ld[s["idx"]] - s["walk_s"], s) for s in stops if ld[s["idx"]] > -INF]
    if not cands:
        return None
    leave, stop = max(cands, key=lambda c: c[0])
    ea = earliest_arrival(net, {stop["idx"]: leave + stop["walk_s"]})
    arrive = min(ea[s["idx"]] for s in hub)
    return {"leave": hhmm(leave), "from_stop": stop["name"], "arrive_hub": hhmm(arrive),
            "minutes": round((arrive - leave) / 60) if arrive < INF else None}


def simplify(path: list[tuple[float, float]], tol_m: float = 25) -> list[list[float]]:
    """Douglas-Peucker in metres, then 5-decimal rounding (about 1 m)."""
    if len(path) < 3:
        return [[round(a, 5), round(b, 5)] for a, b in path]

    def dist(p, a, b):
        if a == b:
            return haversine_m(p[0], p[1], a[0], a[1])
        # planar approximation is fine at these lengths
        k = 111000.0
        ax, ay, bx, by, px, py = a[1] * k * 0.81, a[0] * k, b[1] * k * 0.81, b[0] * k, p[1] * k * 0.81, p[0] * k
        dx, dy = bx - ax, by - ay
        u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return ((ax + u * dx - px) ** 2 + (ay + u * dy - py) ** 2) ** 0.5

    keep = [False] * len(path)
    keep[0] = keep[-1] = True
    stack = [(0, len(path) - 1)]
    while stack:
        i, j = stack.pop()
        far, idx = 0.0, None
        for m in range(i + 1, j):
            d = dist(path[m], path[i], path[j])
            if d > far:
                far, idx = d, m
        if idx is not None and far > tol_m:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [[round(p[0], 5), round(p[1], 5)] for p, k in zip(path, keep) if k]


def route_lines(feeds: list, net: Network, route_ids: set[str]) -> list[dict]:
    by_feed = {f.id: f for f in feeds}
    stops = net.stops.set_index("stop_id")
    lines = []
    for rid in sorted(route_ids):
        f = by_feed[rid.split(":", 1)[0]]
        trips = f.trips[f.trips["route_id"] == rid]
        if trips.empty:
            continue
        route = f.routes[f.routes["route_id"] == rid].iloc[0]
        st = f.stop_times[f.stop_times["trip_id"].isin(trips["trip_id"])]
        longest = st.groupby("trip_id").size().idxmax()
        path = None
        if f.shapes is not None and "shape_id" in trips:
            sid = trips.loc[trips["trip_id"] == longest, "shape_id"].iloc[0]
            pts = f.shapes[f.shapes["shape_id"] == sid].sort_values("seq")
            if len(pts) >= 2:
                path = list(zip(pts["lat"], pts["lon"]))
        if path is None:
            seq = st[st["trip_id"] == longest].sort_values("seq")["stop_id"]
            path = [(stops.at[s, "lat"], stops.at[s, "lon"]) for s in seq if s in stops.index]
        colour = route.get("route_color", "") or ""
        lines.append({"id": rid, "name": route["name"], "mode": route["mode"], "feed": f.id,
                      "colour": f"#{colour}" if len(colour) == 6 else None, "path": simplify(path)})
    return lines


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="start of the reference week (default: today, JST)")
    ap.add_argument("--refresh", action="store_true", help="re-download the feeds")
    ap.add_argument("--out-dir", default=str(ROOT / "public" / "data"))
    args = ap.parse_args()

    cfg = json.loads((HERE / "config.json").read_text())
    registry = {n["id"]: n for n in json.loads((ROOT / "public" / "data" / "nodes.json").read_text())["nodes"]}
    walk = cfg["walk"]
    start = date.fromisoformat(args.date) if args.date else datetime.now(JST).date()
    days = reference_days(start)

    feeds, sources = [], []
    for fc in cfg["feeds"]:
        f = load_feed(fetch(fc, args.refresh), fc["id"], fc["mode"])
        feeds.append(f)
        sources.append({k: fc.get(k) for k in ("id", "name", "name_ja", "mode", "url", "page", "licence", "licence_url",
                                                "caveat", "caveat_ja", "publish_status")}
                       | {"agency": f.agency, "valid_from": f.valid_from and f.valid_from.isoformat(),
                          "valid_to": f.valid_to and f.valid_to.isoformat()})
        print(f"  {fc['id']}: {len(f.trips)} trips, valid {f.valid_from} .. {f.valid_to}")

    hub_id = cfg["hub"]
    anchors = {}
    for k, nc in cfg["nodes"].items():
        a = nc.get("anchor") or {"lat": registry[k]["lat"], "lon": registry[k]["lon"],
                                 "label": registry[k]["name"], "label_ja": registry[k]["name_ja"]}
        anchors[k] = a

    nodes_out: dict[str, dict] = {k: {"anchor": anchors[k], "radius_m": cfg["nodes"][k]["radius_m"],
                                      "note": cfg["nodes"][k].get("note"), "note_ja": cfg["nodes"][k].get("note_ja"),
                                      "days": {}} for k in cfg["nodes"]}
    used_dates: dict[str, dict[str, str]] = {}
    weekday_routes: set[str] = set()
    map_stops: dict[str, dict] = {}

    for day, d in days.items():
        net = build_network(feeds, d, walk)
        used_dates[day] = net.used_dates
        stops = {k: node_stops(net, (a["lat"], a["lon"]), cfg["nodes"][k]["radius_m"], walk) for k, a in anchors.items()}
        hub = stops[hub_id]
        others = {k: v for k, v in stops.items() if k != hub_id and v}
        from_hub = journeys_from_hub(net, hub, others)
        for k, st in stops.items():
            served = [s for s in st if s["id"] in set(net.calls["stop_id"])]
            entry = service_counts(net, served) if served else {"departures": 0, "arrivals": 0, "routes": []}
            if k != hub_id:
                entry["from_hub"] = from_hub.get(k)
                entry["to_hub"] = last_return(net, hub, served) if served else None
                entry["car_only_after"] = entry["to_hub"]["leave"] if entry["to_hub"] else "all day"
            nodes_out[k]["days"][day] = entry
            if day == "weekday":
                weekday_routes |= {r["id"] for r in entry["routes"]}
                for s in served:
                    m = map_stops.setdefault(s["id"], {"id": s["id"], "name": s["name"], "feed": s["feed"],
                                                       "lat": s["lat"], "lon": s["lon"], "nodes": []})
                    m["nodes"].append(k)
                nodes_out[k]["stops"] = [{key: s[key] for key in ("id", "name", "feed", "lat", "lon", "distance_m")}
                                         | {"walk_min": round(s["walk_s"] / 60)} for s in served]
        print(f"  {day} {d}: {len(net.conns)} connections")
        if day == "weekday":
            lines = route_lines(feeds, net, weekday_routes)

    for k, n in nodes_out.items():
        wk = n["days"]["weekday"]
        fh = wk.get("from_hub")
        n["from_far"] = {
            city: {"name": ld["name"], "name_ja": ld["name_ja"], "status": ld["status"], "basis": ld["basis"],
                   "minutes": (ld["to_hub_min"] + (fh["typical_min"] if fh else 0)) if (fh or k == hub_id) else None}
            for city, ld in cfg["long_distance"].items()
        }
        modes = sorted({r["mode"] for r in wk.get("routes", [])})
        n["modes"] = modes + ["car"]
        n["feeds"] = sorted({r["feed"] for r in wk.get("routes", [])})

    meta = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "timezone": "Asia/Tokyo",
            "hub": hub_id, "reference_days": {k: v.isoformat() for k, v in days.items()}, "timetable_dates": used_dates,
            "walk": walk}
    transport = meta | {
        "note": "Public transport access per node from open GTFS-JP timetables (transport/README.md). Times are scheduled, "
                "not live. Journey times include the walk between the stop and the node's access point (straight line x "
                f"{walk['detour_factor']} at {walk['speed_m_per_min']} m/min). Kanazawa and Kyoto add an estimated JR leg.",
        "sources": sources,
        "nodes": nodes_out,
    }
    walk_file = HERE / "walk_areas.json"
    walk_areas = json.loads(walk_file.read_text()) if walk_file.exists() else None
    tmap = meta | {"lines": lines, "stops": sorted(map_stops.values(), key=lambda s: s["id"]),
                   "walk_areas": walk_areas}
    out = Path(args.out_dir)
    (out / "transport.json").write_text(json.dumps(transport, ensure_ascii=False, indent=1) + "\n")
    (out / "transport_map.json").write_text(json.dumps(tmap, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"[OK] wrote {out / 'transport.json'} and transport_map.json ({len(lines)} lines, {len(map_stops)} stops)")
    for k, n in nodes_out.items():
        wk = n["days"]["weekday"]
        fh, th = wk.get("from_hub"), wk.get("to_hub")
        print(f"  {k:14s} deps {wk['departures']:4d} {wk.get('departures_by_mode', {})} "
              f"first {wk.get('first_departure')} last {wk.get('last_departure')} | "
              f"from hub fastest {fh and fh['fastest_min']} min, 09:00 -> {fh and fh['leave_0900']} | "
              f"last return {th}")


if __name__ == "__main__":
    main()
