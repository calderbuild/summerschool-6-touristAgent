# Data

Where Voie Libre's facts come from, and what each one is worth.

## The two tiers, and why they are labelled

Not every fact in this app is the same kind of fact, so the app does not present
them as if they were.

**Checked against the venue.** The sights were looked up one at a time on each
venue's own site: entry price, opening hours, wheelchair access, whether it is
closed for works. Where a price could not be confirmed for 2026 it says so, and
the Panthéon's is marked as a 2025 estimate rather than quietly carried forward.

**Taken from OpenStreetMap tags.** The restaurants and the pharmacy come from
`wheelchair=yes` tags. That tag is a contributor's observation, not the venue's
confirmation, so those records say they are unconfirmed and give a phone number
to ring ahead. One of them is step-free at the door and tagged
`toilets:wheelchair=no`, which is exactly the sort of detail this distinction
exists to preserve.

A third category has no coordinate at all: an emergency number, a free companion
ticket. Those live in `SERVICES` in `mvp-demo/lib/places.ts`, and each carries a
`caveat` field because every one of them has a condition that decides whether it
applies to a foreign visitor.

## Files

| Path | What it is |
|---|---|
| `build_places.py` | Generates `paris-places.csv` / `.xlsx` and the TypeScript knowledge base from the curated rows |
| `paris-places.csv` | The knowledge base as a flat table, for importing into anything |
| `paris-places.xlsx` | The same, formatted, with a schema sheet |
| `fetch_sources.py` | Pulls every open-data source and caches it under `sources/` |
| `sources/*.json` | The cached responses |
| `sources/manifest.json` | Per file: the exact URL, the fetch time, the record count, a SHA-256 |

## Sources

Run `python3 data/fetch_sources.py` to refresh all of them, or name one
(`python3 data/fetch_sources.py weather`).

| Source | Licence | Feeds | Live in the app? |
|---|---|---|---|
| OpenStreetMap via Overpass | ODbL 1.0, © OpenStreetMap contributors | Metro entrances, lifts, stairs, wheelchair-tagged venues | No, cached |
| Paris open data (`opendata.paris.fr`) | ODbL | Events, "Que Faire à Paris" | No, cached |
| Île-de-France open data (`data.iledefrance.fr`) | ODbL | Regional tourist sites | No, cached |
| Open-Meteo | CC-BY 4.0, free, no key | Live Paris weather in the chat prompt and the header chip | **Yes**, cached 10 min server-side, fails open |
| OpenFreeMap (`tiles.openfreemap.org`) | ODbL data, free service, no key | The 3D basemap on `/routes` | Yes, at render time |
| Venue websites | Each venue's own | Prices, hours, accessibility, official links | No, read by hand |

Attribution is required by ODbL and is shown in the app: every route card and the
`/routes` panel lists its sources, and the 3D map carries OpenFreeMap's own
attribution control.

## Gotchas that cost time, kept here so they cost it once

**Overpass rejects POST.** The public instance answers `406`. Use GET with a
real `User-Agent`; without one it answers `429`.

**Overpass times out on wide areas.** A bbox covering the whole region answers
`504`. `fetch_sources.py` uses a tight central-Paris bbox and falls through to
`overpass.kumi.systems` when the main instance is busy, which during European
daytime it often is. That fallback fired on the 2026-07-26 run.

**A subway entrance's `name` is the entrance, not the station.** Match entrances
to stations by coordinate, never by comparing name strings.

**Most stairs have no step count.** Measured on the cache below rather than
assumed: 1,313 of 3,246 stairways carry `step_count`, so **59.6% of the stairs in
central Paris do not say how many steps they are**. This is why the app says
"step count unknown" so often, and why it says that instead of estimating.

**acceslibre needs an API key.** `acceslibre.beta.gouv.fr` answers `403`
unauthenticated, so it is not used. OpenStreetMap covers the same ground for our
purposes.

**Real-time lift status is not in here.** IDFM's PRIM API has it behind a free
token with a 1000-request daily quota, and it is not wired up. The app therefore
describes lift status as "as of this morning" rather than as live, which is the
truth. This is the honest gap, and the app names it rather than papering over it.

## What the cache actually shows

Counted from `sources/` on 2026-07-26, bbox `48.845,2.29,48.885,2.40` (central
Paris). These are our own numbers, reproducible with `fetch_sources.py`.

| | Count | Notes |
|---|---|---|
| Metro entrances | 553 | **529 (95.7%) carry a `wheelchair` tag** |
| Stairways | 3,246 | 1,313 (40.4%) say how many steps |
| Lift nodes | 118 | Presence only, never live status |
| `wheelchair=yes` venues | 1,121 | 487 restaurants, 263 toilets, 220 cafés, 151 pharmacies |
| of those, stating `toilets:wheelchair` | 269 | A step-free door does not imply a step-free toilet |

The interesting part is the contrast in those first two rows. Whether a metro
entrance is accessible is nearly always recorded. How many steps a stairway has
usually is not. So the honest gap in this product is not "is there a barrier",
it is "how big is the barrier", and that is the gap the interface is built to
admit rather than fill.

## Why nothing is fetched during the demo

Everything above is cached to disk before a demo. A live query on stage depends
on the venue wifi and on a free shared service staying up during the ten minutes
that matter. The single exception is the weather, which is genuinely live, cached
for ten minutes, and designed to fail open: if Open-Meteo is down, the chat loses
one sentence of context and nothing else.
