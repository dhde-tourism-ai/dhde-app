#!/usr/bin/env python3
"""
Turn dhde-preprocessing-model's per-node master tables into public/data/real_data.json.

    python scripts/build_real_data.py --input ~/output --out public/data/real_data.json [--today 2026-09-27]

The app reads this file on top of the demo files: wherever a real value exists
it replaces the demo value, everywhere else the demo stays (and keeps its
"Demo data" badge). This script never touches the demo files.

Visitor estimates
-----------------
No node counts unique visitors directly: Tojinbo and Fukui Station count
camera detections, Rainbow Line cars at the summit car parks, Katsuyama
museum bookings, Awara Onsen hotel guests, Eiheiji only a proxy. Each node's
signal is the measure its 7-day forecast predicts (FORECAST_SIGNAL), so
history and forecast share one unit, and is turned into visitors with one
factor per node:

    visitors_est[d] = signal[d] * factor

With --calibration (dhde-preprocessing-model's calibration_check.csv, from
scripts/check_calibration.py) the factor is the pipeline's: official visitors
over the node's own official period (the museum's FY2025 entries for
Katsuyama), divided by the mean daily signal in that period times its days.
See docs/calibration.md there. Without it, or for a node it has no factor
for (Eiheiji), the fallback scales the signal's 2025 total to the
prefecture's 2025 count (観光客入込数). Status "modelled".

A calibration problem never stops the refresh: an unreadable file or a
renamed column drops the pipeline factors for every node, and a pipeline
factor outside FACTOR_BOUNDS drops it for that node; either way those nodes
use the 2025-sum fallback and the reason goes into the notes.

Fukui Station has no official site figure, so it keeps the raw signal and
visitors_est stays null. Every node also gets signal_index_pct: the day's
signal as a % of the node's mean 2025 day, a unit-free "how busy" figure.

7-day forecast
--------------
With --forecast (dhde-preprocessing-model's forecast_fukui.csv, from
scripts/build_forecast.py), each node gets a "forecast" block: the model's
prediction and low/high range for the next 7 days, in the node's own signal
and in visitors, plus its backtest error. Visitors use the same factor as the
history, so the forecast joins the observed line without a jump. A node is
skipped when the model forecasts a different measure than the app's signal
for it (only when that node's forecast column is empty in its table); the
app then keeps its naive same-weekday forecast there.

A forecast problem never stops the refresh: an unreadable file or a renamed
column drops the forecast for every node, and a bad row (no prediction, or a
range that doesn't contain it) drops that node's forecast; each goes into the
notes. Days the model ran without its week-ahead bookings are flagged
(week_ahead_missing) and the app uses its naive forecast for them. The
low/high range is the 5th-95th percentile of past errors but held about 80%
of unseen backtest days (range_coverage), so it is an ~80% range, not 90%.

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

# Which column carries each node's daily visitor signal, in order of preference,
# for nodes without a FORECAST_SIGNAL (or whose forecast column is empty).
SIGNALS = [
    ("count", "camera"),
    ("vehicles", "vehicles"),                 # derived: sum of *_vehicle_count
    ("reserved_visitors", "reservations"),
    ("proxy_camera_count", "proxy_camera"),
    ("proxy_survey_count", "proxy_survey"),
]
MEASURE_OF = {**dict(SIGNALS), "n_people": "hotel_guests"}

# How each measure reads in a method line: (label, label_ja, unit, unit_ja).
MEASURE_TEXT = {
    "camera": ("camera detections", "カメラ検知数", "detection", "検知"),
    "vehicles": ("cars at the summit car parks", "山頂駐車場の車両数", "car", "台"),
    "reservations": ("museum bookings", "博物館の予約数", "booking", "予約"),
    "hotel_guests": ("guests at the hotels in the feed", "対象ホテルの宿泊者数", "guest", "人"),
    "proxy_camera": ("nearest-camera proxy", "近隣カメラの代理指標", "detection", "検知"),
    "proxy_survey": ("survey proxy", "アンケート代理指標", "response", "件"),
}

# How far one unit of signal is from one visitor, per measure. Survey proxies
# are sparse (a response stands for hundreds of visitors), so they get a wide
# bound and low confidence rather than being dropped.
FACTOR_BOUNDS = {
    "camera": (0.01, 10), "vehicles": (0.1, 20), "reservations": (0.5, 10), "hotel_guests": (0.5, 10),
    "proxy_camera": (0.01, 50), "proxy_survey": (1, 5000),
}
# hotel_guests is low: only the 10 hotels in the Awara feed, and their season
# follows the onsen, not the town's day trips (corr 0.55, docs/calibration.md).
CONFIDENCE = {
    "camera": "medium", "vehicles": "medium", "reservations": "high", "hotel_guests": "low",
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
    # Google Maps reviews (google_reviews source, from the live-data branch).
    "reviews_new": "reviews_new",
    "reviews_stars_mean": "reviews_stars_mean",
    "reviews_stars_1": "reviews_stars_1",
    "reviews_stars_2": "reviews_stars_2",
    "reviews_stars_3": "reviews_stars_3",
    "reviews_stars_4": "reviews_stars_4",
    "reviews_stars_5": "reviews_stars_5",
    "reviews_with_text": "reviews_with_text",
    "reviews_foreign": "reviews_foreign",
    "reviews_rating_total": "reviews_rating_total",
    "reviews_count_total": "reviews_count_total",
    # Instagram posts tagged at the site (instagram source, from the live-data branch).
    "instagram_posts": "instagram_posts",
    "instagram_photos": "instagram_photos",
    "instagram_videos": "instagram_videos",
    "instagram_likes": "instagram_likes",
    "instagram_comments": "instagram_comments",
    "instagram_script_ja": "instagram_script_ja",
    "instagram_script_ko": "instagram_script_ko",
    "instagram_script_zh": "instagram_script_zh",
    "instagram_script_latin": "instagram_script_latin",
    "instagram_script_none": "instagram_script_none",
}
RAKUTEN_LEADS = (1, 7, 30)

# Survey summary (survey_block): the FTAS survey's daily columns from
# dhde-preprocessing-model sources/survey.py, over the 30 days to its last response.
SURVEY_DAYS = 30
MIN_SURVEY_RESPONSES = 10
# A survey whose last response is older than this is stale: no summary, so the app
# drops the "Real" badge instead of showing old numbers as current.
SURVEY_MAX_AGE_DAYS = 14

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

# "visitors" is the node's own signal column (set in node_block), so a hotel
# feed's later dates can't make a camera node look more up to date than it is.
AS_OF_GROUPS = {
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


def period_label(period: list[str] | None) -> tuple[str, str]:
    """Official period -> ("2025", "2025年") / ("FY2025", "2025年度") / a date range."""
    if not period:
        return "2025", "2025年"
    start, end = period
    if start[5:] == "01-01" and end[5:] == "12-31" and start[:4] == end[:4]:
        return start[:4], f"{start[:4]}年"
    if start[5:] == "04-01" and end[5:] == "03-31" and int(end[:4]) == int(start[:4]) + 1:
        return f"FY{start[:4]}", f"{start[:4]}年度"
    return f"{start} to {end}", f"{start}〜{end}"


def method_text(measure: str, factor: float, official: float, period: tuple[str, str]) -> tuple[str, str]:
    """One line saying how the signal became visitors, e.g. for Rainbow Line
    "cars at the summit car parks x 6.98 visitors per car (official 443,000, 2025)"."""
    label, label_ja, unit, unit_ja = MEASURE_TEXT.get(measure, (measure, measure, "unit", "単位"))
    if factor >= 1:
        rate, rate_ja = f"x {factor:.2f} visitors per {unit}", f"1{unit_ja}あたり{factor:.2f}人"
    else:
        rate, rate_ja = f"/ {1 / factor:.2f} {unit}s per visitor", f"1人あたり{1 / factor:.2f}{unit_ja}"
    return (f"{label} {rate} (official {official:,.0f}, {period[0]})",
            f"{label_ja}、{rate_ja}（公式値{official:,.0f}人・{period[1]}）")


def pick_signal(node: str, m: pd.DataFrame) -> tuple[str | None, str | None]:
    """(signal column, measure): the forecast's column where it has data, else SIGNALS in order."""
    col = FORECAST_SIGNAL.get(node)
    if col and col in m.columns and m[col].notna().any():
        return col, MEASURE_OF.get(col, col)
    for col, kind in SIGNALS:
        if col in m.columns and m[col].notna().any():
            return col, kind
    return None, None


