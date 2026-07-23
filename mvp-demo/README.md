# Voie Libre — app

The Next.js app behind [Voie Libre](../README.md): step-free Paris routes with honest
accessibility data.

## Setup

```bash
npm install
```

Add a Google Maps JavaScript API key. Without it, the map area shows a graceful
fallback and the rest of the app still works.

```bash
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here" > .env.local
```

The key is public by design (it ships in the client bundle), so restrict it by HTTP
referrer in the Google Cloud console. `.env.local` is gitignored and never committed.

## Develop

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Structure

```
app/
  layout.tsx          fonts, metadata, page shell
  page.tsx            wraps the app in the i18n provider
  globals.css         Tailwind v4 theme tokens (paper / ink / navy / status colours)
components/
  App.tsx             main shell: profile picker, disruption banner, layout
  AccessibilitySpine.tsx   the signature vertical route map
  RouteMap.tsx        Google Map with the route drawn and stops colour-coded
lib/
  data.ts             demo routes and traveller profiles (curated, honest)
  i18n.tsx            trilingual strings (en / fr / zh), English default
  status.ts           accessibility status to colour and label
```

## Data honesty

Route data in `lib/data.ts` is curated demo data grounded in real Paris facts: Line 14
is the only fully step-free métro line, most stations have no working lift, and lift
status is not reliably published in real time. Unknown values are shown as "unknown",
never filled with a guess. Keep that rule when extending the data.

## Deploy

Deployed on Vercel. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` as a project environment
variable (it is needed at build time). Then:

```bash
vercel --prod
```

## Notes

This runs on Next.js 16, which has breaking changes from earlier versions. See
`AGENTS.md` and the guides under `node_modules/next/dist/docs/` before large changes.
