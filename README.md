# Voie Libre — step-free routes across Paris

EPSI / BISTU Paris AI Summer School 2026, Team 6.

Voie Libre is a Paris trip assistant built around one thing generic travel chatbots
ignore: whether you can physically make the journey. It plans routes that account for
stairs, lift (elevator) status, walking distance, and fatigue, and it is honest about
what the open data does and does not know.

**Live demo:** deploying to Vercel (URL added once live).

## The problem

Most trip planners in Paris optimise for time. For a wheelchair user, a parent with a
stroller, an older traveller, or anyone low on energy, the fastest route is often
unusable: a "3 minute" connection can hide 47 steps and a broken lift. Only Métro
Line 14 is fully step-free, and roughly 30 of 300+ stations have working lifts. That
gap is the product.

## What it does

- **Profiles.** Pick who is travelling (wheelchair, stroller, older traveller, low
  energy). The route and the thresholds for stairs and walking distance change with it.
- **Accessibility spine.** Every leg of the journey is shown as a vertical route map:
  step counts, lift status, walking segments, accessible restrooms, and the barriers to
  avoid, each marked step-free, working lift, out of service, stairs, or unknown.
- **Barriers with alternatives.** When a lift is out of service, the route names the
  step-free workaround (for example, stay one stop further and take a level-boarding bus)
  instead of just failing.
- **On the map.** The route is drawn on Google Maps with each stop colour-coded by its
  accessibility status.
- **Honesty over guessing.** Only about 38% of OpenStreetMap steps carry a count, and
  real-time lift status is not published for the full network. Where we do not know, we
  say "unknown" rather than inventing a number. An admitted gap is more useful than a
  wrong figure.
- **Trilingual.** English, French, and Chinese, defaulting to English.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Google Maps JavaScript API via `@vis.gl/react-google-maps`
- Deployed on Vercel

## Data sources

Real Paris open data, cached locally for the demo rather than called live during a pitch:

- IDFM "État des ascenseurs" — lift status
- RATP — accessible station reference
- OpenStreetMap / Overpass — steps, elevators, wheelchair tags
- Google Maps — base map and geometry

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

## Team

- 罗林 (Lin Luo) — team lead
- 侯臻瑞
- 陆苏睿
- 白澎宇

## Course context

- Submission naming: `Summer School - 6 - Voie Libre`.
- The graded deliverable is a working prototype plus a team pitch.
- Evaluation is by the functional requirements the team sets for itself, so the
  accessibility angle is our chosen differentiator.
