# Voie Libre — Technical Architecture

Voie Libre is Team 6's Paris sightseeing assistant. Its differentiator is **physical
accessibility**: it plans step-free routes across the city and answers questions about the
main sights through a mobility lens (lifts, stairs, wheelchair access), and it is honest when
the data is unknown rather than inventing a number.

This document explains how the prototype is built and, in particular, **how the knowledge base
and its retrieval work** (Section 3).

---

## 1. Stack and surfaces

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind v4** with design tokens declared in `app/globals.css` `@theme` (no `tailwind.config.js`)
- **`@vis.gl/react-google-maps`** for the map
- **DeepSeek `deepseek-reasoner`** as the chat model (server-side)
- Deploy target: **Vercel**

There are two user-facing surfaces, both wrapped in `<I18nProvider>`:

| Route | Entry | Role |
|---|---|---|
| `/` | `app/page.tsx` → `components/chat/ChatShell.tsx` | Primary interface: the LLM chat |
| `/routes` | `app/routes/page.tsx` → `components/App.tsx` | Visual dashboard: profile picker + accessibility spine + map |

`npm run build` is the gate (there is no test suite): it runs the TypeScript check and prerenders
the static pages, so a clean build is the closest thing to "tests pass".

---

## 2. System shape

The design keeps the presentation thin and puts the real knowledge in typed data that both the UI
and the model read from, so the two never drift.

```
                 ┌──────────────────────────────┐
   Browser  ───► │  /  ChatShell (React)        │  message history + mobility profile
                 └──────────────┬───────────────┘
                                │ POST /api/chat  (NDJSON stream back)
                                ▼
                 ┌──────────────────────────────┐
                 │  app/api/chat/route.ts        │  server-only (holds the DeepSeek key)
                 │  • builds the system prompt   │
                 │    from typed data:           │
                 │      routeCatalogue(ROUTES)   │
                 │      placeCatalogue(PLACES)   │
                 │  • live weather (Open-Meteo)  │
                 │  • streams DeepSeek → NDJSON  │
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │  lib/data.ts   (ROUTES)       │  curated step-free routes
                 │  lib/places.ts (PLACES)       │  knowledge base of 13 attractions
                 └──────────────────────────────┘
```

`/routes` reads the same `lib/data.ts` directly and renders it as a spine + map; it does not call
the model.

---

## 3. The knowledge base and how retrieval works

This is the part that grounds the chatbot on real Paris facts instead of letting it hallucinate.

### 3.1 What is in it

`lib/places.ts` exports `PLACES: Place[]` — **13 curated Paris attractions**, each with 18 fields:

| Field | Meaning |
|---|---|
| `id` | stable slug (`eiffel-tower`, `louvre`, …) |
| `nameEn` / `nameFr` | display names |
| `category` | `Monument \| Museum \| Cathedral \| Basilica \| Park \| Palace \| Shopping` |
| `arrondissement` | district (with postcode) |
| `coord` | `{ lat, lng }` |
| `visitDuration` | typical time to plan (e.g. `2-3 h`) |
| `budget` | adult entry cost in EUR, or `Free` |
| `free` | boolean, entry is free |
| `openingHours` | opening hours, closures noted |
| `nearestTransit` | nearest metro / RER |
| `stationStepFree` | whether that station is step-free (often `Partial`) |
| `wheelchair` | wheelchair situation on site |
| `accessibleToilet` | `Yes` / `No` / `Unknown` |
| `status` | `open \| closed` |
| `officialUrl` | source of truth for the visitor |
| `source` | where the value came from |
| `lastVerified` | verification date |
| `notes` | caveats, honesty notes, tips |

The data is deliberately **honest**: fields that are not verified say `Unknown`, prices that are
estimates say so (e.g. Panthéon `≈€13 (2025 estimate; confirm 2026)`), and Centre Pompidou is
marked `closed` (5-year renovation until 2030) with a `Do NOT recommend visiting` note.

### 3.2 Single source of truth → generated artifacts

The data is edited in exactly one place: **`data/build_places.py`** (a `ROWS` list of dicts).
Running it emits three artifacts from that one list:

