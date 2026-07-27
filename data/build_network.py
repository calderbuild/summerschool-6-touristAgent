#!/usr/bin/env python3
"""Build the step-free routing graph from Ile-de-France Mobilites' own GTFS.

Why this exists
---------------
Until now the app could only show four journeys, because those four were written
by hand. A hand-written route is honest about its own contents and dishonest
about what the product is: nobody's trip is one of our four. This script turns
the operator's published timetable into a graph the app can actually search, so
"Bastille to Orsay" is answered from data rather than from a fixture.

Sources, all public and free of registration:
  * IDFM GTFS (Licence Mobilite / ODbL, refreshed daily)
      https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip
  * IDFM "Accessibilite en gare" (Licence Ouverte v2.0)
      https://data.iledefrance-mobilites.fr/explore/dataset/accessibilite-en-gare/

What it keeps and what it throws away
-------------------------------------
Metro, RER and Transilien only: the product is about stairs and lifts, and a bus
is step-free or not for entirely different reasons (a ramp, a kerb, a driver).
For each line the longest stop pattern found in the feed becomes the canonical
sequence, which is the standard way to reduce a timetable full of short workings
to the shape of a line.

Where the lift and stair data comes from, and why not from the operator
--------------------------------------------------------------------
GTFS has a `pathways.txt` for exactly this: the inside of a station as a graph
whose mode says elevator, stairs or escalator, with a step count on the stairs.
IDFM publishes the file, and every one of its 4,879 rows is mode 1, a plain
walkway. There are no lifts and no steps in it. The script prints that count so
the claim is checkable rather than asserted, and takes lifts and stairways from
OpenStreetMap instead, matched to a station by distance (never by name). The
operator's own contribution is its accessibility class per station, which it does
publish, and which is the part a traveller should trust most.

Run: python3 data/build_network.py [path-to-IDFM-gtfs.zip]
Writes: mvp-demo/lib/network.json  (committed, so runtime needs no download)
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import re
import time
import math
import os
import sys
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"
ACCESS_URL = (
    "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/"
    "accessibilite-en-gare/records?limit=100&offset={offset}"
    "&select=stop_name,accessibility_level_id,accessibility_level_name,commentaire"
    "&order_by=stop_name"
)

# GTFS route_type: 0 tram, 1 metro, 2 rail (RER + Transilien).
#
# Trams are in because the operator's stop register says most of their platforms
# are accessible, which makes them the step-free spine of the outer city. They
# were left out until that register was found: adding a mode whose accessibility
# we could only assume would have been the same guessing this product refuses.
# Buses stay out. A bus is step-free for different reasons (a ramp, a kerb, a
# driver), none of which is in any feed here, and the app says so when it cannot
# find a route.
KEEP_ROUTE_TYPES = {"0", "1", "2"}

OUT = os.path.join(os.path.dirname(__file__), "..", "mvp-demo", "lib", "network.json")

# GTFS pathway_mode. 5 is the one this product exists for.
PATHWAY_MODE = {
    "1": "walkway",
    "2": "stairs",
    "3": "moving_sidewalk",
    "4": "escalator",
    "5": "elevator",
    "6": "fare_gate",
    "7": "exit_gate",
}


def norm(name: str) -> str:
    """Lookup key shared with lib/idfm.ts stationKey. Keep the two in step."""
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    out = []
    for ch in s:
        out.append(ch if ch.isalnum() and ch.isascii() else " ")
    words = [
        w
        for w in "".join(out).split()
        if w
        not in {
            "gare",
            "station",
            "paris",
            "de",
            "du",
            "des",
            "la",
            "le",
            "les",
            "d",
            "l",
        }
    ]
    return " ".join(words)


def haversine_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> int:
    r = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(round(2 * r * math.asin(math.sqrt(h))))


def open_zip(path: str) -> zipfile.ZipFile:
    if not os.path.exists(path):
        print(f"downloading {GTFS_URL} ...", flush=True)
        urllib.request.urlretrieve(GTFS_URL, path)
    return zipfile.ZipFile(path)


def rows(zf: zipfile.ZipFile, member: str):
    """Stream one CSV member without holding it in memory (stop_times is 860MB)."""
    with zf.open(member) as raw:
        yield from csv.DictReader(
            io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        )


def fetch_access_levels() -> dict[str, dict]:
    """The operator's accessibility class per stop name, all 459 records."""
    levels: dict[str, dict] = {}
    for offset in range(0, 600, 100):
        req = urllib.request.Request(
            ACCESS_URL.format(offset=offset),
            headers={
                "Accept-Encoding": "identity",
                "Accept": "application/json",
                "User-Agent": "voie-libre-build/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
            # Asking for identity is not enough: the CDN serves whatever variant
            # it has cached, so some pages arrive gzipped anyway. Decide from the
            # bytes rather than from the header, which is what was wrong.
            if raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            payload = json.loads(raw.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - a missing class is reported, never invented
            print(f"  accessibility page {offset} failed: {exc}", flush=True)
            continue
        for row in payload.get("results", []):
            name = row.get("stop_name")
            level = row.get("accessibility_level_id")
            if not name or level is None:
                continue
            levels[norm(name)] = {
                "level": level,
                "levelFr": row.get("accessibility_level_name") or "",
                "note": (row.get("commentaire") or "").strip() or None,
                "stop": name,
            }
    return levels


STOPS_URL = (
    "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/"
    "arrets/records?limit=100&offset={offset}"
    "&select=arrname,arrtype,arraccessibility,arraudiblesignals,arrvisualsigns,arrgeopoint"
    "&where=arrtype%20in%20(%22metro%22,%22rail%22,%22tram%22)"
    "&order_by=arrname"
)

ELEVATION_URL = "https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}"


def get_json(url: str) -> dict:
    """Every host here gzips whether or not it was asked to, so decide on bytes."""
    req = urllib.request.Request(
        url,
        headers={
            "Accept-Encoding": "identity",
            "Accept": "application/json",
            "User-Agent": "voie-libre-build/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=40) as res:
        raw = res.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def fetch_stop_access() -> list[dict]:
    """The operator's per-platform accessibility for every rail, metro and tram stop.

    This is the dataset that closes the biggest hole in the product: the station
    accessibility register covers 459 mostly-rail stops, which left every metro
    station saying "nobody published anything". This one is 3,426 platforms with a
    four-value flag, and it is the same operator under the same open licence.
    """
    out: list[dict] = []
    offset = 0
    while offset < 4000:
        try:
            payload = get_json(STOPS_URL.format(offset=offset))
        except Exception as exc:  # noqa: BLE001
            print(f"  stop register page {offset} failed: {exc}", flush=True)
            break
        rows = payload.get("results", [])
        if not rows:
            break
        for row in rows:
            point = row.get("arrgeopoint") or {}
            if point.get("lat") is None or point.get("lon") is None:
                continue
            out.append(
                {
                    "name": row.get("arrname") or "",
                    "type": row.get("arrtype") or "",
                    "access": (row.get("arraccessibility") or "unknown").lower(),
                    "audible": (row.get("arraudiblesignals") or "unknown").lower(),
                    "visual": (row.get("arrvisualsigns") or "unknown").lower(),
                    "lat": float(point["lat"]),
                    "lng": float(point["lon"]),
                }
            )
        offset += 100
    print(f"stop-register platforms fetched: {len(out)}", flush=True)
    return out


def fetch_elevations(points: list[tuple[float, float]]) -> list[float | None]:
    """Ground height per coordinate, 100 at a time, from Open-Meteo (no key).

    It exists for one sentence. The walk from Lamarck - Caulaincourt to
    Sacre-Coeur was described as a "street-level walk of about 405 m", which reads
    as flat and is a climb of about 50 m up the Butte. For the person this product
    is for, that difference decides the trip.
    """
    out: list[float | None] = []
    for i in range(0, len(points), 100):
        batch = points[i : i + 100]
        url = ELEVATION_URL.format(
            lat=",".join(f"{lat:.5f}" for lat, _ in batch),
            lng=",".join(f"{lng:.5f}" for _, lng in batch),
        )
        values: list = []
        # A free service with no key answers 429 to ten requests in a row, so the
        # batches are spaced and retried. Half the heights missing would mean half
        # the walks silently lose their climb, which is the fact worth having.
        for attempt in range(4):
            try:
                values = get_json(url).get("elevation") or []
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 3:
                    print(f"  elevation batch {i} failed: {exc}", flush=True)
                    break
                # The free tier counts coordinates, not requests, and resets on the
                # minute, so 600 heights in a row earns a 429 that only waiting
                # clears. Spacing the batches is not enough on its own.
                wait = 65 if "429" in str(exc) else 3
                print(f"  elevation batch {i}: {exc}, waiting {wait}s", flush=True)
                time.sleep(wait)
        time.sleep(1.2)
        for j in range(len(batch)):
            out.append(float(values[j]) if j < len(values) else None)
    got = sum(1 for v in out if v is not None)
    print(f"elevations fetched: {got} of {len(points)}", flush=True)
    return out


PLACE_RE = re.compile(
    r'id:\s*"(?P<id>[a-z0-9-]+)".*?coord:\s*\{\s*lat:\s*(?P<lat>-?\d+\.?\d*),\s*lng:\s*(?P<lng>-?\d+\.?\d*)\s*\}',
    re.S,
)


def read_places() -> list[tuple[str, float, float]]:
    """The knowledge base's places, read out of the TypeScript that owns them.

    Duplicating the coordinates into this script would give the product two
    answers for where the Louvre is, and the wrong one would be the one nobody
    looks at.
    """
    path = os.path.join(os.path.dirname(__file__), "..", "mvp-demo", "lib", "places.ts")
    text = open(path, encoding="utf-8").read()
    found = [
        (m.group("id"), float(m.group("lat")), float(m.group("lng")))
        for m in PLACE_RE.finditer(text)
    ]
    # Count coordinates that hold numbers: the file also holds SERVICES, which have
    # an id and no coordinate (you reach them by phone rather than by travelling),
    # and the interface declaration at the top, whose coord holds `number`.
    declared = len(re.findall(r"coord:\s*\{\s*lat:\s*-?\d", text))
    assert len(found) == declared, f"places.ts: matched {len(found)} of {declared}"
    print(f"places read from places.ts: {len(found)}", flush=True)
    return found


def main() -> None:
    zip_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.path.join(os.path.dirname(__file__), "IDFM-gtfs.zip")
    )
    zf = open_zip(zip_path)

    # ---- routes we care about -------------------------------------------------
    routes: dict[str, dict] = {}
    for r in rows(zf, "routes.txt"):
        if r.get("route_type") in KEEP_ROUTE_TYPES:
            routes[r["route_id"]] = {
                "id": r["route_id"],
                "name": (
                    r.get("route_short_name") or r.get("route_long_name") or ""
                ).strip(),
                "long": (r.get("route_long_name") or "").strip(),
                "mode": "metro" if r["route_type"] == "1" else "rail",
                "color": "#" + (r.get("route_color") or "6b7683").strip().lstrip("#"),
                "text": "#"
                + (r.get("route_text_color") or "ffffff").strip().lstrip("#"),
            }
    print(f"routes kept: {len(routes)}", flush=True)

    # ---- trips -> route ------------------------------------------------------
    trip_route: dict[str, str] = {}
    for t in rows(zf, "trips.txt"):
        rid = t.get("route_id")
        if rid in routes:
            trip_route[t["trip_id"]] = rid
    print(f"trips on those routes: {len(trip_route)}", flush=True)

    # ---- stops --------------------------------------------------------------
    stops: dict[str, dict] = {}
    for s in rows(zf, "stops.txt"):
        sid = s["stop_id"]
        stops[sid] = {
            "name": (s.get("stop_name") or "").strip(),
            "lat": s.get("stop_lat"),
            "lng": s.get("stop_lon"),
            "parent": (s.get("parent_station") or "").strip(),
            "type": s.get("location_type") or "0",
        }

    def station_of(stop_id: str) -> str:
        """Collapse a platform to its station, so a change of line is one place."""
        s = stops.get(stop_id)
        if not s:
            return stop_id
        return s["parent"] or stop_id

    # ---- every hop the timetable actually runs -------------------------------
    # The obvious shortcut is to take the longest stop pattern per route and call
    # that the line. It loses every branch, so this keeps the union of consecutive
    # stop pairs across all 74,472 trips, which is the network as run, and reads
    # the ride time off the timetable instead of guessing it from distance. The
    # longest pattern is still kept, but only as the display order of a line.
    #
    # What the union cannot do is invent trips the feed does not contain, and this
    # feed does not contain RER C through Paris. Its single route with
    # route_short_name "C" runs 2,786 trips over 37 stations, all on the southern
    # branches, ending at Gare d'Austerlitz. Champ de Mars Tour Eiffel is in
    # stops.txt as IDFM:73844 with two platforms, and the only trips that call
    # there are bus 82; Musee d'Orsay, Pont de l'Alma and Boulevard Victor exist
    # only as bus stops of the same name; Saint-Michel Notre-Dame is served by
    # metro 4 and RER B and nothing else. Verified against the 2026-07-27 zip.
    #
    # The consequence is on screen, not hidden: there is no rail station within a
    # kilometre of the Eiffel Tower, so a wheelchair journey there is routed to
    # Invalides and the route says the last 1,451 m are on foot. Do not paper over
    # this by hand-adding hops. If it matters enough to fix, the fix is the PRIM
    # real-time feed or SNCF's own GTFS, not invented ones.
    #
    # stop_times is grouped by trip in the feed, so this streams in one pass and
    # never holds more than a single trip.
    best: dict[str, list[str]] = {}
    hops: dict[tuple[str, str, str], int] = {}
    current_trip = None
    current: list[tuple[int, str, int | None, int | None]] = []

    def secs(hhmmss: str | None) -> int | None:
        """GTFS times pass 24:00:00 on a trip that runs after midnight."""
        if not hhmmss:
            return None
        parts = hhmmss.strip().split(":")
        if len(parts) != 3:
            return None
        try:
            h, m, s2 = (int(x) for x in parts)
        except ValueError:
            return None
        return h * 3600 + m * 60 + s2

    def flush(
        trip: str | None, seq: list[tuple[int, str, int | None, int | None]]
    ) -> None:
        if not trip or not seq:
            return
        rid = trip_route.get(trip)
        if not rid:
            return
        seq = sorted(seq)
        ordered = [s for _, s, _, _ in seq]
        if len(ordered) > len(best.get(rid, [])):
            best[rid] = ordered
        for (_, a_stop, _, a_dep), (_, b_stop, b_arr, _) in zip(seq, seq[1:]):
            a, b = station_of(a_stop), station_of(b_stop)
            if a == b:
                continue
            ride = None
            if a_dep is not None and b_arr is not None:
                delta = b_arr - a_dep
                # A negative or absurd delta is a feed artefact, not a fast train.
                if 0 < delta <= 3600:
                    ride = delta
            key = (rid, a, b)
            if ride is None:
                hops.setdefault(key, 0)
            elif hops.get(key):
                hops[key] = min(hops[key], ride)
            else:
                hops[key] = ride

    for st in rows(zf, "stop_times.txt"):
        trip = st["trip_id"]
        if trip != current_trip:
            flush(current_trip, current)
            current_trip, current = trip, []
        if trip in trip_route:
            try:
                current.append(
                    (
                        int(st["stop_sequence"]),
                        st["stop_id"],
                        secs(st.get("arrival_time")),
                        secs(st.get("departure_time")),
                    )
                )
            except (KeyError, ValueError):
                pass
    flush(current_trip, current)
    print(
        f"routes with a pattern: {len(best)} | distinct hops: {len(hops)}",
        flush=True,
    )

    # ---- pathways: what the operator actually maps inside a station ----------
    # GTFS has a field for exactly what this product needs: a pathway typed as an
    # elevator or a staircase, with a step count. IDFM publishes the file and
    # fills in none of it. Counted here so the claim carries a number instead of
    # an impression, and it is the reason the lift and stair facts below come from
    # OpenStreetMap contributors rather than from the operator.
    pathway_modes: dict[str, int] = defaultdict(int)
    try:
        for p in rows(zf, "pathways.txt"):
            pathway_modes[PATHWAY_MODE.get(p.get("pathway_mode", ""), "unknown")] += 1
    except KeyError:
        print("  no pathways.txt in this feed", flush=True)
    print(f"pathway rows by mode: {dict(pathway_modes)}", flush=True)

    # ---- lifts and steps, from OpenStreetMap via data/fetch_sources.py --------
    def load_osm(name: str) -> list[dict]:
        path = os.path.join(os.path.dirname(__file__), "sources", name)
        if not os.path.exists(path):
            print(f"  {name} missing: run data/fetch_sources.py first", flush=True)
            return []
        with open(path, encoding="utf-8") as fh:
            return json.load(fh).get("elements", [])

    osm_lifts = [
        e for e in load_osm("osm-elevators.json") if e.get("lat") and e.get("lon")
    ]
    osm_steps: list[tuple[float, float, int | None]] = []
    for e in load_osm("osm-steps.json"):
        lat, lon = e.get("lat"), e.get("lon")
        if lat is None or lon is None:
            centre = e.get("center") or {}
            lat, lon = centre.get("lat"), centre.get("lon")
        if lat is None or lon is None:
            continue
        try:
            count: int | None = int((e.get("tags") or {}).get("step_count", ""))
        except (TypeError, ValueError):
            count = None
        osm_steps.append((float(lat), float(lon), count))
    print(f"OSM lifts: {len(osm_lifts)} | OSM stairways: {len(osm_steps)}", flush=True)

    # ---- transfers ----------------------------------------------------------
    transfers: dict[tuple[str, str], int] = {}
    try:
        for tr in rows(zf, "transfers.txt"):
            a, b = (
                station_of(tr.get("from_stop_id", "")),
                station_of(tr.get("to_stop_id", "")),
            )
            if not a or not b or a == b:
                continue
            # Not `secs`: that name is the timetable helper `flush` closes over, and
            # rebinding it here only stays harmless while the stop_times pass runs
            # first. One reordering and the hops would all lose their ride times.
            try:
                wait_s = int(tr.get("min_transfer_time") or 0)
            except ValueError:
                wait_s = 0
            key = (a, b) if a < b else (b, a)
            keep = max(wait_s, 0)
            if key not in transfers or keep < transfers[key]:
                transfers[key] = keep
    except KeyError:
        pass

    # ---- assemble -----------------------------------------------------------
    access = fetch_access_levels()
    print(f"accessibility classes fetched: {len(access)}", flush=True)
    platforms = fetch_stop_access()

    station_lines = defaultdict(set)
    for rid, a, b in hops:
        name = routes[rid]["name"]
        station_lines[a].add(name)
        station_lines[b].add(name)

    line_out = []
    for rid, seq in best.items():
        meta = routes[rid]
        chain = []
        for stop_id in seq:
            sta = station_of(stop_id)
            if not chain or chain[-1] != sta:
                chain.append(sta)
            station_lines[sta].add(meta["name"])
        if len(chain) < 2:
            continue
        line_out.append(
            {
                "id": rid,
                "name": meta["name"],
                "mode": meta["mode"],
                "color": meta["color"],
                "text": meta["text"],
                "stations": chain,
            }
        )

    # Deduplicate lines that share a name and a station chain (the feed carries one
    # route per direction and per operator variant).
    seen = {}
    for line in sorted(line_out, key=lambda x: -len(x["stations"])):
        key = (line["name"], line["stations"][0], line["stations"][-1])
        rkey = (line["name"], line["stations"][-1], line["stations"][0])
        if key in seen or rkey in seen:
            continue
        seen[key] = line
    lines = list(seen.values())

    station_out = {}
    for sta in station_lines:
        info = stops.get(sta)
        if not info or not info["lat"] or not info["lng"]:
            continue
        key = norm(info["name"])
        record = access.get(key)
        lat, lng = round(float(info["lat"]), 6), round(float(info["lng"]), 6)
        # 150 m around the station: far enough to catch a lift mapped at a street
        # entrance, close enough not to borrow the next station's staircase.
        near_lifts = sum(
            1
            for e in osm_lifts
            if haversine_m(lat, lng, float(e["lat"]), float(e["lon"])) <= 150
        )
        near_steps = [
            count
            for slat, slon, count in osm_steps
            if count and haversine_m(lat, lng, slat, slon) <= 150
        ]
        near_unknown_steps = sum(
            1
            for slat, slon, count in osm_steps
            if not count and haversine_m(lat, lng, slat, slon) <= 150
        )
        # The operator's platform flags for THIS stop. Matched on distance and on
        # the name, because two stops 200 m apart are two different stops and
        # borrowing the neighbour's platforms would invent an answer.
        want = norm(info["name"])
        tally = {"true": 0, "partial": 0, "false": 0, "unknown": 0}
        signals = {"audible": 0, "visual": 0}
        for pf in platforms:
            if haversine_m(lat, lng, pf["lat"], pf["lng"]) > 250:
                continue
            k = norm(pf["name"])
            if not (k == want or k.startswith(f"{want} ") or want.startswith(f"{k} ")):
                continue
            tally[pf["access"] if pf["access"] in tally else "unknown"] += 1
            if pf["audible"] == "true":
                signals["audible"] += 1
            if pf["visual"] == "true":
                signals["visual"] += 1
        counted = tally["true"] + tally["partial"] + tally["false"]
        if not counted:
            boarding = "unknown"
        elif tally["false"] == 0 and tally["partial"] == 0:
            boarding = "yes"
        elif tally["true"] == 0 and tally["partial"] == 0:
            boarding = "no"
        else:
            boarding = "mixed"
        station_out[sta] = {
            "name": info["name"],
            "lat": round(float(info["lat"]), 6),
            "lng": round(float(info["lng"]), 6),
            "lines": sorted(station_lines[sta]),
            "access": None
            if not record
            else {
                "level": record["level"],
                "levelFr": record["levelFr"],
                "note": record["note"],
            },
            # The operator's own platform flags. `boarding` is derived here rather
            # than in the app so the app cannot quietly derive it differently.
            "platforms": {
                "boarding": boarding,
                "accessible": tally["true"],
                "partial": tally["partial"],
                "notAccessible": tally["false"],
                "unknown": tally["unknown"],
                "audible": signals["audible"],
                "visual": signals["visual"],
            },
            # Volunteer-mapped, so absence means "nobody mapped it here" and never
            # "there is none". The field names say osm for that reason: the UI has
            # to be able to attribute this differently from the operator's class.
            "osm": {
                "lifts": near_lifts,
                "stairways": len(near_steps) + near_unknown_steps,
                # The largest published flight, because that is the one that stops
                # somebody. An average would hide it.
                "maxSteps": max(near_steps) if near_steps else None,
                "stairwaysWithoutCount": near_unknown_steps,
            },
        }

    # ---- ground height ------------------------------------------------------
    station_ids = list(station_out)
    places = read_places()
    heights = fetch_elevations(
        [(station_out[i]["lat"], station_out[i]["lng"]) for i in station_ids]
        + [(lat, lng) for _, lat, lng in places]
    )
    for i, sid_ in enumerate(station_ids):
        station_out[sid_]["elevation"] = heights[i]
    place_elevation = {
        pid: heights[len(station_ids) + i] for i, (pid, _, _) in enumerate(places)
    }

    hop_out = []
    for (rid, a, b), ride in hops.items():
        if a not in station_out or b not in station_out:
            continue
        hop_out.append(
            {
                "a": a,
                "b": b,
                "line": routes[rid]["name"],
                "mode": routes[rid]["mode"],
                "color": routes[rid]["color"],
                "seconds": ride,
            }
        )

    # Keep only transfers between stations we kept, and only where a walk is short
    # enough to be a change rather than a separate journey.
    transfer_out = []
    for (a, b), wait_s in transfers.items():
        if a in station_out and b in station_out:
            d = haversine_m(
                station_out[a]["lat"],
                station_out[a]["lng"],
                station_out[b]["lat"],
                station_out[b]["lng"],
            )
            if d <= 400:
                transfer_out.append({"a": a, "b": b, "seconds": wait_s, "metres": d})

    payload = {
        "builtAt": os.environ.get("BUILD_STAMP", ""),
        "sources": [
            {
                "name": "IDFM GTFS",
                "url": GTFS_URL,
                "licence": "Licence Mobilité / ODbL",
            },
            {
                "name": "IDFM Accessibilité en gare",
                "url": "https://data.iledefrance-mobilites.fr/explore/dataset/accessibilite-en-gare/",
                "licence": "Licence Ouverte v2.0 (Etalab)",
            },
            {
                "name": "IDFM Référentiel des arrêts",
                "url": "https://data.iledefrance-mobilites.fr/explore/dataset/arrets/",
                "licence": "Licence Ouverte v2.0 (Etalab)",
            },
            {
                "name": "Open-Meteo elevation",
                "url": "https://open-meteo.com/en/docs/elevation-api",
                "licence": "CC BY 4.0",
            },
            {
                "name": "OpenStreetMap (lifts and stairways)",
                "url": "https://overpass-api.de/",
                "licence": "ODbL, © OpenStreetMap contributors",
            },
        ],
        "pathwayModes": dict(pathway_modes),
        "placeElevation": place_elevation,
        "lines": lines,
        # The graph the router actually searches. `seconds` is the fastest ride
        # the timetable publishes for that pair, or 0 where the feed left the
        # times out, which the router then has to estimate and says so.
        "hops": hop_out,
        "stations": station_out,
        "transfers": transfer_out,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    with_access = sum(1 for s in station_out.values() if s["access"])
    boarding_counts: dict[str, int] = defaultdict(int)
    for s in station_out.values():
        boarding_counts[s["platforms"]["boarding"]] += 1
    with_lift = sum(1 for s in station_out.values() if s["osm"]["lifts"])
    with_steps = sum(1 for s in station_out.values() if s["osm"]["maxSteps"])
    print(
        f"wrote {OUT}\n"
        f"  lines: {len(lines)}\n"
        f"  stations: {len(station_out)}\n"
        f"  with an operator accessibility class: {with_access}\n"
        f"  with at least one mapped lift: {with_lift}\n"
        f"  with a published stair count: {with_steps}\n"
        f"  platform boarding flags: {dict(boarding_counts)}\n"
        f"  with a ground height: {sum(1 for s in station_out.values() if s['elevation'] is not None)}\n"
        f"  hops the router can ride: {len(hop_out)}\n"
        f"  transfers: {len(transfer_out)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
