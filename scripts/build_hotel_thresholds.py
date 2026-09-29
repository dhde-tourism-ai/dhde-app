#!/usr/bin/env python3
"""
Write public/data/hotel_thresholds.json: the occupancy levels at which the
over / under-booking nudge (loop #3, src/lib/nudges.ts) fires for each
hotel area, taken from that area's own booking history.

    python scripts/build_hotel_thresholds.py --input ~/output --out public/data/hotel_thresholds.json

Why per area: Fukui's hotel areas have very different normal levels (a
typical night is 62% at Fukui Station but 32% on the Echizen coast), so one
fixed cut-off either never fires or fires most nights. The demo's "40% or
less" would call 66% of Echizen coast nights under-booked.

For each area, from every past night in its reservation feed (FTAS, the
node's master-table `occ`):
- tight_occ_pct: the 90th percentile. A night at or above it is in the
  area's top 10%; the nudge also needs demand 35% above normal (the same
  DEMAND_THRESHOLD as loop #1), except where demand_check is false.
- slack_occ_pct: the 10th percentile for each weekday, so an unusually
  empty Saturday counts, not every Tuesday. The nudge also needs day-visitor
  demand at or above normal (there are visitors to sell stays to).

Awara Onsen has demand_check false: its visitor signal is its own hotel
guests, so a demand check would only repeat the occupancy (busy nights
always look busy, quiet nights always look quiet). Both rules then use
occupancy only.

On-the-books occupancy for the next 7 nights is already 92 to 96% of the
final count at these feeds, so the same thresholds apply to future nights.

Never fails the refresh: an area without enough history is left out (the
app keeps the demo rule there) and the reason goes into notes.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

JST = timezone(timedelta(hours=9))
# Hotel area in the app (market_voice_demo.json) -> node whose reservation feed it uses.
AREAS = {
    "fukui_station": "fukui_station",
    "awara_onsen": "awara_onsen",
    "echizen_coast": "tojinbo",
    "mikata_five_lakes": "rainbow_line",
}
NO_DEMAND_CHECK = {"awara_onsen"}
DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MIN_NIGHTS = 180
MIN_PER_WEEKDAY = 20


def area_thresholds(m: pd.DataFrame, today: pd.Timestamp) -> tuple[dict | None, str | None]:
    """(thresholds, reason skipped) from one node's master table."""
    if "occ" not in m.columns:
        return None, "no occupancy column"
    m = m.assign(date=pd.to_datetime(m["date"]).dt.normalize()).drop_duplicates("date")
    occ = m.loc[(m["date"] < today) & m["occ"].between(0, 1.5), ["date", "occ"]].set_index("date")["occ"]
    if len(occ) < MIN_NIGHTS:
        return None, f"only {len(occ)} past nights (need {MIN_NIGHTS})"
    by_dow = occ.groupby(occ.index.dayofweek)
    if by_dow.size().min() < MIN_PER_WEEKDAY:
        return None, f"fewer than {MIN_PER_WEEKDAY} nights on some weekday"
    slack = by_dow.quantile(0.1)
    return {
        "nights": int(len(occ)),
        "since": occ.index.min().date().isoformat(),
        "median_occ_pct": round(float(occ.median()) * 100),
        "tight_occ_pct": round(float(occ.quantile(0.9)) * 100),
        "slack_occ_pct": {DOW[d]: round(float(slack[d]) * 100) for d in range(7)},
    }, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="folder with {node}_master.parquet files")
    ap.add_argument("--out", default="public/data/hotel_thresholds.json")
    ap.add_argument("--today", help="YYYY-MM-DD (default: today, JST)")
    a = ap.parse_args()
    today = pd.Timestamp(a.today) if a.today else pd.Timestamp(datetime.now(JST).date())

    areas, notes = {}, []
    for area, node in AREAS.items():
        path = Path(a.input).expanduser() / f"{node}_master.parquet"
        try:
            th, why = area_thresholds(pd.read_parquet(path), today)
        except Exception as e:  # noqa: BLE001 - one bad table leaves that area on the demo rule
            th, why = None, f"{path.name} unreadable ({type(e).__name__})"
        if th is None:
            notes.append(f"{area}: left out, {why}; the app keeps the demo rule there")
            continue
        areas[area] = {"node": node, "demand_check": area not in NO_DEMAND_CHECK, **th}

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "today": today.date().isoformat(),
        "method": "Per hotel area, from its reservation feed's past nights: tight = the 90th percentile of "
                  "occupancy (plus demand 35% above normal where demand_check), slack = the 10th percentile "
                  "for that weekday (plus demand at or above normal).",
        "notes": notes,
        "areas": areas,
    }
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(out)
    print(f"wrote {out}: {len(areas)} area(s)")
    for k, v in areas.items():
        print(f"  {k:18s} tight>={v['tight_occ_pct']}%  slack<= {v['slack_occ_pct']}  demand_check={v['demand_check']}")
    for n in notes:
        print(f"  note: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