- `data/paris-places.xlsx` — the human-facing spreadsheet (styled, with a README sheet) that the
  team maintains and can show the jury
- `data/paris-places.csv` — a plain export
- `mvp-demo/lib/places.ts` — the typed `PLACES` array the app imports

Because all three come from one script, the spreadsheet the team edits and the data the chatbot
uses can never silently drift apart. To change a fact, edit `build_places.py` and re-run it; never
hand-edit `places.ts`.

### 3.3 Retrieval: whole-KB context grounding (not vector RAG)

**How it actually works, stated plainly:** on every chat request, the route handler calls
`placeCatalogue()` (in `app/api/chat/route.ts`), which serializes the **entire** knowledge base
into a compact text projection and injects it into the system prompt, next to a set of grounding
rules. There is **no embedding step, no vector database, and no similarity search.** The model
answers attraction questions from facts that are already in its context.

The projection is compact on purpose — it keeps the fields the model needs to answer
(`budget`, `visitDuration`, `openingHours`, `wheelchair`, `nearestTransit`, `notes`, plus a
`CLOSED` flag) and drops the ones it does not (`coord`, `officialUrl`, `source`). One line per
place looks like:

```
"louvre" [Museum, 1st (75001)] Louvre Museum (Musée du Louvre): budget:€22 (EEA residents); €32
(non-EEA); visit:3-4 h (half day); hours:09:00-18:00; late to 21:45 Wed & Fri; closed Tue;
wheelchair:Yes (fully accessible; free for wheelchair users + 1 companion); nearest:M1/M7 Palais
Royal-Musée du Louvre. New 2026 dual pricing (EEA vs non-EEA)...
```

**Why this is the right design at this scale:**

- **It is cheap.** 13 places project to well under 1k tokens. Injecting the whole KB costs less
  than a single retrieval round-trip would, and it adds zero infrastructure (no vector store, no
  embedding calls, no index to keep in sync).
- **It is deterministic and auditable.** The model sees exactly the same verified facts on every
  request. There is no "the retriever fetched the wrong chunk" failure mode, which is the most
  common way small RAG systems go wrong.
- **Honesty is enforceable in one place.** Because the whole KB is present, "not in the data" can't
  be confused with "the retriever didn't fetch it". The prompt can then make one clean promise:
  never invent a price/hour/access fact, say `unknown` when a field is unknown, never recommend a
  `CLOSED` place.

In other words, "retrieval" here reduces to two things: the projection step (`placeCatalogue()`)
and the grounding instructions. That is a legitimate and common pattern for a small, curated
corpus — using a vector database for 13 records would be more moving parts for less reliability.

### 3.4 The grounding contract (the exact rules in the prompt)

The system prompt tells the model, for the attractions KB:

1. Use it to answer entry cost / budget, visit duration, opening hours, wheelchair access, and to
   build short step-free itineraries.
2. **Never invent** a price, an opening time, or an accessibility fact that is not in the data; if
   it is missing, say it is unknown or point to the official site.
3. **Never recommend a place marked `CLOSED`**; if asked, say it is closed for works and offer an
   open alternative.
4. When naming an attraction, keep the accessibility lens (mention its step-free / wheelchair
   situation).

Verified behaviour: asked "How much is the Louvre, how long, is it accessible, and can I visit the
Centre Pompidou this week?", the model answers the Louvre correctly (€22 EEA / €32 non-EEA, 3-4 h,
wheelchair accessible) and refuses Pompidou ("closed until 2030"), offering Musée d'Orsay instead.

### 3.5 When to move to real retrieval

- **Threshold.** Switch when the corpus grows past a few hundred places, or the projection exceeds
  a few thousand tokens — at that point context cost, latency, and the model losing the needle in a
  long prompt all start to bite.
- **Migration path.** Embed each place record → store vectors (e.g. `pgvector` or a hosted vector
  DB) → at request time embed the user's query and take the top-k (k ≈ 5–8) nearest places, and
  inject only those. `placeCatalogue()` is the natural seam: replace "serialize all" with
  "serialize top-k"; everything downstream (grounding rules, the `[[route:…]]` marker system, the
  UI) is unchanged.
