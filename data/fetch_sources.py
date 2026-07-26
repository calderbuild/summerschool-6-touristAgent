#!/usr/bin/env python3
"""Pull every open-data source Voie Libre relies on and cache it in data/sources/.

Two reasons this exists.

The first is the pitch. A live demo that queries a public API on stage is a demo
that depends on the venue wifi, on Overpass not being busy, and on a service
staying up during the ten minutes that matter. Everything here is cached to disk
so nothing has to be fetched while anyone is watching.

The second is that "we use real open data" is a claim, and a claim needs
something a juror can open. Each file lands next to a manifest entry recording
the exact URL, when it was pulled, how many records came back, and a checksum.
Anyone can re-run this and compare.

What this does NOT do: it does not generate mvp-demo/lib/places.ts. That file is
curated by hand and labels each record's confidence (a sight checked against the
venue's own site is not the same kind of fact as an OpenStreetMap tag), and no
script can make that judgement. This caches the evidence; a person still writes
the knowledge base.

Usage:
    python3 data/fetch_sources.py            # fetch everything
    python3 data/fetch_sources.py weather    # fetch one source by name
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sources"

# Overpass rejects POST from the public instance and answers 406, and it answers
# 429 to anything that looks like a script without an identifiable agent. GET
# plus a real User-Agent is the combination that works.
UA = "voie-libre/1.0 (EPSI Paris summer school, team 6; accessibility routing)"

# Central Paris. Kept tight on purpose: the wide bbox that covers the whole
# region times out at 504 on the public Overpass instance.
BBOX = "48.845,2.29,48.885,2.40"

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    # Same API, independent operator. Used when the main instance is busy, which
    # during European daytime it often is.
    "https://overpass.kumi.systems/api/interpreter",
]


def overpass_query(name: str, body: str) -> None:
    """Run one Overpass query, trying each mirror in turn."""
    last = None
    for base in OVERPASS:
        url = base + "?" + urllib.parse.urlencode({"data": body})
        try:
            payload = get_json(url)
        except Exception as e:  # noqa: BLE001 - any failure means try the mirror
            last = e
            print(f"  {base.split('/')[2]} failed ({e}), trying the next instance")
            time.sleep(2)
            continue
        write(name, url, payload, len(payload.get("elements", [])))
        return
    raise SystemExit(f"every Overpass instance failed for {name}: {last}")


def get_json(url: str) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return json.loads(res.read().decode("utf-8"))


def write(name: str, url: str, payload: object, count: int) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True)
    path = OUT / f"{name}.json"
    path.write_text(body, encoding="utf-8")

    manifest_path = OUT / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest[name] = {
        "url": url,
        "fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "records": count,
        "bytes": len(body.encode("utf-8")),
        "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"  {name}: {count} records, {len(body) // 1024} KB")


# ---- The sources ------------------------------------------------------------


def osm_subway_entrances() -> None:
    """Every metro entrance in central Paris, with whatever access tags it carries.

    The entrance's `name` is the entrance, not the station. Entrances are matched
    to stations by coordinate, never by comparing name strings.
    """
    overpass_query(
        "osm-subway-entrances",
        f'[out:json][timeout:90];node["railway"="subway_entrance"]({BBOX});out tags center;',
    )


def osm_elevators() -> None:
    """Lifts. Presence only: OpenStreetMap knows a lift exists, not whether it
    is working this morning, which is the whole reason lift status is presented
    as a snapshot rather than a live feed."""
    overpass_query(
        "osm-elevators",
        f'[out:json][timeout:90];(node["highway"="elevator"]({BBOX});'
        f'node["elevator"]["elevator"!="no"]({BBOX}););out tags center;',
    )


def osm_steps() -> None:
    """Stairs, and the reason the app says "step count unknown" so often: most
    of these carry no step_count at all. The count in the manifest against the
    count of tagged ones is the honest measure of that gap."""
    overpass_query(
        "osm-steps",
        f'[out:json][timeout:90];way["highway"="steps"]({BBOX});out tags center;',
    )


def osm_wheelchair_places() -> None:
    """Everything tagged wheelchair=yes that a traveller might actually want:
    where to eat, a pharmacy, a toilet. This is the source behind the
    restaurants and the pharmacy in the knowledge base, and behind their
    caveat: an OpenStreetMap tag is somebody's contribution, not the venue's
    confirmation."""
    overpass_query(
        "osm-wheelchair-places",
        f"[out:json][timeout:90];("
        f'node["wheelchair"="yes"]["amenity"~"^(restaurant|cafe|pharmacy|toilets)$"]({BBOX});'
        f'way["wheelchair"="yes"]["amenity"~"^(restaurant|cafe|pharmacy|toilets)$"]({BBOX});'
        f");out tags center;",
    )


def paris_events() -> None:
    """Que Faire a Paris, the city's own events feed."""
    url = (
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
        "que-faire-a-paris-/records?limit=100&order_by=date_start"
    )
    payload = get_json(url)
    write("paris-events", url, payload, len(payload.get("results", [])))


def idf_tourist_sites() -> None:
    """Ile-de-France's regional dataset of tourist sites."""
    url = (
        "https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/"
        "principaux-sites-touristiques-en-ile-de-france0/records?limit=100"
    )
    payload = get_json(url)
    write("idf-tourist-sites", url, payload, len(payload.get("results", [])))


def weather() -> None:
    """The one source the running app calls live, cached here so the shape is on
    record and so the fallback can be tested without waiting for bad weather."""
    url = (
        "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522"
        "&current=temperature_2m,weather_code,precipitation&timezone=Europe/Paris"
    )
    payload = get_json(url)
    write("weather-sample", url, payload, 1)


def basemap_style() -> None:
    """The 3D view's tile style. Cached because the app's hand-written style
    references source layers and fields from this schema, so if OpenFreeMap ever
    changes them, diffing this file is how we find out rather than discovering a
    blank map during a demo."""
    url = "https://tiles.openfreemap.org/planet"
    payload = get_json(url)
    write("openfreemap-tilejson", url, payload, len(payload.get("vector_layers", [])))


SOURCES = {
    "osm-subway-entrances": osm_subway_entrances,
    "osm-elevators": osm_elevators,
    "osm-steps": osm_steps,
    "osm-wheelchair-places": osm_wheelchair_places,
    "paris-events": paris_events,
    "idf-tourist-sites": idf_tourist_sites,
    "weather": weather,
    "basemap-style": basemap_style,
}


def main() -> None:
    wanted = sys.argv[1:] or list(SOURCES)
    unknown = [w for w in wanted if w not in SOURCES]
    if unknown:
        raise SystemExit(
            f"unknown source(s): {', '.join(unknown)}\nknown: {', '.join(SOURCES)}"
        )

    for name in wanted:
        print(f"{name} ...")
        try:
            SOURCES[name]()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            # One source being down is not a reason to lose the others. The
            # manifest keeps the previous fetch, so a stale entry is visible
            # rather than silently replaced by nothing.
            print(f"  SKIPPED, {name} unavailable: {e}")
        # The public Overpass instance is a shared free service. Space the
        # requests out rather than hammering it.
        time.sleep(3)

    print(f"\nCached in {OUT}")
    print(
        "Read sources/manifest.json for the URL, timestamp and checksum of each file."
    )


if __name__ == "__main__":
    main()
