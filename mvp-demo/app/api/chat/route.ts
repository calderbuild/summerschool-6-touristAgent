import { ROUTES, PROFILES } from "@/lib/data";
import { ACCESS_LEVELS, findStation, networkFacts, toiletsAt, type NetworkFacts } from "@/lib/idfm";
import { PLACES, SERVICES } from "@/lib/places";
import { cityEvents, joinCounts, rank, type EventFeed } from "@/lib/events";
import { COVERAGE, mentionedEndpoints, plan, NETWORK_META, type ProfileId } from "@/lib/router";

// DeepSeek key is server-side only; the browser never sees it.
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Tried in order. Both return `reasoning_content`, which the visible reasoning
// panel needs; pro reasons more thoroughly, flash is the faster stand-in.
// Verified against GET https://api.deepseek.com/models on 2026-07-24: these are
// the only two ids the API accepts. Re-check that endpoint before changing them,
// because a retired id fails as a 400 that only shows up at chat time.
const MODELS = ["deepseek-v4-pro", "deepseek-v4-flash"];

const ROUTE_IDS = ROUTES.map((r) => r.id);
const PROFILE_IDS = PROFILES.map((p) => p.id) as string[];

// ---- Abuse guard: best-effort per-IP fixed window (per warm instance) --------
const WINDOW_MS = 60_000;
// Sized for a room, not for one person. Everyone in a lecture hall leaves
// through a single NAT address, so a per-IP bucket is really a per-audience
// bucket: at 15 the jury and the team would have throttled each other during
// the demo. This still caps what a single address can spend on the model,
// which is all this guard was ever for.
const MAX_PER_WINDOW = 90;
const HITS = new Map<string, { n: number; t: number }>();

// Prefer the Vercel-set client IP over the client-controllable X-Forwarded-For
// leftmost hop (which an attacker can spoof to mint a fresh bucket per request).
function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

/** Seconds to wait if this address is over its allowance, otherwise 0. */
function rateLimited(ip: string): number {
  const now = Date.now();
  // Sweep expired buckets so the map cannot grow unbounded under IP churn/spoofing.
  if (HITS.size > 2000) {
    for (const [k, v] of HITS) if (now - v.t >= WINDOW_MS) HITS.delete(k);
    if (HITS.size > 20000) HITS.clear(); // hard backstop
  }
  const w = HITS.get(ip);
  if (w && now - w.t < WINDOW_MS) {
    if (w.n >= MAX_PER_WINDOW) return Math.ceil((WINDOW_MS - (now - w.t)) / 1000);
    w.n++;
    return 0;
  }
  HITS.set(ip, { n: 1, t: now });
  return 0;
}

// ---- Live weather (Open-Meteo, no key), cached module-scope for 10 min -------
let weatherCache: { text: string; t: number } | null = null;

function describeWeather(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "mostly clear";
  if (code === 3) return "overcast";
  if (code >= 45 && code <= 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code >= 95) return "thunderstorm";
  return "unsettled";
}

async function currentWeather(): Promise<string | null> {
  // Cache successes for 10 min, failures for 1 min (so an Open-Meteo outage
  // doesn't make every chat request pay the full 2.5s timeout).
  if (weatherCache) {
    const ttl = weatherCache.text ? 600_000 : 60_000;
    if (Date.now() - weatherCache.t < ttl) return weatherCache.text || null;
  }
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code,precipitation&timezone=Europe/Paris",
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) {
      weatherCache = { text: "", t: Date.now() };
      return null;
    }
    const j = await res.json();
    const c = j.current ?? {};
    // Guard the numeric fields so a malformed 200 never puts "NaN°C" in the prompt.
    if (typeof c.temperature_2m !== "number" || Number.isNaN(c.temperature_2m) || typeof c.weather_code !== "number") {
      weatherCache = { text: "", t: Date.now() };
      return null;
    }
    const raining = typeof c.precipitation === "number" && c.precipitation > 0;
    const text = `Paris right now (live, Open-Meteo): ${Math.round(c.temperature_2m)}°C, ${describeWeather(
      c.weather_code
    )}${raining ? ", rain falling" : ""}.`;
    weatherCache = { text, t: Date.now() };
    return text;
  } catch {
    // fail open: weather is a bonus, never blocks the chat
    weatherCache = { text: "", t: Date.now() };
    return null;
  }
}