- Carry the same honesty rules over, and add: "if the retrieved set does not contain the place, say
  you don't have verified data for it."

---

## 4. Chat pipeline

1. **`ChatShell`** POSTs `{ messages, profile }` to `/api/chat`. It never holds the model key.
2. **`route.ts`** builds the system prompt from typed data (`routeCatalogue(ROUTES)` +
   `placeCatalogue(PLACES)`), adds live weather, and streams from DeepSeek `deepseek-reasoner`.
3. It transforms DeepSeek's OpenAI-style SSE into **newline-delimited JSON**, one object per line:
   `{ type: "reasoning" | "content" | "error", text }`.
   - `reasoning` = the model's chain-of-thought (accessibility trade-offs), shown in a collapsible
     panel that auto-collapses once the answer starts.
   - `content` = the answer body.
4. The model is told to emit a **`[[route:id]]`** (or `[[route:id:profile]]`) marker on its own line
   early in the answer when the request matches a prepared route. `ChatShell.renderAnswer` splits on
   that marker and renders a compact inline `<ChatRouteCard>` — an unknown id is dropped silently
   rather than leaking raw `[[route:…]]` syntax into the demo.

### Security and robustness (all in `route.ts`)

- **Key isolation.** `DEEPSEEK_API_KEY` is server-side only. It is read only in the route handler;
  never prefix it with `NEXT_PUBLIC`.
- **Rate limit.** Best-effort per-IP fixed window: 15 requests / 60 s per warm instance, preferring
  the Vercel `x-real-ip` over the spoofable leftmost `x-forwarded-for` hop. The map is swept and
  hard-capped so it can't grow unbounded under IP churn.
- **Payload cap.** Requests declaring `content-length > 64 KB` are rejected before parsing.
- **Input validation.** History is sliced to the last 40 then 20 turns, only `user`/`assistant`
  string turns are kept (any injected `system` role is dropped), and each message is capped at 4000
  chars — bounding token cost and blocking prompt-injection via a fake system turn.
- **Weather is fail-open.** Open-Meteo (no key) is fetched with a 2.5 s timeout and cached
  module-scope (10 min on success, 1 min on failure); a weather outage never blocks the chat.
- **In-band errors.** DeepSeek can return HTTP 200 then a JSON error line (quota/policy); that is
  surfaced as an `error` object instead of being swallowed.

---

## 5. Data model and shared abstractions

### `Status` is the core abstraction

`Status = ok | lift | lift_down | stairs | unknown`, and `steps` is `number | null | undefined`
(`null` = unknown, `undefined` = not applicable). `lib/status.ts` maps a `Status` to:

- its CSS-var colour (`statusColorVar`, used in JSX),
- its hex (`statusHex`, used for imperative Google Maps markers — kept in lockstep with the tokens),
- its i18n legend key (`legendKey`).

The spine, the compact route card, and the map markers all derive their colour from these, so they
always agree. **Honesty rule:** unknown data renders as "unknown", never guessed (only ~38% of real
OSM steps carry a count).

### i18n

`lib/i18n.tsx` is a small React context: a trilingual `DICT` (`en` / `fr` / `zh`, English default)
and `useI18n()` returning `{ lang, setLang, t }`. Every user-facing string goes through `t(key)`,
and the model is told to reply in the language the user writes in.

### Maps

`components/RouteMap.tsx` uses `@vis.gl/react-google-maps`, imperatively drawing a `Polyline` plus
lettered `CIRCLE` markers coloured by `statusHex`, with a graceful fallback when no key is set.
Gotcha: passing an inline JSON `styles` array to `<Map>` blanks all basemap tiles in this API
version — keep the default basemap.

---

## 6. Design system

The palette is not decoration: **colour encodes accessibility state**, and it is tuned for WCAG
contrast because this is an accessibility product. Tokens live in `app/globals.css` `@theme`.

### Fonts (chosen for legibility)

- **Bricolage Grotesque** — display / headings
- **Atkinson Hyperlegible** — body (designed for low-vision readers)
- **JetBrains Mono** — data / labels / the reasoning panel

### Palette and measured contrast

