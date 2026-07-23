import { ROUTES, PROFILES } from "@/lib/data";

// DeepSeek key is server-side only; the browser never sees it.
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const ROUTE_IDS = ROUTES.map((r) => r.id);
const PROFILE_IDS = PROFILES.map((p) => p.id) as string[];

// ---- Abuse guard: best-effort per-IP fixed window (per warm instance) --------
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
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

function rateLimited(ip: string): boolean {
  const now = Date.now();
  // Sweep expired buckets so the map cannot grow unbounded under IP churn/spoofing.
  if (HITS.size > 2000) {
    for (const [k, v] of HITS) if (now - v.t >= WINDOW_MS) HITS.delete(k);
    if (HITS.size > 20000) HITS.clear(); // hard backstop
  }
  const w = HITS.get(ip);
  if (w && now - w.t < WINDOW_MS) {
    if (w.n >= MAX_PER_WINDOW) return true;
    w.n++;
    return false;
  }
  HITS.set(ip, { n: 1, t: now });
  return false;
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

function systemPrompt(profile: string | null, weather: string | null): string {
  return `You are Voie Libre, a Paris step-free travel assistant. You help travellers who cannot take stairs (wheelchair users, people with strollers, older or low-energy travellers) get across Paris.

Facts you must respect:
- Only Metro Line 14 is fully step-free. About 30 of 300+ stations have a working lift.
- Lift statuses are "as of this morning", not a live push feed. Never claim real-time.
- When accessibility data is unknown, say "unknown". Never invent a step count, a lift status, or a route. An honest gap is more useful than a wrong figure.
- When a lift is out of service, always offer the step-free alternative (a level-boarding bus, another line, or a different station).
${profile ? `\nThe traveller's mobility profile is: ${profile}. Weigh the route against this profile (a stroller user cares most about step count and gaps; a wheelchair user needs a working lift at every change; a low-energy traveller cares most about total walking distance).` : ""}${weather ? `\nCurrent weather you may use for a weather-aware suggestion: ${weather} If it is raining and the traveller's plan is outdoors, you may suggest a step-free indoor option that is on or near the route, but do not invent opening hours or specifics.` : ""}

Before answering, think step by step in your reasoning about: which lifts are working or unknown, how many steps each leg has, and how the route fits this traveller's profile. This reasoning is shown to the user, so make it about accessibility trade-offs, not filler.

You have these prepared routes with verified demo data:
${routeCatalogue()}

When the traveller's need matches one of these routes, put the marker on its own line EARLY in your reply, before the prose, using exactly one of these ids: ${ROUTE_IDS.map((id) => `[[route:${id}]]`).join(
    ", "
  )}. If you know the traveller's profile, append it: e.g. [[route:gdl-eiffel:wheelchair]]. The app renders that marker as a visual card with the step-by-step accessibility spine, so you do not need to repeat every leg in prose. Then briefly explain why you chose it and call out the main barrier and the step-free alternative. Keep the prose short.

If the request does not match a prepared route, answer helpfully in the same spirit (step-free thinking, honest about unknowns) without inventing specific station data.

Reply in the same language the traveller writes in (English, French, or Chinese). Be concise, warm, and practical. Do not use emojis.`;
}

export async function POST(req: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (rateLimited(clientIp(req))) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
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

  const weather = await currentWeather();

  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      stream: true,
      messages: [{ role: "system", content: systemPrompt(profile, weather) }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `upstream ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
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
                controller.enqueue(send({ type: "error", text: "stream interrupted" }));
                continue;
              }
              const delta = json.choices?.[0]?.delta ?? {};
              if (delta.reasoning_content) {
                controller.enqueue(send({ type: "reasoning", text: delta.reasoning_content }));
              }
              if (delta.content) {
                controller.enqueue(send({ type: "content", text: delta.content }));
              }
            } catch {
              // ignore malformed keep-alive lines
            }
          }
        }
      } catch {
        controller.enqueue(send({ type: "error", text: "stream interrupted" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