function routeCatalogue(): string {
  return ROUTES.map((r) => {
    const legs = r.nodes
      .map((n) => {
        const bits: string[] = [n.name, `access:${n.at}`];
        if (n.steps === null) bits.push("steps:unknown");
        else if (typeof n.steps === "number" && n.steps > 0) bits.push(`steps:${n.steps}`);
        if (n.barrier) bits.push(`barrier:"${n.barrier.en}"`);
        if (n.alt) bits.push(`step-free-alt:"${n.alt.en}"`);
        return "    - " + bits.join(", ");
      })
      .join("\n");
    return `  id "${r.id}": ${r.from} -> ${r.to}\n${legs}`;
  }).join("\n");
}

// Referenced knowledge base of Paris attractions (see lib/places.ts). Kept compact
// so the model is grounded on real budgets, hours and accessibility, never invents them.
function placeCatalogue(): string {
  return PLACES.map((p) => {
    const bits = [
      `budget:${p.budget}`,
      `visit:${p.visitDuration}`,
      `hours:${p.openingHours}`,
      `wheelchair:${p.wheelchair}`,
      `nearest:${p.nearestTransit}`,
      // Carried so the reply can cite where a fact came from and when it was
      // checked, instead of asking the traveller to take our word for it.
      `official:${p.officialUrl}`,
      // Provenance, not just the date. This is what separates a price read off
      // the venue's own site from an OpenStreetMap tag somebody contributed, and
      // the model needs the difference to know which facts to hedge.
      `source:${p.source}`,
      `checked:${p.lastVerified}`,
    ];
    const flag = p.status === "closed" ? "CLOSED, do not recommend; " : "";
    return `  "${p.id}" [${p.category}, ${p.arrondissement}] ${p.nameEn} (${p.nameFr}): ${flag}${bits.join("; ")}. ${p.notes}`;
  }).join("\n");
}

// Services are reached by phone or by right rather than by walking to them, so
// they carry a caveat instead of a location. The caveat travels with the fact on
// purpose: quoting the free companion ticket without saying which proof is
// accepted would set a traveller up to be turned away at the desk.
function serviceCatalogue(): string {
  return SERVICES.map((s) => {
    const bits = [
      `reach:${s.reach}`,
      `when:${s.availability}`,
      `cost:${s.cost}`,
      `why:${s.whyItMatters}`,
      `caveat:${s.caveat}`,
      `official:${s.officialUrl}`,
      `checked:${s.lastVerified}`,
    ];
    return `  "${s.id}" [${s.category}] ${s.nameEn} (${s.nameFr}): ${bits.join("; ")}`;
  }).join("\n");
}


/**
 * The operator's own accessibility register for the stops on our routes.
 *
 * Read live from Ile-de-France Mobilites at request time, so the assistant can
 * cite the register rather than our summary of it. The interesting part is where
 * the two disagree: our note may say a lift exists, and the register may still
 * class the station as reachable only with a booking made days ahead. Both
 * belong in the answer.
 */
function officialCatalogue(facts: NetworkFacts | null): string {
  if (!facts) {
    return "  (the operator's register could not be reached for this reply: say that rather than guessing a station's class)";
  }
  const stops = Array.from(new Set(ROUTES.flatMap((r) => r.nodes.map((n) => n.name))));
  return stops
    .map((name) => {
      const record = findStation(facts, name);
      const wc = toiletsAt(facts, name);
      const bits: string[] = [];
      if (record) {
        bits.push(`official-class:"${ACCESS_LEVELS[record.level]?.en ?? record.levelFr}"`);
        bits.push(`official-wording-fr:"${record.levelFr}"`);
        if (record.note) bits.push(`per-line-note:"${record.note}"`);
      } else {
        bits.push("official-class:not-listed (their register covers RER and rail, not the metro)");
      }
      for (const w of wc) {
        const where = [w.free === null ? null : w.free ? "free" : "paid", w.insideGates === null ? null : w.insideGates ? "inside the gates" : "outside the gates"]
          .filter(Boolean)
          .join(", ");
        bits.push(`accessible-toilet:"line ${w.line}${where ? ", " + where : ""}${w.where ? ". " + w.where : ""}"`);
      }
      return `  - ${name}: ${bits.join(", ")}`;
    })
    .join("\n");
}

