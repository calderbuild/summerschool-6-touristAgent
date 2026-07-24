import { NextResponse } from "next/server";

// Live Paris weather for the UI. The chat route already feeds weather to the
// model in its prompt; this endpoint exposes the same open data (Open-Meteo, no
// key) to the browser so the value is visible, not hidden in the backend.
//
// Returns raw temperature + WMO code + a rain flag, and lets the client map the
// code to a translated label, so the chip stays trilingual. Cached module-scope
// for 10 minutes; a failure caches for 1 minute and returns 503 so the client
// can quietly hide the chip rather than show a broken one.
export const runtime = "nodejs";

type WeatherNow = { tempC: number; code: number; raining: boolean };

let cache: { data: WeatherNow | null; t: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.t < (cache.data ? 600_000 : 60_000)) {
    return NextResponse.json(cache.data, { status: cache.data ? 200 : 503 });
  }
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code,precipitation&timezone=Europe/Paris",
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) throw new Error("upstream");
    const j = await res.json();
    const c = j.current ?? {};
    // Guard the numeric fields so a malformed 200 never renders "NaN°".
    if (typeof c.temperature_2m !== "number" || Number.isNaN(c.temperature_2m) || typeof c.weather_code !== "number") {
      throw new Error("malformed");
    }
    const data: WeatherNow = {
      tempC: Math.round(c.temperature_2m),
      code: c.weather_code,
      raining: typeof c.precipitation === "number" && c.precipitation > 0,
    };
    cache = { data, t: now };
    return NextResponse.json(data);
  } catch {
    cache = { data: null, t: now };
    return NextResponse.json(null, { status: 503 });
  }
}
