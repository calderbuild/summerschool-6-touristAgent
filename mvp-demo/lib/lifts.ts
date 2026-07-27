import { stationKey } from "./idfm";

/**
 * Live lift state, the one thing this product has never been able to tell you.
 *
 * `etat-des-ascenseurs` on Île-de-France Mobilités' open-data platform holds 944
 * lifts with a per-lift status and the timestamp it was last updated. Its records
 * answer `403 ForbiddenAccess` unauthenticated because the dataset is published
 * under Licence Mobilité rather than Licence Ouverte, so it needs a token that is
 * free but has to be registered for by a person.
 *
 * Two things about this file are deliberate.
 *
 * **It does not know what a status means.** The field list is public even without
 * a token (`liftstatus`, `liftreason`, `liftstateupdate`, `zdcname`,
 * `centroidzdc`), but the *values* `liftstatus` takes are not, and inventing an
 * enum from a plausible-looking English word is exactly how a product ends up
 * telling a wheelchair user a lift works when the feed said something else. So
 * `VERIFIED_STATUSES` starts almost empty, every unrecognised value is shown to
 * the traveller verbatim as the operator's own words with our status left
 * `unknown`, and the map only grows once somebody has read real records.
 *
 * **It joins on geography, not on ids.** `zdcid` is a zone-de-correspondance id
 * and does not match a GTFS station id, and matching French stop names by
 * containment puts one station's platforms under another. Same trap the platform
 * register hit; same fix: distance plus a normalised name.
 */

const RECORDS =
  "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/etat-des-ascenseurs/records";

/** Server-side only. The platform's own OpenAPI spec declares its key as a query
 *  parameter (`apikey`, in: query), not a header, so it necessarily appears in
 *  the request URL. That is the operator's design, and it is survivable only
 *  because this module runs on the server: the token is never sent to a browser,
 *  never logged, and never included in anything returned to a caller. */
const TOKEN = process.env.IDFM_PRIM_TOKEN ?? "";

/** A lift moves in minutes, unlike an accessibility class, so the cache is short.
 *  The quota is the constraint: a PRIM token allows 5 requests a second and
 *  1,000 a day, and one page of this dataset is 100 rows, so a full refresh costs
 *  10 calls. Every four minutes is 3,600 calls a day, which would blow the quota;
 *  every fifteen minutes is 960 and fits with room for the rest of the app. */
const CACHE_MS = 15 * 60 * 1000;
const PAGE = 100;
const TOTAL_HINT = 944;

export interface LiftState {
  /** The operator's own station name for the zone this lift sits in. */
  station: string;
  lat: number | null;
  lng: number | null;
  liftId: string;
  /** The operator's raw status string, shown verbatim wherever we cannot classify it. */
  statusRaw: string;
  /** Only ever set from a value somebody has seen in real records. */
  status: "working" | "out" | "unknown";
  /** Why, when the feed says. */
  reason: string | null;
  /** Where in the station, when the feed says. */
  situation: string | null;
  /** The operator's own last-updated stamp for this lift. */
  updatedAt: string | null;
}

export interface LiftFeed {
  fetchedAt: string;
  /** False when no token is configured. The UI must say so rather than imply the
   *  lifts are all fine. */
  live: boolean;
  lifts: LiftState[];
  /** Every distinct `liftstatus` value seen in this response, so the first real
   *  fetch tells us what the enum actually is instead of us guessing it. */
  seenStatuses: Record<string, number>;
}

/**
 * Status values confirmed against real records.
 *
 * EMPTY ON PURPOSE. Nobody on this team has yet held a token and read a row, so
 * there is nothing here that could be verified, and a guess would be worse than
 * an admission. The moment a token exists, `GET /api/lifts` reports
 * `seenStatuses`; put the real values in here, with the date they were observed,
 * and only then will the app call a lift working or out.
 */
const VERIFIED_STATUSES: Record<string, "working" | "out"> = {
  // e.g. "Disponible": "working",   // observed YYYY-MM-DD in N records
};

