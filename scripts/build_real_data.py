#!/usr/bin/env python3
"""
Turn dhde-preprocessing-model's per-node master tables into public/data/real_data.json.

    python scripts/build_real_data.py --input ~/output --out public/data/real_data.json [--today 2026-09-27]

The app reads this file on top of the demo files: wherever a real value exists
it replaces the demo value, everywhere else the demo stays (and keeps its
"Demo data" badge). This script never touches the demo files.

Visitor estimates
-----------------
No node counts unique visitors directly. Camera "count" is detections (about
9x the prefecture's official annual figure at Tojinbo), Rainbow Line counts
vehicles, Katsuyama has museum bookings, Awara and Eiheiji only proxies. So
each node's daily signal is scaled so its 2025 total equals the prefecture's
official 2025 visitor count for that site (観光客入込数, 2025 edition):

    visitors_est[d] = signal[d] * official_2025 / sum(signal over 2025)

Status "modelled". Nodes without an official figure (Fukui Station) keep the
raw signal only and visitors_est stays null.

7-day forecast
--------------
With --forecast (dhde-preprocessing-model's forecast_fukui.csv, from
scripts/build_forecast.py), each node gets a "forecast" block: the model's
prediction and low/high range for the next 7 days, in the node's own signal
and in visitors, plus its backtest error. Visitors use this file's own
calibration factor (the same one as the history), so the forecast joins the
observed line without a jump. A node is skipped when the model forecasts a
different measure than the app's signal for it (Awara: the model forecasts
hotel guests, the app shows the nearest-camera proxy); the app then keeps its
naive same-weekday forecast there.

Fails loudly (non-zero exit, no file written) if the output would be empty or
malformed, so a bad build can never replace a good file.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

JST = timezone(timedelta(hours=9))
HISTORY_DAYS = 90
FORWARD_DAYS = 90

# 観光客入込数 2025 edition (Fukui Prefecture, released 12 Jun 2026), gross visits.
OFFICIAL_2025 = {
    "tojinbo": 651_000,
    "katsuyama": 1_562_000,   # dinosaur museum area
    "rainbow_line": 443_000,
    "eiheiji": 518_000,
    "awara_onsen": 658_000,
}
OFFICIAL_SOURCE = "Fukui Pref. 観光客入込数 2025 (released 12 Jun 2026)"

# Which column carries each node's daily visitor signal, in order of preference.
SIGNALS = [
    ("count", "camera"),
    ("vehicles", "vehicles"),                 # derived: sum of *_vehicle_count
    ("reserved_visitors", "reservations"),
    ("proxy_camera_count", "proxy_camera"),
    ("proxy_survey_count", "proxy_survey"),
]

# How far one unit of signal is from one visitor, per measure. Survey proxies
# are sparse (a response stands for hundreds of visitors), so they get a wide
# bound and low confidence rather than being dropped.
FACTOR_BOUNDS = {
    "camera": (0.01, 10), "vehicles": (0.1, 20), "reservations": (0.5, 10),
    "proxy_camera": (0.01, 50), "proxy_survey": (1, 5000),
}
CONFIDENCE = {
    "camera": "medium", "vehicles": "medium", "reservations": "high",
    "proxy_camera": "low", "proxy_survey": "low",
}

DAILY_FIELDS = {
    "temp": "temp_c",
    "precip": "precip_mm",
    "wind": "wind_ms",
    "sun": "sun_h",
    "humidity": "humidity_pct",
    "snow_depth": "snow_cm",
    "volume_total": "traffic_volume",
    "occ": "hotel_occ",
    "adr": "hotel_adr_yen",
    "n_room": "hotel_rooms_sold",
    "capacity": "hotel_rooms_total",
    "survey_response_count": "survey_responses",
    "map_views": "gmb_map_views",
    "search_views": "gmb_search_views",
    "directions": "gmb_directions",
    "average_rating": "gmb_rating",
    "review_count_change": "gmb_review_change",
}

# The master-table column each node's 7-day forecast predicts (forecast.TARGETS in
# dhde-preprocessing-model, in master-table names). A forecast is published only
# where this matches the node's signal_column, so both are in the same units.
FORECAST_SIGNAL = {
    "tojinbo": "count",
    "fukui_station": "count",
    "rainbow_line": "vehicles",
    "katsuyama": "reserved_visitors",
    "awara_onsen": "n_people",
}

AS_OF_GROUPS = {
    "visitors": ["count", "vehicles", "reserved_visitors", "proxy_camera_count", "proxy_survey_count"],
    "weather": ["temp", "precip"],
    "traffic": ["volume_total"],
    "hotel": ["occ"],
    "survey": ["survey_response_count"],
    "google_maps": ["map_views", "average_rating"],
}


def clean(v):
    if v is None:
        return None
    if isinstance(v, (bool,)):
        return v
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, 3)


def last_date(m: pd.DataFrame, cols: list[str], today: pd.Timestamp) -> str | None:
    dates = []
    for c in cols:
        if c in m.columns:
            s = m.loc[m[c].notna() & (m["date"] <= today), "date"]
            if not s.empty:
                dates.append(s.max())
    return max(dates).date().isoformat() if dates else None


def node_block(node: str, m: pd.DataFrame, today: pd.Timestamp) -> dict:
    m = m.copy()
    m["date"] = pd.to_datetime(m["date"]).dt.normalize()
    m = m.drop_duplicates("date").sort_values("date")
    veh = [c for c in m.columns if c.endswith("_vehicle_count")]
    if veh:
        m["vehicles"] = m[veh].sum(axis=1, min_count=1)

    signal_col, measure = None, None
    for col, kind in SIGNALS:
        if col in m.columns and m[col].notna().any():
            signal_col, measure = col, kind
            break

    calib = {"official_annual_2025": OFFICIAL_2025.get(node), "signal_sum_2025": None,
             "factor": None, "source": OFFICIAL_SOURCE, "status": "none"}
    if signal_col:
        y25 = m[(m["date"] >= "2025-01-01") & (m["date"] <= "2025-12-31")][signal_col]
        total = float(y25.sum()) if y25.notna().any() else 0.0
        calib["signal_sum_2025"] = round(total)
        calib["signal_days_2025"] = int(y25.notna().sum())
        if OFFICIAL_2025.get(node) and total > 0 and y25.notna().sum() >= 300:
            calib["factor"] = OFFICIAL_2025[node] / total
            calib["status"] = "modelled"
        elif OFFICIAL_2025.get(node):
            calib["status"] = "insufficient_2025_signal"

    hist = m[(m["date"] > today - pd.Timedelta(days=HISTORY_DAYS)) & (m["date"] <= today)]
    daily = []
    for _, r in hist.iterrows():
        rec = {"date": r["date"].date().isoformat()}
        sig = clean(r[signal_col]) if signal_col else None
        rec["signal"] = sig
        rec["visitors_est"] = (round(sig * calib["factor"]) if sig is not None and calib["factor"] else None)
        for src, dst in DAILY_FIELDS.items():
            if src in m.columns:
                rec[dst] = clean(r[src])
        # A traffic day with no observed hours is missing, not zero.
        if "hours_observed" in m.columns and not (clean(r["hours_observed"]) or 0) > 0:
            rec["traffic_volume"] = None
        daily.append(rec)

    fwd = m[(m["date"] > today) & (m["date"] <= today + pd.Timedelta(days=FORWARD_DAYS))]
    hotel_forward = [
        {"date": r["date"].date().isoformat(), "hotel_occ": clean(r.get("occ")),
         "hotel_rooms_sold": clean(r.get("n_room")), "hotel_rooms_total": clean(r.get("capacity"))}
        for _, r in fwd.iterrows() if "occ" in m.columns and pd.notna(r.get("occ"))
    ]

    calib["confidence"] = CONFIDENCE.get(measure, "none") if calib["factor"] else "none"
    return {
        "measure": measure,
        "signal_column": signal_col,
        "calibration": {k: (round(v, 6) if isinstance(v, float) else v) for k, v in calib.items()},
        "as_of": {g: last_date(m, cols, today) for g, cols in AS_OF_GROUPS.items()},
        "daily": daily,
        "hotel_forward": hotel_forward,
    }


def forecast_block(node: str, block: dict, fc: pd.DataFrame, report: dict) -> tuple[dict | None, str | None]:
    """(forecast block, reason it was skipped) for one node from forecast_fukui.csv."""
    rows = fc[fc["node_key"] == node].sort_values("date")
    if rows.empty:
        return None, "no forecast rows"
    if FORECAST_SIGNAL.get(node) != block["signal_column"]:
        return None, (f"forecasts {FORECAST_SIGNAL.get(node)} but the app's signal is {block['signal_column']}, "
                      "so they can't share a scale")
    factor = block["calibration"]["factor"]
    days = []
    for _, r in rows.iterrows():
        sig = [clean(r[c]) for c in ("predicted", "low", "high")]
        vis = [round(v * factor) if v is not None and factor else None for v in sig]
        days.append({"date": pd.Timestamp(r["date"]).date().isoformat(),
                     "signal": sig[0], "signal_lo": sig[1], "signal_hi": sig[2],
                     "visitors_est": vis[0], "visitors_lo": vis[1], "visitors_hi": vis[2]})
    first = rows.iloc[0]
    return {
        "model": str(first["model"]),
        "issued_from": pd.Timestamp(first["issued_from"]).date().isoformat(),
        "backtest_wape": clean(first["backtest_wape"]),
        "baseline_wape": clean(first["baseline_wape"]),
        "range_coverage": clean(first["range_coverage"]),
        "interval": report.get("interval"),
        "backtest_weeks": report.get("backtest_weeks"),
        "days": days,
    }, None


def validate(payload: dict) -> list[str]:
    errs = []
    nodes = payload.get("nodes", {})
    if len(nodes) < 1:
        errs.append("no nodes")
    for k, v in nodes.items():
        if not v["daily"]:
            errs.append(f"{k}: no daily rows")
        f = v["calibration"]["factor"]
        lo, hi = FACTOR_BOUNDS.get(v["measure"], (0.001, 100))
        if f is not None and not (lo < f < hi):
            errs.append(f"{k}: implausible calibration factor {f} for {v['measure']}")
        for d in (v.get("forecast") or {}).get("days", []):
            lo_v, est, hi_v = d["signal_lo"], d["signal"], d["signal_hi"]
            if est is None or est < 0 or (lo_v is not None and hi_v is not None and not lo_v <= est <= hi_v):
                errs.append(f"{k}: bad forecast on {d['date']}: {lo_v} <= {est} <= {hi_v}")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="folder with {node}_master.parquet files")
    ap.add_argument("--out", default="public/data/real_data.json")
    ap.add_argument("--today", help="YYYY-MM-DD (default: today, JST)")
    ap.add_argument("--source-commit", default=None, help="dhde-preprocessing-model commit the tables came from")
    ap.add_argument("--forecast", help="forecast_fukui.csv from build_forecast.py (optional; its report JSON is read "
                                       "from the same folder)")
    a = ap.parse_args()

    today = pd.Timestamp(a.today) if a.today else pd.Timestamp(datetime.now(JST).date())
    files = sorted(Path(a.input).expanduser().glob("*_master.parquet"))
    nodes = {}
    for f in files:
        node = f.name.replace("_master.parquet", "")
        nodes[node] = node_block(node, pd.read_parquet(f), today)

    # A missing or unreadable forecast is not fatal: the app falls back to its naive forecast.
    forecast_notes = []
    fc_path = Path(a.forecast).expanduser() if a.forecast else None
    if fc_path and fc_path.exists():
        fc = pd.read_csv(fc_path)
        rep_path = fc_path.with_name("forecast_fukui_report.json")
        report = json.loads(rep_path.read_text(encoding="utf-8")) if rep_path.exists() else {}
        for node, block in nodes.items():
            fb, why = forecast_block(node, block, fc, report)
            if fb:
                block["forecast"] = fb
            elif node in FORECAST_SIGNAL or node in set(fc["node_key"]):
                forecast_notes.append(f"{node}: no 7-day forecast published ({why})")
    elif fc_path:
        forecast_notes.append(f"7-day forecast file not found ({fc_path.name}); the app uses its naive forecast")

    people_dates = [v["as_of"]["visitors"] for v in nodes.values() if v["as_of"]["visitors"]]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "today": today.date().isoformat(),
        "shared_date": min(people_dates) if people_dates else None,
        "source": {"repo": "dhde-tourism-ai/dhde-preprocessing-model", "commit": a.source_commit},
        "notes": [
            "visitors_est = daily signal scaled to the prefecture's official 2025 annual count for the site (modelled).",
            "Camera 'signal' is detections, not unique visitors. Fukui Station has no official site figure, so no estimate.",
            "gmb_* fields are Google Maps Business Profile metrics (views, searches, directions, rating).",
            "forecast = dhde-preprocessing-model's 7-day model (scripts/build_forecast.py), scaled with the same "
            "calibration factor as visitors_est.",
            *forecast_notes,
        ],
        "nodes": nodes,
    }
    errs = validate(payload)
    if errs:
        print("VALIDATION FAILED, not writing:", "; ".join(errs), file=sys.stderr)
        return 1
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(out)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB), shared_date={payload['shared_date']}")
    for k, v in nodes.items():
        c = v["calibration"]
        fcb = v.get("forecast")
        fc_txt = f" forecast={fcb['model']} wape={fcb['backtest_wape']}" if fcb else ""
        print(f"  {k:13s} {v['measure'] or '-':13s} factor={c['factor']} status={c['status']} as_of={v['as_of']['visitors']}{fc_txt}")
    for n in forecast_notes:
        print(f"  note: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