def node_block(node: str, m: pd.DataFrame, today: pd.Timestamp, pipeline_calib: dict | None = None,
               notes: list[str] | None = None) -> dict:
    m = m.copy()
    m["date"] = pd.to_datetime(m["date"]).dt.normalize()
    m = m.drop_duplicates("date").sort_values("date")
    veh = [c for c in m.columns if c.endswith("_vehicle_count")]
    if veh:
        m["vehicles"] = m[veh].sum(axis=1, min_count=1)

    signal_col, measure = pick_signal(node, m)

    calib = {"official_annual_2025": OFFICIAL_2025.get(node), "signal_sum_2025": None,
             "factor": None, "source": OFFICIAL_SOURCE, "status": "none", "method": "none"}
    typical = None
    if signal_col:
        y25 = m[(m["date"] >= "2025-01-01") & (m["date"] <= "2025-12-31")][signal_col]
        total = float(y25.sum()) if y25.notna().any() else 0.0
        calib["signal_sum_2025"] = round(total)
        calib["signal_days_2025"] = int(y25.notna().sum())
        typical = float(y25.mean()) if y25.notna().sum() >= 300 and y25.mean() > 0 else None
        pc = pipeline_calib or {}
        lo, hi = FACTOR_BOUNDS.get(measure, (0.001, 100))
        if pc.get("factor") and not lo < pc["factor"] < hi:
            if notes is not None:
                notes.append(f"{node}: pipeline calibration factor {pc['factor']} is outside {lo} to {hi} for "
                             f"{measure}, so it uses the 2025-sum fallback")
            pc = {}
        if pc.get("factor"):
            calib["factor"] = pc["factor"]
            calib["official_annual_2025"] = pc["official_visitors"]
            calib["official_period"] = pc["official_period"]
            calib["source"] = pc["source"]
            calib["status"] = "modelled"
            calib["method"] = "pipeline"
        elif OFFICIAL_2025.get(node) and total > 0 and y25.notna().sum() >= 300:
            calib["factor"] = OFFICIAL_2025[node] / total
            calib["official_period"] = ["2025-01-01", "2025-12-31"]
            calib["status"] = "modelled"
            calib["method"] = "app_2025_sum"
        elif OFFICIAL_2025.get(node):
            calib["status"] = "insufficient_2025_signal"
    if calib["factor"]:
        period = period_label(calib.get("official_period"))
        calib["official_period_label"], calib["official_period_label_ja"] = period
        calib["method_text"], calib["method_text_ja"] = method_text(
            measure, calib["factor"], calib["official_annual_2025"], period)

    hist = m[(m["date"] > today - pd.Timedelta(days=HISTORY_DAYS)) & (m["date"] <= today)]
    daily = []
    for _, r in hist.iterrows():
        rec = {"date": r["date"].date().isoformat()}
        sig = clean(r[signal_col]) if signal_col else None
        rec["signal"] = sig
        rec["visitors_est"] = (round(sig * calib["factor"]) if sig is not None and calib["factor"] else None)
        rec["signal_index_pct"] = round(sig / typical * 100) if sig is not None and typical else None
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
        "as_of": {"visitors": last_date(m, [signal_col], today) if signal_col else None,
                  **{g: last_date(m, cols, today) for g, cols in AS_OF_GROUPS.items()}},
        "daily": daily,
        "hotel_forward": hotel_forward,
        "rakuten": rakuten_block(m, today),
        "survey": survey_block(m, today),
    }


