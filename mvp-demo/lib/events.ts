import { stationForPoint } from "./router";
import type { Status } from "./data";

/**
 * What is on in Paris this week, from the city's own open data.
 *
 * "Que Faire à Paris" publishes an accessibility flag per event: `pmr` for
 * wheelchair users, plus `blind`, `deaf` and `sign_language`. That is the city
 * describing the *venue*. This app describes the *journey*. Those are two
 * different claims and this file keeps them apart on purpose, because joining
 * them is the entire point of the product: the city marks a guided walk of
 * Montmartre as wheelchair accessible, and it starts at the exit of a métro
 * station whose platforms the operator marks not accessible. Both records are
 * true. Only a traveller who sees them together learns anything.
 *
 * The flag is 1, 0, or absent, and absent is the most common answer. It stays
 * `unknown` here. Reading a missing flag as "not accessible" would slander a
 * venue; reading it as "accessible" would strand somebody. Of the events on in
 * the next seven days, roughly 350 say yes and about a dozen say no, so most of
 * this dataset is silence and the interface has to show that.
 */

const DATASET = "que-faire-a-paris-";
const BASE = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/${DATASET}/records`;

export const EVENT_SOURCE = {
  id: DATASET,
  title: "Que Faire à Paris",
  licence: "Licence ODbL",
  url: "https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/",
  publisher: "Ville de Paris",
} as const;

/** What the city published, with absence kept as absence. */
export type Flag = "yes" | "no" | "unknown";

export interface CityEvent {
  id: string;
  title: string;
  /** The city's own page, so a reader can check the claim at the source. */
  url: string;
  venue: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  free: boolean | null;
  /** The city's flags. About the venue, never about getting there. */
  access: { wheelchair: Flag; blind: Flag; deaf: Flag; signLanguage: Flag };
  /** Ours, from the operator's data: the station this traveller would use. */
  station: { id: string; name: string; lines: string[]; status: Status; metres: number };
}

export interface EventFeed {
  fetchedAt: string;
  events: CityEvent[];
  /** True totals from the API, not counts of the page we happen to hold. */
  totals: { onThisWeek: number; wheelchairYes: number; wheelchairNo: number; free: number };
}

const CACHE_MS = 6 * 60 * 60 * 1000;
const PAGE = 100;
const PAGES = 4;
let cache: { at: number; feed: EventFeed } | null = null;

/** Events on now or starting within the week, which is the question a visitor asks. */
const WINDOW = "date_end >= now() and date_start <= now(days=7)";
const WITH_COORDS = `${WINDOW} and lat_lon is not null`;

function flag(v: unknown): Flag {
  if (v === 1 || v === "1" || v === true) return "yes";
  if (v === 0 || v === "0" || v === false) return "no";
  return "unknown";
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  // Same rule as the operator's datasets: a slow public CDN must not hold a page
  // open. A failure here means the listing is absent and says so.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "voie-libre/1.0 (summer school project)",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function count(where: string): Promise<number> {
  const url = `${BASE}?limit=0&where=${encodeURIComponent(where)}`;
  return fetchJson(url).then((d) => (typeof d?.total_count === "number" ? d.total_count : 0));
}

interface Row {
  event_id?: unknown;
  id?: unknown;
  title?: unknown;
  url?: unknown;
  address_name?: unknown;
  address_zipcode?: unknown;
  lat_lon?: { lat?: unknown; lon?: unknown } | null;
  date_start?: unknown;
  date_end?: unknown;
  price_type?: unknown;
  pmr?: unknown;
  blind?: unknown;
  deaf?: unknown;
  sign_language?: unknown;
}

function normalise(r: Row): CityEvent | null {
  const lat = Number(r.lat_lon?.lat);
  const lng = Number(r.lat_lon?.lon);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const url = typeof r.url === "string" ? r.url : "";
  if (!title || !url || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const price = typeof r.price_type === "string" ? r.price_type.toLowerCase() : "";
  return {
    id: String(r.event_id ?? r.id ?? url),
    title,
    url,
    venue: typeof r.address_name === "string" && r.address_name.trim() ? r.address_name.trim() : null,
    postcode: typeof r.address_zipcode === "string" ? r.address_zipcode : null,
    lat,
    lng,
    startsAt: typeof r.date_start === "string" ? r.date_start : "",
    endsAt: typeof r.date_end === "string" ? r.date_end : "",
    free: price === "gratuit" ? true : price === "payant" ? false : null,
    access: {
      wheelchair: flag(r.pmr),
      blind: flag(r.blind),
      deaf: flag(r.deaf),
      signLanguage: flag(r.sign_language),
    },
    // The wheelchair profile on purpose: this listing exists to answer whether
    // the hardest journey is possible. A card that says "not accessible" for a
    // wheelchair is still useful to everybody else; the reverse is not.
    station: stationForPoint(lat, lng, "wheelchair"),
  };
}

/**
 * The week's events, cached for six hours.
 *
 * The dataset holds more than this app fetches, so the totals are asked for
 * separately rather than counted from the four pages held. A listing that says
 * "349 events this week say they are wheelchair accessible" while holding 400
 * rows must have got that number from the source, not from its own slice.
 */
export async function cityEvents(): Promise<EventFeed | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.feed;

  const select = [
    "event_id", "title", "url", "address_name", "address_zipcode", "lat_lon",
    "date_start", "date_end", "price_type", "pmr", "blind", "deaf", "sign_language",
  ].join(",");

  const [pages, onThisWeek, wheelchairYes, wheelchairNo, free] = await Promise.all([
    Promise.all(
      Array.from({ length: PAGES }, (_, i) =>
        fetchJson(
          `${BASE}?limit=${PAGE}&offset=${i * PAGE}&order_by=date_start` +
            `&select=${select}&where=${encodeURIComponent(WITH_COORDS)}`,
        ),
      ),
    ),
    count(WINDOW),
    count(`${WINDOW} and pmr = 1`),
    count(`${WINDOW} and pmr = 0`),
    count(`${WINDOW} and price_type = 'gratuit'`),
  ]);

  const events: CityEvent[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const rows = Array.isArray(page?.results) ? (page.results as Row[]) : [];
    for (const row of rows) {
      const e = normalise(row);
      // The same exhibition is published once per occurrence, so a listing that
      // does not dedupe shows one museum eight times and looks broken.
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        events.push(e);
      }
    }
  }

  // Nothing arrived: keep what is cached rather than replacing a real listing
  // with an empty one, and let the caller report the absence.
  if (events.length === 0) return cache?.feed ?? null;

  const feed: EventFeed = {
    fetchedAt: new Date().toISOString(),
    events,
    totals: { onThisWeek, wheelchairYes, wheelchairNo, free },
  };
  cache = { at: now, feed };
  return feed;
}

/**
 * The events worth putting in front of somebody, hardest constraint first.
 *
 * Ordered by what the city says, then by whether the station we would send them
 * to actually works, then by price. An event the city calls accessible whose
 * station is a barrier still ranks: that pairing is the thing this app exists to
 * show, and hiding it would be its own kind of dishonesty.
 */
export function rank(events: CityEvent[]): CityEvent[] {
  const cityRank: Record<Flag, number> = { yes: 0, unknown: 1, no: 2 };
  const stationRank: Partial<Record<Status, number>> = { ok: 0, lift: 0, conditional: 1, unknown: 2 };
  const sorted = [...events].sort((a, b) => {
    const c = cityRank[a.access.wheelchair] - cityRank[b.access.wheelchair];
    if (c) return c;
    const s = (stationRank[a.station.status] ?? 3) - (stationRank[b.station.status] ?? 3);
    if (s) return s;
    if (a.free !== b.free) return a.free ? -1 : 1;
    return a.startsAt.localeCompare(b.startsAt);
  });
  // The city publishes a municipal series once per arrondissement, so the same
  // sentence appears seventeen times and a listing that shows all of them looks
  // broken rather than thorough. One per series, the best-connected one first
  // because the sort already put it there.
  const seen = new Set<string>();
  return sorted.filter((e) => {
    const family = series(e.title);
    if (seen.has(family)) return false;
    seen.add(family);
    return true;
  });
}

/**
 * A repeated listing's identity, with the part that only names a district gone.
 *
 * Keyed on the ordinal wherever it falls rather than at the end of the string:
 * the titles read "dans le 12e arrondissement de Paris", and an end-anchored
 * pattern written from a truncated preview matched none of the seventeen.
 */
export function series(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b\d{1,2}\s*(er|ème|eme|e)\b/gu, " ")
    .replace(/\b(dans le|arrondissement|de paris)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The one number this product exists to produce.
 *
 * Neither dataset can state it alone. The city knows whether the venue is
 * accessible and nothing about the journey; the operator knows the station and
 * nothing about what is on. Joined, they say how many of this week's accessible
 * events a wheelchair user cannot actually reach step-free.
 */
export function joinCounts(events: CityEvent[]) {
  const yes = events.filter((e) => e.access.wheelchair === "yes");
  const reachable = yes.filter((e) => e.station.status === "ok" || e.station.status === "lift");
  const barrier = yes.filter((e) => e.station.status === "stairs" || e.station.status === "lift_down");
  return {
    cityAccessible: yes.length,
    stationStepFree: reachable.length,
    stationConditional: yes.filter((e) => e.station.status === "conditional").length,
    stationBarrier: barrier.length,
    stationUnknown: yes.filter((e) => e.station.status === "unknown").length,
    citySilent: events.filter((e) => e.access.wheelchair === "unknown").length,
  };
}
