# Voie Libre: step-free routes across Paris

EPSI / BISTU Paris AI Summer School 2026, Team 6.

Voie Libre is a Paris trip assistant built around the one thing generic travel chatbots
ignore: whether you can physically make the journey. It plans routes over the real
timetable, counts the climb and the final walk, reads the operator's live lift outages,
and states plainly what the open data does not know.

**Live:** https://voie-libre.vercel.app

## The problem

Most trip planners in Paris optimise for time. For a wheelchair user, a parent with a
stroller, an older traveller, or anyone low on energy, the fastest route is often
unusable: a three-minute connection can hide a staircase, and a lift that was working
last week is not a lift that is working today.

The scale of it, counted from the operator's own registers across the 945 stations in
the timetable we load rather than quoted from anyone: 432 carry an accessibility class
at all. Of those, 14 can be used with no help whatsoever, 216 only with a booking or a
member of staff, and 202 are marked not accessible. Seven stations have nothing
published in either register.

RATP publishes Metro Line 14 as step-free end to end. That is their claim, and we
repeat it as theirs: in the registers we read, 9 of the line's 21 stations have every
platform marked accessible and 6 carry a station-level class of "booking required" or
"ask a member of staff", 5 of those shared with RER or Transilien, so the class may be
describing the rest of the station rather than line 14's platforms. It is still the
best bet in Paris. It is not a guarantee, and which of the two you are relying on is
the useful part.

## What it does

- **Chat first.** The primary interface is a conversation. Ask in English, French or
  Chinese and the answer comes back in the language you wrote in.
- **Real routing, not a description of one.** The journey is computed by our own code
  over IDFM's published timetable (945 stations, 57 lines including trams, 2,488 hops)
  before the model is called. The model describes the route; it never draws one.
- **Profiles are a set.** Wheelchair, stroller, older traveller, low energy, and you can
  be more than one at once. The router takes the strictest requirement wherever two
  disagree, which changes the route rather than the wording: Bastille to Sacre-Coeur is
  34 minutes with a stroller and a different 93-minute route once a wheelchair is in
  the set.
- **Live lift outages.** Read from IDFM's `etat-des-ascenseurs` feed, per station, on
  your actual route. The feed publishes outages, not health, so nothing here ever calls
  a lift working: a station with no entry is "not currently reported broken", and lifts
  the operator says nothing about are shown as exactly that.
- **The obstacles a step count misses.** The climb in metres and the final walk in
  minutes both reach the verdict line, because a flat 1,451-metre push with no barrier
  anywhere is still 23 minutes of pushing.
- **What is on, joined to whether you can get there.** Paris publishes an accessibility
  flag on every event and the transport operator publishes one on every station. Nobody
  joins them. `/whats-on` does, so an event the city calls wheelchair accessible can be
  shown sitting above a station that needs a booking.
- **Honesty over guessing.** Where the data does not know, the app says "unknown"
  rather than inventing a figure. Only 1,313 of the 3,246 Paris stairways we pulled from
  OpenStreetMap carry a step count,
  and the open timetable has no RER C trains through Paris at all, so a journey to the
  Eiffel Tower ends in a walk we state in metres and minutes rather than a line drawn
  to the tower.
- **A correction layer.** The team console at `/admin` can fix a fact the day somebody
  checks it, without a deploy, and every correction carries the date and an audit trail.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- DeepSeek `deepseek-reasoner` for the conversation, called server-side only
- Google Maps JavaScript API via `@vis.gl/react-google-maps`
- Supabase (Postgres) for the correction layer only, with row-level security
- Deployed on Vercel

## Data sources

- IDFM static GTFS: the timetable the route graph is built from
- IDFM "État des ascenseurs" via PRIM: live lift outages
- IDFM station and stop registers: the operator's accessibility class per stop
- Que Faire à Paris / Ville de Paris: what is on this week
- OpenStreetMap / Overpass: steps, lifts, wheelchair tags
- Open-Meteo: weather and station elevation
- Google Maps: base map and geometry

The graph and the registers are compiled into the repository at build time. The lift
outages, the weather and the events are fetched live, each failing independently, and
the reply says which source is missing rather than filling the hole.

## Run it locally

The app lives in `mvp-demo/`. See [`mvp-demo/README.md`](mvp-demo/README.md) for setup,
including the Google Maps API key. In short:

```bash
cd mvp-demo
npm install
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here" > .env.local
npm run dev
```

Then open http://localhost:3000.

The gate before any deploy, run from `mvp-demo/`: `npx vitest run` (165 tests), plus
`npx tsc --noEmit`, `npm run lint` and `npm run build`. Most of those tests exist to
stop an honesty regression rather than a crash.

## Team

- Calder (Lin Luo), team lead
- Hou Zhenrui
- Lu Surui
- Bai Pengyu

## Course context

- Submission naming: `Summer School - 6 - Voie Libre`.
- The graded deliverable is a working prototype plus a team pitch.
- Evaluation is by the functional requirements the team sets for itself, so the
  accessibility angle is our chosen differentiator.
