# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Team 6's project for the EPSI/BISTU Paris AI summer school (2026-07-21 to 2026-07-29): a Paris
itinerary assistant whose differentiator is **physical accessibility** (stairs, elevator status,
mobility/fatigue constraints) layered on top of the generic "AI chatbot" course brief. The graded
deliverable is a working chatbot prototype plus a team pitch, not a production product.

The prototype is built in `mvp-demo/` as a Next.js 16 + React 19 + TypeScript app (Tailwind v4,
`@vis.gl/react-google-maps`), branded **Voie Libre**. Run it with `cd mvp-demo && npm install &&
npm run dev`; build with `npm run build`, lint with `npm run lint`. The Google Maps key lives in
`mvp-demo/.env.local` (gitignored); on Vercel it must be set as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
(needed at build time). Deploy target is Vercel. `data/` is still a placeholder until the live
data layer is wired; the current app uses curated demo data in `mvp-demo/lib/data.ts`.

## Repository layout and the tracked/untracked boundary

| Path | Role | Git |
|---|---|---|
| `README.md` | Public team + project overview, Day-1 setup facts | tracked |
| `docs/*.md` | Internal research, topic-selection decisions, course notes | **untracked (gitignored)** |
| `data/` | Pulled open datasets (empty until the data layer is built) | tracked dir |
| `mvp-demo/` | The actual build (Voie Libre Next.js app) | tracked, app built |

**Critical:** the `docs/` files are gitignored on purpose. Team repos fork from a shared upstream,
so GitHub's fork network puts every team's repo one click from every other team's. The `docs/`
contain competitive analysis and positioning that must not become visible to other teams. Never
`git add -f` them, never remove their `.gitignore` entries, and do not reproduce their strategic
content in any tracked file (including this one, which would also be exposed if committed).

## Architecture (the intended shape)

The design decision that spans all three docs: keep the course-required no-code tool as a thin
frontend and put the real logic in a separate API.

```
no-code tool (course-required)   ← chat UI / intent handling / the graded deliverable
        │  HTTP request / webhook block
        ▼
mvp-demo/  (own API)             ← accessibility routing: step counts, elevator status,
        │                           fatigue model, route fallbacks
        ▼
open data (IDFM GTFS / OSM / Paris & Île-de-France datasets / weather)
```

Design intent worth preserving:
- The backend's value must be **surfaced in the UI** (e.g. a route card showing "47 steps, no
  elevator"). Effort hidden in an invisible backend is a known way to lose points with the jury.
- Real open data is table stakes, not the differentiator; the accessibility angle and the team's
  own field data (walking the official 7/25-26 route) are.

## Data layer: verified endpoints and gotchas

These were curl-verified during research (2026-07-20). Cache responses to local JSON in `data/`
before any demo; do not hit public APIs live during a pitch.

- **OSM / Overpass** (steps, elevators, wheelchair tags): the public instance returns **406 on
  POST**. Use **GET with a custom `User-Agent`**:
  ```bash
  curl -s -G "https://overpass-api.de/api/interpreter" \
    -H "User-Agent: paris-accessibility/1.0" \
    --data-urlencode 'data=[out:json][timeout:90];node["railway"="subway_entrance"](48.815,2.25,48.905,2.42);out tags;'
  ```
  Subway-entrance `name` is the *entrance* name, not the station name. Assign entrances to the
  nearest station node by coordinates (~250m threshold), do not match on name strings.
- **Paris open data** (live events, "Que Faire à Paris"): `https://opendata.paris.fr/api/explore/v2.1/...`
- **Île-de-France open data** (tourist sites, museums): `https://data.iledefrance.fr/api/explore/v2.1/...`
- **IDFM static GTFS** (offline timetables, no registration): `https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip`
- **IDFM PRIM** (real-time transit / elevator status): free self-serve token, quota 5 req/s and
  1000 req/day. Real-time elevator state is the one unverified technical assumption; if it is not
  freely available, degrade to static data with an honest "real-time status needs the transit API"
  note rather than inventing values.
- **Weather** (Open-Meteo, no key): `https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code`

When step counts are unknown (only ~38% of OSM steps carry `step_count`), display "steps (count
unknown)". Do not fabricate a number; an admitted data gap scores better than a wrong figure.

## Conventions

- Submission naming: `Summer School - [Team Number] - [Project Name]`.
- Course wants a **private** repo with the instructor added as collaborator; this repo may currently
  be public. Confirm which the instructor actually checks before flipping visibility.
- This is a student team project. Persisted text (commits, docs) is first-person as the author;
  keep the internal competitive strategy out of anything tracked.
