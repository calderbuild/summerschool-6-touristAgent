# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Voie Libre is the team's Paris tourism app: an accessibility-first, step-free trip assistant.
This folder holds the actual build. Project-level context (data-source endpoints, the
tracked/untracked boundary, course constraints) lives in the repository-root `CLAUDE.md`.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000 (Turbopack)
npm run build      # production build; also the type check (fails on TS errors)
npm run lint       # eslint (flat config, eslint.config.mjs)
vercel --prod      # deploy; env vars must be set in the Vercel project
```

There is no test suite. `npm run build` is the gate: it runs TypeScript and prerenders,
so a clean build is the closest thing to "tests pass" here.

Requires `.env.local` (gitignored):
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — client-side, restrict by HTTP referrer in Cloud Console.
- `DEEPSEEK_API_KEY` — **server-side only, never prefix with `NEXT_PUBLIC`**. Used only by the
  route handler. Set both as Vercel production env vars at deploy.

## Architecture

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4. Read `AGENTS.md` before non-trivial
changes: this is Next 16 with breaking changes from earlier versions.

### Two surfaces, one data source
- `/` (`app/page.tsx` -> `components/chat/ChatShell.tsx`) is the **primary interface**: an LLM chat.
- `/routes` (`app/routes/page.tsx` -> `components/App.tsx`) is the visual dashboard (profile picker
  + spine + map).
- Both wrap their tree in `<I18nProvider>`. `app/layout.tsx` sets the fonts and the `bg-paper`
  `text-ink` shell.
- `lib/data.ts` is the single source of truth: `ROUTES` (curated, honest demo routes) and the
  `Status` / `RouteNode` / `DemoRoute` types. Everything else renders from it.

### Chat data flow (the part that spans the most files)
1. `ChatShell` POSTs the message history to `app/api/chat/route.ts`.
2. The route handler builds a system prompt **from `ROUTES`** (`routeCatalogue()`), so the model's
   knowledge stays in sync with the data, and streams from DeepSeek `deepseek-reasoner`.
3. It transforms DeepSeek's OpenAI-style SSE into newline-delimited JSON: `{type:"reasoning"|"content"|"error", text}`. `reasoning` is the chain-of-thought; `content` is the answer.
4. `ChatShell` accumulates `reasoning` into a collapsible panel (auto-collapses when the answer
   starts) and `content` into the message body.
5. The model is instructed to emit `[[route:id]]` markers in `content`. `ChatShell.renderAnswer`
   splits on that marker and renders `<ChatRouteCard id>` inline (a compact one-line-per-stop card).
   The full step-by-step spine (`AccessibilitySpine`) is only used on `/routes`.

Because the DeepSeek key is server-side, all model calls go through the route handler; the browser
never holds it. Do not send prior `reasoning_content` back in the message history.

### Status is the core abstraction
`Status` = `ok | lift | lift_down | stairs | unknown`. `steps` is `number | null | undefined`
(`null` = unknown, `undefined` = not applicable). `lib/status.ts` maps a `Status` to its CSS-var
colour (`statusColorVar`, used in JSX), its hex (`statusHex`, used for imperative Google Maps
markers), and its i18n legend key (`legendKey`). The spine, the compact card, and the map markers
all derive their colour from these, so they always agree.

**Honesty rule (product and course requirement):** unknown data is rendered as "unknown", never
guessed. Only ~38% of real OSM steps carry a count. Keep this when extending `ROUTES` or the prompt.

### i18n
`lib/i18n.tsx` is a small React context: a `DICT` of trilingual strings (`en`/`fr`/`zh`, English
default) and `useI18n()` returning `{ lang, setLang, t }`. Every user-facing string goes through
`t(key)`. The LLM is told to reply in the language the user writes in.

### Maps
`components/RouteMap.tsx` uses `@vis.gl/react-google-maps`, imperatively drawing a `Polyline` plus
lettered `CIRCLE` markers coloured by `statusHex`, and `fitBounds`. It renders a graceful fallback
when no key is set. **Gotcha:** passing an inline JSON `styles` array to `<Map>` blanks all basemap
tiles in this Maps API version, keep the default basemap (a muted style needs a Cloud Map ID, not
inline JSON).

### Styling
Tailwind v4 with tokens declared in `app/globals.css` `@theme` (no `tailwind.config.js`). Palette:
`paper` `ink` `navy` `signal` `ok` `barrier` `caution` `unknown`. Fonts (chosen for an accessibility
product): Bricolage Grotesque (display), Atkinson Hyperlegible (body, high legibility), JetBrains
Mono (data/labels). `globals.css` also ships the focus-visible ring, reduced-motion handling, and a
`.hatch-unknown` pattern so "unknown" never relies on colour alone.

@AGENTS.md