/**
 * The route this question is about, computed before the model is called.
 *
 * Without it the model emitted its routing marker and then wrote prose about a
 * journey it had never seen, which is how a sentence like "the timetable includes
 * lift data for every station" gets said out loud. It does not. Now the search
 * runs first and the model is handed the result, so its prose can only describe
 * what is actually on the card.
 */
function computedRoute(text: string, profile: string | null): string {
  const ends = mentionedEndpoints(text);
  if (!ends) return "";
  const who = (PROFILE_IDS.includes(profile ?? "") ? profile : "wheelchair") as ProfileId;
  const result = plan(ends.from, ends.to, who);
  if (!result.ok) {
    return `\nThe app tried to route ${ends.fromLabel} to ${ends.toLabel} for a ${who} traveller and could not: ${result.reason}. Say that plainly, and do not invent a line or a station. If the reason is no_route, the published metro, tram, RER and Transilien timetable has no connection between them and a bus might, which this app does not rate.\n`;
  }
  const r = result.route;
  const legs = r.nodes
    .map((n, i) => {
      const bits = [n.name, `access:${n.at}`, `record:"${n.atText.en}"`];
      if (n.line) bits.unshift(`ride ${n.line.label}`);
      if (n.into) bits.push(`leg:"${n.into.text.en}"`);
      return `    ${i + 1}. ${bits.join(", ")}`;
    })
    .join("\n");
  return `\nThe app has ALREADY computed this journey for this question, from Ile-de-France Mobilites' published timetable, weighted for a ${who} traveller. This is the route the card next to your reply shows:
  ${r.from} -> ${r.to}: ${r.minutes} minutes, ${r.changes} change(s), ${r.stops} stops
${legs}
  stations marked inaccessible by the operator: ${r.barriers.length ? r.barriers.join(", ") : "none"}
  stations with nothing published either way: ${r.unknowns.length ? r.unknowns.join(", ") : "none"}

Put [[plan:${ends.fromLabel}|${ends.toLabel}]] on its own line first, then describe THIS route: the lines it rides, the change and what the operator says about that station, and the one thing to watch. Every line number, station and figure you state comes from the block above and nowhere else. Do not claim the timetable carries lift data for every station. It does not carry lift status at all, and it carries an accessibility class for ${COVERAGE.withClass} of ${COVERAGE.stations} stations and nothing for the rest, which is why some stops above say unknown.\n`;
}

/**
 * What is on in Paris this week, from the city's own feed, with our station.
 *
 * Two claims per line and the prompt is told to keep them apart: the city's flag
 * is about the venue, ours is about the way in. The model is not asked to
 * reconcile them, because they are not in conflict: a hall with a ramp really can
 * sit above a station with a staircase, and that pairing is the answer.
 */
function eventCatalogue(feed: EventFeed | null): string {
  if (!feed || feed.events.length === 0) {
    return "Not available for this reply: the city's events feed did not answer. Say that there is no live listing right now rather than naming an event from memory.";
  }
  const j = joinCounts(feed.events);
  const lines = rank(feed.events)
    .slice(0, 12)
    .map((e) => {
      const city =
        e.access.wheelchair === "yes"
          ? "city says wheelchair accessible"
          : e.access.wheelchair === "no"
            ? "city says NOT wheelchair accessible"
            : "city published nothing about wheelchair access";
      const extra = [
        e.access.deaf === "yes" ? "deaf access" : null,
        e.access.blind === "yes" ? "blind access" : null,
        e.access.signLanguage === "yes" ? "sign language" : null,
      ].filter(Boolean);
      return `- ${e.title}${e.venue ? ` (${e.venue})` : ""}: ${e.free === true ? "free" : e.free === false ? "paid" : "price unknown"}, ${city}${
        extra.length ? `, ${extra.join(", ")}` : ""
      }. Nearest station for a wheelchair user: ${e.station.name} (line${e.station.lines.length > 1 ? "s" : ""} ${e.station.lines.join(", ")}), ${e.station.metres} m away, which the operator's data makes "${e.station.status}". Official page: ${e.url}`;
    })
    .join("\n");
  return `${feed.totals.onThisWeek} events are on in Paris this week in the city's feed. Of those it marks ${feed.totals.wheelchairYes} wheelchair accessible and ${feed.totals.wheelchairNo} not; the rest say nothing. Of the ${feed.events.length} this app is holding, ${j.cityAccessible} are marked accessible, and joining them to the transport register: ${j.stationStepFree} have a step-free station, ${j.stationConditional} a station that needs a booking or a member of staff, ${j.stationBarrier} a station with stairs.

${lines}`;
}