def flag(v) -> bool:
    """A CSV boolean (True/False, 1/0, or blank) as a bool."""
    return str(v).strip().lower() in ("true", "1", "yes")


def forecast_block(node: str, block: dict, fc: pd.DataFrame, report: dict) -> tuple[dict | None, str | None]:
    """(forecast block, reason it was skipped) for one node from forecast_fukui.csv.

    Every check lives here, not in validate(): a bad forecast row drops this
    node's forecast only, never the whole real_data.json.
    """
    rows = fc[fc["node_key"] == node].sort_values("date")
    if rows.empty:
        return None, "no forecast rows"
    if FORECAST_SIGNAL.get(node) != block["signal_column"]:
        return None, (f"forecasts {FORECAST_SIGNAL.get(node)} but the app's signal is {block['signal_column']}, "
                      "so they can't share a scale")
    factor = block["calibration"]["factor"]
    days = []
    for _, r in rows.iterrows():
        date = pd.Timestamp(r["date"]).date().isoformat()
        sig = [clean(r[c]) for c in ("predicted", "low", "high")]
        est, lo_v, hi_v = sig
        if est is None or est < 0:
            return None, f"no usable prediction on {date} ({est})"
        if lo_v is not None and hi_v is not None and not lo_v <= est <= hi_v:
            return None, f"range doesn't contain the prediction on {date}: {lo_v} <= {est} <= {hi_v}"
        vis = [round(v * factor) if v is not None and factor else None for v in sig]
        days.append({"date": date,
                     "signal": sig[0], "signal_lo": sig[1], "signal_hi": sig[2],
                     "visitors_est": vis[0], "visitors_lo": vis[1], "visitors_hi": vis[2],
                     # The model ran without its week-ahead bookings (late feed): its
                     # backtest error doesn't apply, so the app uses its naive forecast.
                     "week_ahead_missing": flag(r.get("week_ahead_missing", False))})
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


