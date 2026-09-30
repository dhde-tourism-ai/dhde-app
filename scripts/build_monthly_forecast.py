#!/usr/bin/env python3
"""
Write public/data/monthly_forecast.json: the 12-month forecast from
dhde-preprocessing-model (scripts/forecast_monthly.py) with the actual
months it was fitted on, for the Strategy view (Q2).

    python scripts/build_monthly_forecast.py --input ~/output --out public/data/monthly_forecast.json

Reads from --input:
    monthly_forecast.csv   one row per series per future month (required)
    monthly_actuals.csv    the actual months per series (optional: an older
                           pipeline doesn't write it, the forecast still goes out)

Series: visitors in each Fukui node's town (JTTA digital tourism statistics,
comparable from 2025-01), Fukui prefecture, and Fukui guest-nights (JTA).
The low/high range is the 10th-90th percentile of the model's own backtest
errors; `range_rough` marks series with fewer than 12 distinct backtest months.

Exits non-zero only when the forecast file is missing or empty, so the
workflow step (continue-on-error) leaves yesterday's file in place.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Japanese labels (the pipeline's labels are English).
LABEL_JA = {
    "tojinbo": "坂井市（東尋坊）",
    "fukui_station": "福井市（福井駅）",
    "katsuyama": "勝山市",
    "rainbow_line": "美浜町＋若狭町（レインボーライン）",
    "eiheiji": "永平寺町",
    "awara_onsen": "あわら市",
    "fukui_pref": "福井県",
    "fukui_guest_nights": "福井県の延べ宿泊者数",
    "fukui_guest_nights_japanese": "福井県の延べ宿泊者数（日本人）",
    "fukui_guest_nights_foreign": "福井県の延べ宿泊者数（外国人）",
}


def num(v: str) -> float | None:
    try:
        return float(v) if v not in ("", "nan", "NaN") else None
    except ValueError:
        return None


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def build(input_dir: Path, source_commit: str | None) -> dict:
    fc_path = input_dir / "monthly_forecast.csv"
    if not fc_path.exists():
        raise SystemExit(f"no {fc_path}")
    rows = read_csv(fc_path)
    if not rows:
        raise SystemExit(f"{fc_path} is empty")

    notes: list[str] = []
    act_path = input_dir / "monthly_actuals.csv"
    actual_rows = read_csv(act_path) if act_path.exists() else []
    if not actual_rows:
        notes.append("no monthly_actuals.csv: forecast only, no history")

    series: dict[str, dict] = {}
    for r in rows:
        s = series.setdefault(r["series"], {
            "id": r["series"],
            "kind": r["kind"],
            "label": r["label"],
            "label_ja": LABEL_JA.get(r["series"], r["label"]),
            "model": r["model"],
            "backtest_mape_pct": num(r["backtest_mape_pct"]),
            "baseline_mape_pct": num(r["baseline_mape_pct"]),
            "range_rough": r["range_rough"] == "True",
            "data_through": r["data_through"],
            "comparable_from": r["comparable_from"] or None,
            "actual": [],
            "forecast": [],
        })
        s["forecast"].append({"month": r["month"], "predicted": num(r["predicted"]), "low": num(r["low"]), "high": num(r["high"])})
    for r in actual_rows:
        if r["series"] in series and num(r["actual"]) is not None:
            series[r["series"]]["actual"].append({"month": r["month"], "value": num(r["actual"])})
    for s in series.values():
        s["actual"].sort(key=lambda x: x["month"])
        s["forecast"].sort(key=lambda x: x["month"])

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": {"repo": "dhde-tourism-ai/dhde-preprocessing-model", "commit": source_commit},
        "notes": notes,
        "series": list(series.values()),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="folder with monthly_forecast.csv (and monthly_actuals.csv)")
    parser.add_argument("--out", default="public/data/monthly_forecast.json")
    parser.add_argument("--source-commit", default=None)
    args = parser.parse_args()

    data = build(Path(args.input), args.source_commit)
    out = Path(args.out)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n_act = sum(len(s["actual"]) for s in data["series"])
    print(f"wrote {out}: {len(data['series'])} series, {n_act} actual months", file=sys.stderr)


if __name__ == "__main__":
    main()