function systemPrompt(
  profile: string | null,
  weather: string | null,
  facts: NetworkFacts | null,
  events: EventFeed | null,
  routeBlock: string,
): string {
  return `You are Voie Libre, a Paris step-free travel and sightseeing assistant. You help travellers who cannot take stairs (wheelchair users, people with strollers, older or low-energy travellers) get across Paris and plan accessible visits to its main sights.

How Voie Libre works (facts, not rules to recite):
- Only Metro Line 14 is fully step-free. Counted from the operator's own register across the ${COVERAGE.stations} stations in the timetable: ${COVERAGE.autonomous} can be used with no help at all, ${COVERAGE.conditional} only with a booking or a member of staff, ${COVERAGE.notAccessible} are marked not accessible, and ${COVERAGE.silent} have nothing published anywhere.
- There are two things Voie Libre cannot tell anyone, and both are said plainly rather than filled in. Whether a specific lift is working right now: that dataset exists, 944 lifts, but it is licensed and needs a token we do not have. And RER C through Paris: the open timetable has no trains on that branch at all, so the Eiffel Tower has no step-free station near it that we can see, and a journey there ends in a walk we state in metres and minutes rather than a line drawn to the tower.
- Unknown accessibility data is shown as "unknown"; an honest gap beats a guessed step count, lift status, or route.
- When a lift is out of service, the reply gives a step-free alternative: a level-boarding bus, another line, or a different station.
${profile ? `\nThe traveller's mobility profile is: ${profile}. Weigh the route against this profile (a stroller user cares most about step count and gaps; a wheelchair user needs a working lift at every change; a low-energy traveller cares most about total walking distance).` : ""}${weather ? `\nCurrent weather you may use for a weather-aware suggestion: ${weather} If it is raining and the traveller's plan is outdoors, you may suggest a step-free indoor option that is on or near the route, but do not invent opening hours or specifics.` : ""}

Your reasoning is shown to the traveller, so it stays about this specific trip: which lifts are working or unknown, how many steps each leg has, the walking distance, and how it fits the profile. It weighs the trip itself rather than restating these notes or planning the wording of the reply.

You can route any journey across the network. When the traveller asks how to get from somewhere to somewhere, put a routing marker on its own line EARLY in your reply, before the prose, in exactly this form: [[plan:START|DESTINATION]]. Use station names or the names of places in the knowledge base, for example [[plan:Bastille|Eiffel Tower]]. The app answers that marker by searching Ile-de-France Mobilites' published timetable for ${NETWORK_META.stations} stations on ${NETWORK_META.lines} metro, tram, RER and Transilien lines, weighted for the traveller's profile, and renders the result as a card with the accessibility of every change. When the app has already computed the journey, its lines, changes and per-station accessibility are given to you at the end of this prompt, and your prose describes exactly those. When no computed journey is given, you do not know the lines or the times, so you do not state them: the card does that, and inventing a line number is the one thing that would make this product useless. Your prose says why the route suits this traveller and what to watch for.

Three journeys were walked in person by the team, which is data no timetable carries (a specific broken lift, the corridor that has no ramp, the way around it):
${routeCatalogue()}

For those three exact pairs, prefer the field-surveyed marker instead: ${ROUTE_IDS.map((id) => `[[route:${id}]]`).join(
    ", "
  )}, with the profile appended when you know it, e.g. [[route:gdl-eiffel:wheelchair]]. For everything else use [[plan:...]].

If a route cannot be computed, the card says so on its own. Never fill the gap with a guessed line or station.

Ile-de-France Mobilites' own accessibility register for the stops above, read live from their open data for this reply:
${officialCatalogue(facts)}

This is the operator's claim, not ours, and it is worth more than ours when the two differ, so name whose claim it is. "Accessible only with a booking made in advance" is not the same as accessible, and a traveller who is told only the second half plans a trip they cannot take: the booking, or the request to a member of staff, goes in the same sentence as the class. Where the register qualifies a station line by line, that qualification is the useful part. A station missing from the register is not "accessible": their register covers RER and rail rather than the metro, and absence means nobody published a class.

You also have this referenced knowledge base of Paris attractions (verified 2026-07-23; budgets are the adult entry cost in euros; some values are estimates and are marked as such; unknowns are honest):
${placeCatalogue()}

It answers questions about attractions: entry cost and budget, how long a visit takes, opening hours, wheelchair access, and the official site for tickets. Prices, opening times and accessibility facts come only from this data; anything missing is "unknown" or a pointer to the official site. A place marked CLOSED is never recommended; if asked, it is closed for works and an open alternative is offered. Named attractions keep the accessibility lens (their step-free or wheelchair situation).

You also have this small set of practical services, which are reached by phone or claimed as an entitlement rather than travelled to (read off official sources 2026-07-26):
${serviceCatalogue()}

These answer the practical questions around a trip rather than the sightseeing: what to do in an emergency, how to reach the official transport accessibility line, whether a companion gets in free. Two rules when you use them. Always state the caveat in the same breath as the fact, because every one of these has a condition that decides whether it actually applies to a foreign visitor. And for anyone who cannot make a voice call, 114 is the emergency route to give, not 112.

You also have what is actually on in Paris this week, read live from the city's own open data (Que Faire à Paris, Ville de Paris, ODbL) for this reply:
${eventCatalogue(events)}

Use it whenever somebody asks what to do, what is on, what is worth seeing this week, or asks for something free. Two rules, and they are the whole reason this listing is here. The city's flag describes the venue and ours describes the journey, so they are quoted as two separate claims with the owner named: "the city marks this accessible, and the nearest station is one the operator says needs a member of staff". Never merge them into one verdict. And an event the city says nothing about is offered as exactly that, not as accessible: most of this feed is silent, and silence is the honest answer rather than a reason to leave the event out. Never name an event that is not in this list, and never invent a date, a price or a venue for one that is. The line numbers for a station come from this list too, never from memory. And the distance from the station to the venue is the only thing known about that walk: nobody here has surveyed the pavement or the gradient, so it is given in metres and never described as flat, easy, or a gentle roll.

An entitlement is never quoted without the condition attached to it. Free entry for a disabled visitor and a companion is real at several of these sites, and at every one of them it depends on something: a supporting document at the desk, a timeslot booked in advance, a particular entrance. That condition is stated in the same sentence as the entitlement, because a traveller who is told only the good half gets turned away at the desk.

Every price or opening time you state is traceable: name the date it was checked (the "checked" field) and link the official site (the "official" field) as a markdown link, so the traveller can confirm it before they travel. When a value is an estimate, unverified or unknown, say so in the same breath and send them to the official site rather than presenting it as fact. Booking and prices change; the official site is always the authority.

For an itinerary request (a day plan, "what should I see", or several sights at once), build an ordered step-free plan: pick 2 to 4 attractions from the knowledge base that suit the profile, favouring step-free or working-lift sites for a wheelchair user. Give each stop its entry budget, how long to spend, opening hours and its step-free situation, then connect the stops with step-free transit or a level walk. Close with an approximate total budget and total time. Connect two consecutive stops with a [[plan:A|B]] marker, or with a [[route:id]] marker when the pair is one of the three walked routes.

Always end your reply with a one-line verdict on its own line, separated from the paragraph above by a blank line, so the key takeaway stands out. Begin that line with "Bottom line:" in English, "En bref :" in French, or "结论：" in Chinese, then one short sentence: whether the trip is step-free and the single most important action (for example the step-free way around a broken lift).

Replies are in the language the traveller writes in (English, French, or Chinese), which is decided by the words they typed and nothing else. A traveller who writes in English is answered in English even when they mention that they are visiting from China or Japan, because where someone is from is not the language they chose to ask in.

Replies are concise, warm, practical, free of emoji, and punctuated with commas and full stops rather than dashes.
${routeBlock}`;
}