def load_calibration(path: Path, notes: list[str]) -> dict[str, dict]:
    """{node: factor, official visitors, period, source} from calibration_check.csv.

    Never fatal: a missing, unreadable or renamed-column file gives {} with a
    note, and every node falls back to the 2025 sum.
    """
    fallback = "visitors scaled to the prefecture's 2025 counts"
    if not path.exists():
        notes.append(f"calibration file not found ({path.name}); {fallback}")
        return {}
    try:
        rows = pd.read_csv(path).to_dict("records")
        out = {}
        for r in rows:
            factor, official = clean(r.get("factor")), clean(r.get("official_visitors"))
            if not factor or not official:
                continue
            try:
                period = json.loads(str(r.get("official_period")).replace("'", '"'))
            except ValueError:
                period = None
            out[str(r["node_key"])] = {"factor": float(r["factor"]), "official_visitors": official, "official_period": period,
                                       "source": f"dhde-preprocessing-model calibration check ({r.get('measured', '')})"}
    except Exception as e:  # noqa: BLE001 - a bad calibration file must not stop the refresh
        notes.append(f"calibration file unreadable ({path.name}: {type(e).__name__}: {e}); {fallback}")
        return {}
    return out


def rakuten_block(m: pd.DataFrame, today: pd.Timestamp) -> dict | None:
    """Share of Rakuten hotels near the node with a room 1, 7 and 30 days ahead,
    from the latest snapshot taken by today. The master table keys each value
    by stay date, so the snapshot for lead k is the row k days after it.
    None when the node has no Rakuten snapshots."""
    shares, snaps = {}, []
    for lead in RAKUTEN_LEADS:
        col = f"rakuten_vacant_share_d{lead}"
        if col not in m.columns:
            return None
        rows = m.loc[m[col].notna() & (m["date"] - pd.Timedelta(days=lead) <= today), ["date", col]]
        if rows.empty:
            return None
        last = rows.iloc[-1]
        shares[f"d{lead}"] = round(float(last[col]) * 100, 1)
        snaps.append(last["date"] - pd.Timedelta(days=lead))
    return {"share_with_rooms_pct": shares, "as_of": min(snaps).date().isoformat()}