function classify(raw: string): "working" | "out" | "unknown" {
  const hit = VERIFIED_STATUSES[raw.trim()];
  return hit ?? "unknown";
}

let cache: { at: number; feed: LiftFeed } | null = null;

/** True when a token is configured, so callers can explain the absence rather
 *  than showing an empty list that reads like good news. */
export function liftsConfigured(): boolean {
  return TOKEN.length > 0;
}

async function page(offset: number): Promise<Record<string, unknown>[]> {
  const url = new URL(RECORDS);
  url.searchParams.set("limit", String(PAGE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(
    "select",
    "zdcid,zdcname,centroidzdc,liftid,liftstatus,liftreason,liftsituation,liftstateupdate",
  );
  url.searchParams.set("apikey", TOKEN);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) {
    // Deliberately not including the URL: it carries the token.
    throw new Error(`etat-des-ascenseurs returned ${res.status}`);
  }
  const body = (await res.json()) as { results?: unknown[] };
  return (body.results ?? []) as Record<string, unknown>[];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * The whole feed, cached, and honest when it is not available.
 *
 * Returns `live: false` with no lifts when there is no token, which is the state
 * this project has been in all week and which the interface says out loud. A
 * fetch that fails keeps the previous good feed rather than replacing real states
 * with an empty list.
 */
export async function liftFeed(): Promise<LiftFeed> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.feed;

  if (!liftsConfigured()) {
    return { fetchedAt: new Date().toISOString(), live: false, lifts: [], seenStatuses: {} };
  }

  try {
    // One page past the known count, so a lift added tomorrow is not silently lost.
    const offsets = Array.from({ length: Math.ceil(TOTAL_HINT / PAGE) + 1 }, (_, i) => i * PAGE);
    const pages = await Promise.all(offsets.map(page));
    const rows = pages.flat();

    const lifts: LiftState[] = [];
    const seenStatuses: Record<string, number> = {};
    for (const row of rows) {
      const station = str(row.zdcname);
      const liftId = str(row.liftid) ?? str(row.zdcid);
      const statusRaw = str(row.liftstatus) ?? "";
      if (!station || !liftId) continue;
      if (statusRaw) seenStatuses[statusRaw] = (seenStatuses[statusRaw] ?? 0) + 1;

      const point = row.centroidzdc as { lat?: number; lon?: number } | null | undefined;
      lifts.push({
        station,
        lat: typeof point?.lat === "number" ? point.lat : null,
        lng: typeof point?.lon === "number" ? point.lon : null,
        liftId,
        statusRaw,
        status: classify(statusRaw),
        reason: str(row.liftreason),
        situation: str(row.liftsituation),
        updatedAt: str(row.liftstateupdate),
      });
    }

    if (lifts.length === 0) return cache?.feed ?? { fetchedAt: new Date().toISOString(), live: false, lifts: [], seenStatuses: {} };

    const feed: LiftFeed = { fetchedAt: new Date().toISOString(), live: true, lifts, seenStatuses };
    cache = { at: now, feed };
    return feed;
  } catch {
    // Fail open, and keep saying what we last actually knew.
    return cache?.feed ?? { fetchedAt: new Date().toISOString(), live: false, lifts: [], seenStatuses: {} };
  }
}

const MATCH_M = 250;

function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const m = ((aLat + bLat) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(m);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

/**
 * The lifts at one of our stations.
 *
 * Both conditions are required, for the reason in the file header: a name alone
 * matches the wrong station, and a coordinate alone matches the station across
 * the street. A station with no lifts in the feed returns an empty array, which
 * means "the feed does not list a lift here", not "there is no lift".
 */
export function liftsAt(
  feed: LiftFeed | null,
  station: { name: string; lat: number; lng: number },
): LiftState[] {
  if (!feed || !feed.live) return [];
  const key = stationKey(station.name);
  return feed.lifts.filter((l) => {
    if (l.lat === null || l.lng === null) return false;
    if (metres(station.lat, station.lng, l.lat, l.lng) > MATCH_M) return false;
    const lk = stationKey(l.station);
    return lk === key || lk.startsWith(key) || key.startsWith(lk);
  });
}
