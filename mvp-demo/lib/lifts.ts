import { stationKey } from "./idfm";

/**
 * Live lift state: which lifts Île-de-France Mobilités says are broken right now.
 *
 * `etat-des-ascenseurs` holds 944 lifts, each with a status, a reason, where in
 * the station it sits, and the minute the operator last touched it. It is
 * published under Licence Mobilité rather than Licence Ouverte, so unauthenticated
 * requests answer `403 ForbiddenAccess`. That was this project's one real hole for
 * most of the week and the interface said so out loud; it is now read for real.
 *
 * Three things about this file are deliberate.
 *
 * **The token is the DATASET one, not the API one.** PRIM issues two, on two tabs
 * of the same page, and they are not interchangeable. The API token is for the
 * marketplace webservices and sends `apiKey` as a header; against this endpoint it
 * answers 403. The dataset token is the one that reads restricted datasets, and it
 * goes in `Authorization: Apikey <token>`. Both were tried against a real request
 * before this line was written, because guessing which of two credentials a
 * 403/401 refers to is how a working integration gets called broken.
 *
 * **The status map holds only values seen in real records.** Inventing an enum
 * from a plausible-looking English word is how a product ends up telling a
 * wheelchair user a lift works when the feed said something else. Every value in
 * `VERIFIED_STATUSES` was counted in a live response, with the date; anything else
 * stays `unknown` and the operator's own wording is carried through verbatim.
 *
 * **It joins on geography, not on ids.** `zdcid` is a zone-de-correspondance id
 * and does not match a GTFS station id, and matching French stop names by
 * containment puts one station's platforms under another. Same trap the platform
 * register hit; same fix: distance plus a normalised name.
 */

/** One call returns all 944 rows, where `/records` caps at 100 and would need ten.
 *  Fewer calls is the whole reason to prefer it: this endpoint's quota is not
 *  documented anywhere we have read, so the safe move is to need it once. */
const EXPORT =
  "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/etat-des-ascenseurs/exports/json";

/** Server-side only, and sent as a header, so the token never appears in a URL,
 *  a log line, or anything returned to a caller. */
const TOKEN = process.env.IDFM_DATASET_TOKEN ?? "";

/** A lift moves in minutes, not days. The operator's own metadata claims a daily
 *  update and its own `liftstateupdate` stamps disagree with it: on a single
 *  response they ranged over the same evening, many within the last few minutes.
 *  Ten minutes follows the data rather than the metadata, and one refresh is one
 *  upstream call. */
const CACHE_MS = 10 * 60 * 1000;

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
  /** Why, when the feed says. Real values seen: `liftFailure`,
   *  `undefinedEquipmentProblem`. The feed also uses the literal string "/" for
   *  "no reason given", which is normalised away here rather than shown to a
   *  traveller as a reason. */
  reason: string | null;
  /** Where in the station, when the feed says, in the operator's own French:
   *  "Salle d'accès <> Quai", "Passerelle <> Quais C / D". Not translated, because
   *  it is the wording on the signs. */
  situation: string | null;
  /** Which way it runs, when the feed says ("Sortie Uniquement", "Montée et descente"). */
  direction: string | null;
  /** The mode of the station this lift serves: Metro, RapidTransit, LocalTrain, Tram. */
  mode: string | null;
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
 * Counted on 2026-07-27 by grouping the live feed on `liftstatus`, not read off a
 * documentation page: 734 `available`, 64 `notavailable`, 136 `unknown`, and 10
 * rows where the field is null. The operator's own third value is `unknown`, which
 * is why it is absent from this map rather than mapped to anything: when the feed
 * says it does not know, we say we do not know, and 136 of 944 lifts are in that
 * state right now.
 */
const VERIFIED_STATUSES: Record<string, "working" | "out"> = {
  available: "working", // observed 2026-07-27 in 734 records
  notavailable: "out", // observed 2026-07-27 in 64 records
};

function classify(raw: string): "working" | "out" | "unknown" {
  const hit = VERIFIED_STATUSES[raw.trim().toLowerCase()];
  return hit ?? "unknown";
}

/** The feed writes "/" where there is no reason, which is not a reason. */
function reasonOf(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s !== "/" ? s : null;
}

let cache: { at: number; feed: LiftFeed } | null = null;

/** True when a token is configured, so callers can explain the absence rather
 *  than showing an empty list that reads like good news. */
export function liftsConfigured(): boolean {
  return TOKEN.length > 0;
}

async function fetchAll(): Promise<Record<string, unknown>[]> {
  const url = new URL(EXPORT);
  url.searchParams.set(
    "select",
    "zdcid,zdcname,centroidzdc,liftid,liftstatus,liftreason,liftsituation,liftdirection,liftmode,liftstateupdate",
  );

  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Apikey ${TOKEN}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`etat-des-ascenseurs returned ${res.status}`);
  // `/exports/json` returns the array itself, where `/records` wraps it in
  // `{ results }`. Both shapes are accepted so a change upstream degrades to an
  // empty feed rather than a crash.
  const body = (await res.json()) as unknown;
  const rows = Array.isArray(body) ? body : ((body as { results?: unknown[] }).results ?? []);
  return rows as Record<string, unknown>[];
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
    const rows = await fetchAll();

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
        reason: reasonOf(row.liftreason),
        situation: str(row.liftsituation),
        direction: str(row.liftdirection),
        mode: str(row.liftmode),
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

/**
 * The counts, computed once so that the endpoint, the page and the model's prompt
 * all quote the same four numbers.
 *
 * `out` is the number worth saying out loud: it is a live count of lifts the
 * operator itself reports broken, and it is the one thing on this site that could
 * be different in ten minutes.
 */
export function liftCounts(feed: LiftFeed): {
  total: number;
  working: number;
  out: number;
  unknown: number;
} {
  let working = 0;
  let out = 0;
  let unknown = 0;
  for (const l of feed.lifts) {
    if (l.status === "working") working++;
    else if (l.status === "out") out++;
    else unknown++;
  }
  return { total: feed.lifts.length, working, out, unknown };
}

/** The broken ones, worst-labelled first and then by station, for a list a human
 *  reads top-down. */
export function liftsOut(feed: LiftFeed): LiftState[] {
  return feed.lifts
    .filter((l) => l.status === "out")
    .sort((a, b) => a.station.localeCompare(b.station, "fr") || a.liftId.localeCompare(b.liftId));
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