Neutral spine plus a status palette where each hue carries meaning. Fills and coloured *text* use
different tokens so text always clears AA (the bright fill hues would fail as text). Measured ratios
(sRGB, against the surface each is used on):

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `paper` | `#f5f4f0` | app background (warm limestone off-white) | — |
| `ink` | `#1a1c22` | primary text | 15.5:1 on paper (AAA) |
| `ink-soft` | `#4c515a` | secondary text | 7.2:1 paper / 8.0:1 white (AAA) |
| `navy` | `#12202e` | header / primary buttons | white 16.5:1 (AAA) |
| `signal` | `#1b57a6` | links / focus ring / lift | 6.5:1 paper, 7.1:1 white |
| `ok` / `ok-ink` | `#1e8e5a` / `#0d6f43` | step-free (fill / text) | ok-ink 5.7:1 paper (AA) |
| `barrier` | `#c63a2f` | stairs / lift out of service | 4.7:1 paper (AA) |
| `caution` / `caution-ink` | `#c77a16` / `#8a5510` | disruption (fill / text) | caution-ink 5.6:1 paper (AA) |
| `unknown` | `#616671` | unknown state | 5.2:1 paper as text (AA) |

Every text pair clears WCAG AA; primary and secondary text clear AAA.

### The signature motif and the accessibility floor

- **The hatch = "we visibly mark what we don't know".** `.hatch-unknown` (a diagonal hatch) marks
  the `unknown` state so it never relies on colour alone; `.hatch-whisper` is the same hatch at 4%
  opacity as brand texture. The chat empty state opens on a `StepFreeLine` motif — a step-free
  transit line whose unknown stretch is drawn as a hatched segment — the product's own visual
  language and the one place boldness is spent.
- **Quality floor:** responsive down to mobile (the primary target), a visible keyboard focus ring
  on every interactive element, `prefers-reduced-motion` respected globally, a single polite live
  region that announces the settled answer once (not token-by-token), and a keyboard-aware composer
  pinned above the iOS keyboard via `visualViewport`.

---

## 7. Open data sources

Real open data is table stakes; the accessibility angle is the differentiator. The prototype
currently runs on curated demo data (`lib/data.ts`, `lib/places.ts`); the live data layer targets
these endpoints (curl-verified 2026-07-20 — cache responses to local JSON before any demo, do not
hit public APIs live during a pitch):

- **OSM / Overpass** (steps, elevators, wheelchair tags) — GET with a custom `User-Agent` (public
  instance returns 406 on POST). Only ~38% of steps carry a count, so show "steps (count unknown)".
- **Paris open data** — `https://opendata.paris.fr/api/explore/v2.1/...`
- **Île-de-France open data** — `https://data.iledefrance.fr/api/explore/v2.1/...`
- **IDFM static GTFS** — offline timetables, no registration.
- **IDFM PRIM** — real-time transit / lift status (free token, 5 req/s, 1000 req/day). If real-time
  lift state is not freely available, degrade to static data with an honest "real-time status needs
  the transit API" note rather than inventing values.
- **Weather** — Open-Meteo, no key (already wired into the chat).

---

## 8. Build, deploy, and extending

```bash
npm install
npm run dev        # http://localhost:3000 (Turbopack)
npm run build      # production build; also the type check (fails on TS errors)
npm run lint       # eslint (flat config)
vercel --prod      # deploy; env vars must be set in the Vercel project
```

Requires `.env.local` (gitignored):
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — client-side, restrict by HTTP referrer in Cloud Console.
- `DEEPSEEK_API_KEY` — **server-side only, never `NEXT_PUBLIC`.** Set both as Vercel production env
  vars at deploy.

**To add an attraction:** edit `data/build_places.py`, re-run it (regenerates the xlsx, csv, and
`lib/places.ts`), then `npm run build`. The chatbot picks up the new place automatically because the
system prompt is built from `PLACES`.

**To add a prepared route:** add a `DemoRoute` to `ROUTES` in `lib/data.ts`. Both `/routes` and the
chat (`routeCatalogue()`) pick it up automatically, and the model can reference it with a
`[[route:id]]` marker.
