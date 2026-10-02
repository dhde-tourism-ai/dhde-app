"""Planner and access metrics on a tiny synthetic network.

    H (hub) --bus 1--> M --bus 2--> N (node)      M and M2 are 100 m apart
                       M2 --bus 3--> N

Bus 1: H 08:00 -> M 08:20, H 09:00 -> M 09:20
Bus 2: M 08:30 -> N 09:00, M 17:00 -> N 17:30
Bus 3: M2 09:40 -> N 10:00
Back:  N 16:00 -> H 16:40 (bus 4), N 18:00 -> M 18:20 (bus 5, dead end)
"""
from __future__ import annotations

import sys
import zipfile
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_transport as bt  # noqa: E402
from gtfs import build_network, earliest_arrival, hhmm, latest_departure, load_feed, service_date, to_seconds  # noqa: E402

WALK = {"speed_m_per_min": 80, "detour_factor": 1.3, "transfer_radius_m": 300, "transfer_buffer_min": 3}
STOPS = {"H": (36.0, 136.0), "M": (36.1, 136.0), "M2": (36.1009, 136.0), "N": (36.2, 136.0)}
TRIPS = {
    "t1a": ("r1", [("H", "08:00:00"), ("M", "08:20:00")]),
    "t1b": ("r1", [("H", "09:00:00"), ("M", "09:20:00")]),
    "t2a": ("r2", [("M", "08:30:00"), ("N", "09:00:00")]),
    "t2b": ("r2", [("M", "17:00:00"), ("N", "17:30:00")]),
    "t3": ("r3", [("M2", "09:40:00"), ("N", "10:00:00")]),
    "t4": ("r4", [("N", "16:00:00"), ("H", "16:40:00")]),
    "t5": ("r5", [("N", "18:00:00"), ("M", "18:20:00")]),
}


@pytest.fixture
def feed_zip(tmp_path: Path) -> Path:
    path = tmp_path / "feed.zip"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("GTFS/agency.txt", "agency_id,agency_name,agency_url,agency_timezone\na,Test Bus,http://x,Asia/Tokyo\n")
        z.writestr("GTFS/stops.txt", "stop_id,stop_name,stop_lat,stop_lon\n"
                   + "".join(f"{k},{k},{la},{lo}\n" for k, (la, lo) in STOPS.items()))
        z.writestr("GTFS/routes.txt", "route_id,agency_id,route_short_name,route_long_name,route_type\n"
                   + "".join(f"r{i},a,{i},Route {i},3\n" for i in range(1, 6)))
        z.writestr("GTFS/calendar.csv", "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
                   "wk,1,1,1,1,1,0,0,20260101,20261231\n")
        z.writestr("GTFS/calendar_dates.txt", "service_id,date,exception_type\nwk,20261014,2\n")
        z.writestr("GTFS/trips.txt", "route_id,service_id,trip_id\n" + "".join(f"{r},wk,{t}\n" for t, (r, _) in TRIPS.items()))
        rows = "".join(f"{t},{tm},{tm},{s},{i + 1}\n" for t, (_, calls) in TRIPS.items() for i, (s, tm) in enumerate(calls))
        z.writestr("GTFS/stop_times.txt", "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n" + rows)
    return path


def net_for(feed_zip: Path, d: date = date(2026, 10, 7)):
    return build_network([load_feed(feed_zip, "f", "bus")], d, WALK)


def idx(net, stop: str) -> int:
    return net.stop_index[f"f:{stop}"]


def test_times():
    assert to_seconds("25:10:00") == 90600
    assert hhmm(90600) == "25:10"


def test_earliest_arrival_with_transfer_and_footpath(feed_zip: Path):
    net = net_for(feed_zip)
    ea = earliest_arrival(net, {idx(net, "H"): to_seconds("08:00:00")})
    assert hhmm(ea[idx(net, "N")]) == "09:00"  # bus 1 then bus 2 at M
    ea = earliest_arrival(net, {idx(net, "H"): to_seconds("08:30:00")})
    # 09:00 bus to M (09:20), walk 100 m to M2 (+2 min walk, +3 min buffer), bus 3 at 09:40
    assert hhmm(ea[idx(net, "N")]) == "10:00"


def test_latest_departure_ignores_dead_end_trip(feed_zip: Path):
    net = net_for(feed_zip)
    ld = latest_departure(net, {idx(net, "H"): bt.DAY_END})
    assert hhmm(ld[idx(net, "N")]) == "16:00"  # 18:00 bus only reaches M, which has no onward trip


def test_calendar_dates_remove_service(feed_zip: Path):
    assert net_for(feed_zip, date(2026, 10, 14)).conns == []  # removed by calendar_dates
    assert net_for(feed_zip, date(2026, 10, 10)).conns == []  # Saturday: no service


def test_expired_feed_uses_same_week_a_year_earlier(feed_zip: Path):
    f = load_feed(feed_zip, "f", "bus")
    d = service_date(f, date(2027, 10, 6))
    assert d == date(2026, 10, 7) and d.weekday() == 2


def test_access_metrics(feed_zip: Path):
    net = net_for(feed_zip)
    hub = bt.node_stops(net, STOPS["H"], 50, WALK)
    node = bt.node_stops(net, STOPS["N"], 50, WALK)
    c = bt.service_counts(net, node)
    assert c["departures"] == 2 and c["arrivals"] == 3
    assert (c["first_departure"], c["last_departure"]) == ("16:00", "18:00")
    j = bt.journeys_from_hub(net, hub, {"n": node})["n"]
    assert j["fastest_min"] == 60 and j["leave_0900"] == {"depart": "09:00", "arrive": "10:00", "minutes": 60}
    assert bt.last_return(net, hub, node) == {"leave": "16:00", "from_stop": "N", "arrive_hub": "16:40", "minutes": 40}


def test_reference_days_are_wed_sat_sun():
    days = bt.reference_days(date(2026, 10, 2))
    assert [d.weekday() for d in days.values()] == [2, 5, 6]
    assert all(d >= date(2026, 10, 2) for d in days.values())