def survey_block(m: pd.DataFrame, today: pd.Timestamp) -> dict | None:
    """Satisfaction, NPS, home region and purpose of visit over the SURVEY_DAYS to
    the last response. Shares are % of responses (purposes can add up past 100).
    NPS is None with fewer than MIN_SURVEY_RESPONSES answers to its question.
    None without the columns, with fewer than MIN_SURVEY_RESPONSES responses, or
    when the last response is over SURVEY_MAX_AGE_DAYS old. Origin and purpose
    columns are picked up by their survey_origin_ / survey_purpose_ prefix."""
    if "survey_satisfaction_n" not in m.columns:
        return None
    seen = m.loc[m["survey_response_count"].notna() & (m["date"] <= today), "date"]
    if seen.empty:
        return None
    as_of = seen.max()
    if as_of < today - pd.Timedelta(days=SURVEY_MAX_AGE_DAYS):
        return None
    w = m[(m["date"] > as_of - pd.Timedelta(days=SURVEY_DAYS)) & (m["date"] <= as_of)]
    n = int(w["survey_response_count"].fillna(0).sum())
    if n < MIN_SURVEY_RESPONSES:
        return None
    sat_n = int(w["survey_satisfaction_n"].fillna(0).sum())
    sat = (w["survey_satisfaction_mean"] * w["survey_satisfaction_n"]).sum() / sat_n if sat_n else None
    # NPS = (promoters 9-10 minus detractors 0-6) / answers x 100, from the daily counts.
    nps_n = int(w["survey_nps_n"].fillna(0).sum()) if "survey_nps_n" in w.columns else 0
    nps = (round((w["survey_nps_promoters"].fillna(0).sum() - w["survey_nps_detractors"].fillna(0).sum()) / nps_n * 100, 1)
           if nps_n >= MIN_SURVEY_RESPONSES else None)

    def by_prefix(prefix: str) -> dict[str, str]:
        return {c[len(prefix):]: c for c in w.columns if c.startswith(prefix)}

    def pct(cols: dict[str, str], total: int) -> dict[str, float]:
        return {k: round(float(w[c].fillna(0).sum()) / total * 100, 1) for k, c in cols.items()}

    origin_cols = by_prefix("survey_origin_")
    with_origin = int(w[list(origin_cols.values())].fillna(0).sum().sum())
    return {
        "as_of": as_of.date().isoformat(),
        "days": SURVEY_DAYS,
        "responses": n,
        "satisfaction": clean(sat),
        "satisfaction_n": sat_n,
        "nps": clean(nps),
        "nps_n": nps_n,
        "origin_pct": pct(origin_cols, with_origin) if with_origin else {},
        "purpose_pct": pct(by_prefix("survey_purpose_"), n),
    }


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
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="folder with {node}_master.parquet files")
    ap.add_argument("--out", default="public/data/real_data.json")
    ap.add_argument("--today", help="YYYY-MM-DD (default: today, JST)")
    ap.add_argument("--source-commit", default=None, help="dhde-preprocessing-model commit the tables came from")
    ap.add_argument("--forecast", help="forecast_fukui.csv from build_forecast.py (optional; its report JSON is read "
                                       "from the same folder)")
    ap.add_argument("--calibration", help="calibration_check.csv from check_calibration.py (optional; without it "
                                          "visitors are scaled to the prefecture's 2025 counts)")
    a = ap.parse_args()

    today = pd.Timestamp(a.today) if a.today else pd.Timestamp(datetime.now(JST).date())
    calib_notes = []
    pipeline_calib = load_calibration(Path(a.calibration).expanduser(), calib_notes) if a.calibration else {}
    files = sorted(Path(a.input).expanduser().glob("*_master.parquet"))
    nodes = {}
    for f in files:
        node = f.name.replace("_master.parquet", "")
        nodes[node] = node_block(node, pd.read_parquet(f), today, pipeline_calib.get(node), calib_notes)

    # A missing or unreadable forecast is not fatal: the app falls back to its naive forecast.
    forecast_notes = []
    fc_path = Path(a.forecast).expanduser() if a.forecast else None
    if fc_path and fc_path.exists():
        # The workflow runs the model repo's main every day, so a partial file or a
        # renamed column must drop the forecast, not the refresh.
        try:
            fc = pd.read_csv(fc_path)
            rep_path = fc_path.with_name("forecast_fukui_report.json")
            report = json.loads(rep_path.read_text(encoding="utf-8")) if rep_path.exists() else {}
            forecast_notes += [f"7-day forecast: {w}" for w in report.get("warnings", [])]
            fc_nodes = set(fc["node_key"])
        except Exception as e:  # noqa: BLE001 - any read problem means no forecast today
            fc, fc_nodes = None, set()
            forecast_notes.append(f"7-day forecast file unreadable ({e!r}); the app uses its naive forecast")
        for node, block in nodes.items() if fc is not None else ():
            try:
                fb, why = forecast_block(node, block, fc, report)
            except Exception as e:  # noqa: BLE001 - e.g. a KeyError if a column was renamed
                fb, why = None, f"could not read its rows: {e!r}"
            if fb:
                block["forecast"] = fb
            elif node in FORECAST_SIGNAL or node in fc_nodes:
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
            "visitors_est = daily signal x one factor per node: the pipeline's calibration check where available, "
            "else scaled to the prefecture's official 2025 annual count for the site (modelled).",
            "signal_index_pct = the day's signal as a % of the node's mean 2025 day.",
            "Camera 'signal' is detections, not unique visitors. Fukui Station has no official site figure, so no estimate.",
            "gmb_* fields are Google Maps Business Profile metrics (views, searches, directions, rating).",
            "forecast = dhde-preprocessing-model's 7-day model (scripts/build_forecast.py), scaled with the same "
            "calibration factor as visitors_est.",
            *calib_notes,
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
        print(f"  {k:13s} {v['measure'] or '-':13s} factor={c['factor']} ({c['method']}) as_of={v['as_of']['visitors']}{fc_txt}")
    for n in calib_notes + forecast_notes:
        print(f"  note: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