export async function POST(req: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Say when to come back rather than only that the door is shut: a 429 with no
  // Retry-After leaves both a person and a well-behaved client guessing.
  const wait = rateLimited(clientIp(req));
  if (wait > 0) {
    return new Response(JSON.stringify({ error: "rate_limited", retryAfter: wait }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(wait) },
    });
  }

  // Reject oversized bodies before buffering/parsing them (unauthenticated DoS).
  const declaredLen = Number(req.headers.get("content-length") || 0);
  if (declaredLen > 64_000) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: ChatMessage[];
  let profile: string | null = null;
  try {
    const body = await req.json();
    // Strict validation: slice the raw array FIRST so filtering never iterates an
    // attacker-sized array, then keep only user/assistant string turns (dropping any
    // injected system role) and cap history + per-message size to bound token cost.
    messages = (Array.isArray(body.messages) ? body.messages.slice(-40) : [])
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
          typeof (m as ChatMessage).content === "string"
      )
      .slice(-20)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (typeof body.profile === "string" && PROFILE_IDS.includes(body.profile)) profile = body.profile;
  } catch {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "no messages" }), { status: 400 });
  }

  // All three are fetched in parallel and all three fail open: an answer without
  // the weather, without the operator's register or without this week's listing
  // is still a useful answer, and the prompt says which one is missing rather
  // than filling the hole.
  const [weather, facts, events] = await Promise.all([
    currentWeather(),
    networkFacts(),
    cityEvents(),
  ]);

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const payload = [
    { role: "system", content: systemPrompt(profile, weather, facts, events, computedRoute(lastUser, profile)) },
    ...messages,
  ];

  // The timeout covers reaching the model, not reading from it. A single signal
  // passed to fetch would stay armed while the answer streams and cut a long one
  // off mid-sentence, so the timer is cleared the moment the headers land. This
  // matters because a stalled connection is the one upstream failure the model
  // fallback below could not see: a retired id answers 400 and falls through in
  // milliseconds, but a hang would sit there until the function's own 60s
  // deadline killed the request, and the traveller would get nothing at all.
  const CONNECT_TIMEOUT_MS = 20_000;
  async function callModel(model: string) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONNECT_TIMEOUT_MS);
    try {
      return await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        // The input is capped above; this caps the output. Without it a single
        // request can spend an unbounded amount on the key, and the answers this
        // product gives are a few paragraphs, never a thousand of them.
        body: JSON.stringify({ model, stream: true, messages: payload, max_tokens: 2000 }),
        signal: ctrl.signal,
      });
    } catch {
      // A refused, timed-out or aborted connection is reported the same way an
      // HTTP error is, so the caller's fallback loop handles both alike.
      return new Response(null, { status: 504 });
    } finally {
      clearTimeout(timer);
    }
  }

  // The reasoning model is what makes the visible chain-of-thought possible, so
  // it is the first choice. A retired model id answers 400, not 5xx, which is
  // silent until someone tries to chat: fall through to the next id on any
  // failure rather than only on overload.
  let upstream = await callModel(MODELS[0]);
  for (let i = 1; i < MODELS.length && (!upstream.ok || !upstream.body); i++) {
    // Let go of the failed attempt's body, otherwise its socket stays open for
    // the rest of the function's life while nobody ever reads it.
    upstream.body?.cancel().catch(() => {});
    upstream = await callModel(MODELS[i]);
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `upstream ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      upstreamReader = reader;
      let buffer = "";
      // The moment the traveller presses Stop this stream is torn down, and every
      // enqueue after that throws. Swallowing it here keeps the failure from
      // escaping start() as an unhandled rejection that takes the request with it.
      let gone = false;
      const push = (obj: unknown) => {
        if (gone) return;
        try {
          controller.enqueue(send(obj));
        } catch {
          gone = true;
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              // An in-band error object (quota/balance/policy) arrives as HTTP 200
              // then a JSON error line; surface it instead of swallowing it.
              if (json.error) {
                push({ type: "error", text: "stream interrupted" });
                continue;
              }
              const delta = json.choices?.[0]?.delta ?? {};
              if (delta.reasoning_content) {
                push({ type: "reasoning", text: delta.reasoning_content });
              }
              if (delta.content) {
                push({ type: "content", text: delta.content });
              }
            } catch {
              // ignore malformed keep-alive lines
            }
          }
        }
      } catch {
        push({ type: "error", text: "stream interrupted" });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by a traveller who walked away mid-answer
        }
        reader.cancel().catch(() => {});
      }
    },
    cancel() {
      // Stop pressed, or the tab closed: hang up on DeepSeek rather than keep
      // paying for an answer nobody is going to read.
      upstreamReader?.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
