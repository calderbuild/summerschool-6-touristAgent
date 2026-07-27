import type { Lang } from "./i18n";

/**
 * The transport operator's own accessibility record, fetched at runtime.
 *
 * Everything else in this app that talks about a station was written by us and
 * checked by hand. That is defensible for a dozen places, and it is exactly what
 * a jury should not have to take on trust for a network of 459 stations. These
 * two datasets are Île-de-France Mobilités' own published record, open licence,
 * no registration, and they are read live rather than copied into the repo so
 * the page cannot quietly drift away from the source.
 *
 * What is deliberately NOT here: live lift status. The dataset exists
 * (`etat-des-ascenseurs`, 944 lifts, with a per-lift `liftstateupdate`), but it
 * is published under Licence Mobilité and its records answer ForbiddenAccess
 * without a PRIM token. So this file gives the accessibility class of a station
 * and whether it has a toilet somebody in a wheelchair can use, and the app
 * keeps saying out loud that a working-right-now lift is the thing it cannot
 * tell you.
 */

const BASE = "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets";

export const SOURCES = {
  stations: {
    id: "accessibilite-en-gare",
    title: "Accessibilité en gare",
    licence: "Licence Ouverte v2.0 (Etalab)",
    url: "https://data.iledefrance-mobilites.fr/explore/dataset/accessibilite-en-gare/",
  },
  toilets: {
    id: "sanitaires-reseau-ratp",
    title: "Toilettes publiques dans le réseau RATP",
    licence: "Licence ODbL",
    url: "https://data.iledefrance-mobilites.fr/explore/dataset/sanitaires-reseau-ratp/",
  },
  lifts: {
    id: "etat-des-ascenseurs",
    title: "État des ascenseurs",
    licence: "Licence Mobilité (token required)",
    url: "https://data.iledefrance-mobilites.fr/explore/dataset/etat-des-ascenseurs/",
  },
} as const;

/** The four classes the dataset actually uses, with their real record counts as
 *  of 2026-07-27: 213 / 174 / 58 / 14 of 459. The French is the operator's own
 *  wording and is kept verbatim; the rest is a gloss, not a re-interpretation. */
export const ACCESS_LEVELS: Record<number, Record<Lang, string>> = {
  1: {
    en: "Not accessible",
    fr: "Gare ou arrêt non accessible",
    zh: "车站不可无障碍通行",
  },
  3: {
    en: "Accessible only with a booking made in advance (AssistenGare)",
    fr: "Train accessible sur réservation préalable auprès du service AssistenGare",
    zh: "需提前向 AssistenGare 预约才可通行",
  },
  4: {
    en: "Accessible by asking a member of staff at the station",
    fr: "Train accessible sur demande auprès d'un agent en station",
    zh: "需在站内向工作人员提出请求",
  },
  6: {
    en: "Accessible on your own, no help needed",
    fr: "Véhicule accessible en toute autonomie",
    zh: "可自行独立通行",
  },
};

export interface StationAccess {
  /** The operator's own stop name, kept so the page can show what was matched. */
  stop: string;
  level: number;
  /** The operator's French wording, verbatim. */
  levelFr: string;
  /** Present on the stops where the class differs per line. */
  note: string | null;
}

export interface AccessibleToilet {
  line: string;
  station: string;
  free: boolean | null;
  insideGates: boolean | null;
  where: string | null;
}

export interface NetworkFacts {
  fetchedAt: string;
  stations: StationAccess[];
  toilets: AccessibleToilet[];
}

/**
 * Station names are written a dozen ways across datasets ("Gare de Lyon",
 * "Paris Gare de Lyon", "Champ de Mars Tour Eiffel" vs "Champ de Mars-Tour
 * Eiffel"). Comparing them raw finds almost nothing, so both sides are reduced
 * to letters and spaces first. This is a lookup key, never shown to anyone.
 */
export function stationKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(gare|station|paris|de|du|des|la|le|les|d|l)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The operator's record for one of our stops, or null when there is none.
 *
 * A miss is common and is not an error: the dataset covers RER and rail stops,
 * so a métro-only station simply is not in it. Saying nothing is correct there;
 * inventing a class from a neighbouring stop would not be.
 */
export function findStation(facts: NetworkFacts | null, name: string): StationAccess | null {
  if (!facts) return null;
  const key = stationKey(name);
  if (!key) return null;
  const exact = facts.stations.find((s) => stationKey(s.stop) === key);
  if (exact) return exact;

  // One side often carries extra words on the end ("Châtelet" against "Châtelet
  // les Halles"), so a prefix counts as the same station. Containment anywhere
  // does not, and the difference is not academic: "Tour Eiffel" sits inside
  // "Champ de Mars Tour Eiffel", and letting that match would print the RER
  // station's accessibility class under the monument, which is a different place
  // with a different entrance. French stop names grow by suffix, so a prefix is
  // the shape a longer form of the same name actually takes.
  const prefixMatch = facts.stations
    .filter((s) => {
      const k = stationKey(s.stop);
      return k.startsWith(`${key} `) || key.startsWith(`${k} `);
    })
    // Longest first, so the more specific record wins over a shorter one.
    .sort((a, b) => stationKey(b.stop).length - stationKey(a.stop).length)[0];

  return prefixMatch ?? null;
}

export function toiletsAt(facts: NetworkFacts | null, name: string): AccessibleToilet[] {
  if (!facts) return [];
  const key = stationKey(name);
  if (!key) return [];
  // Same prefix rule as findStation, for the same reason: a toilet at the RER
  // station is not a toilet at the monument up the road.
  return facts.toilets.filter((w) => {
    const k = stationKey(w.station);
    return k === key || k.startsWith(`${key} `) || key.startsWith(`${k} `);
  });
}

const CACHE_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; facts: NetworkFacts } | null = null;

async function fetchJson(url: string): Promise<unknown> {
  // A public dataset behind a slow CDN must not hold a page open. Failing here
  // means the official record is simply absent from the render, which the UI
  // says, rather than a request that hangs until the platform kills it.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "voie-libre/1.0 (summer school project)" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function yesNo(value: unknown): boolean | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "oui") return true;
  if (v === "non") return false;
  return null;
}

/**
 * Both datasets, normalised and cached for six hours.
 *
 * Neither changes hour to hour: the accessibility class of a station moves when
 * building work finishes, not on a timetable. Six hours keeps a demo instant and
 * still means the page is reading the source rather than a copy of it.
 */
export async function networkFacts(): Promise<NetworkFacts | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.facts;

  // The API caps a page at 100 rows and the station dataset holds 459, so this
  // is five pages rather than one call with a big limit. Six are requested and
  // the last is expected to come back short: hardcoding five would silently lose
  // every station added after today.
  const pages = await Promise.all(
    [0, 100, 200, 300, 400, 500].map((offset) =>
      fetchJson(
        `${BASE}/${SOURCES.stations.id}/records?limit=100&offset=${offset}&select=stop_name,accessibility_level_id,accessibility_level_name,commentaire&order_by=stop_name`
      )
    )
  );
  const toiletsRaw = await fetchJson(
    `${BASE}/${SOURCES.toilets.id}/records?limit=100&select=ligne,station,accessibilite_pmr,tarif_gratuit_payant,en_zone_controlee,localisation&where=accessibilite_pmr%3D%22oui%22`
  );

  const stations: StationAccess[] = [];
  const results = pages.flatMap((page) => (page as { results?: unknown[] } | null)?.results ?? []);
  for (const row of results as Record<string, unknown>[]) {
    const stop = typeof row.stop_name === "string" ? row.stop_name : null;
    const level = typeof row.accessibility_level_id === "number" ? row.accessibility_level_id : null;
    if (!stop || level === null) continue;
    stations.push({
      stop,
      level,
      levelFr: typeof row.accessibility_level_name === "string" ? row.accessibility_level_name : "",
      note: typeof row.commentaire === "string" && row.commentaire.trim() ? row.commentaire.trim() : null,
    });
  }

  const toilets: AccessibleToilet[] = [];
  const wcRows = (toiletsRaw as { results?: unknown[] } | null)?.results ?? [];
  for (const row of wcRows as Record<string, unknown>[]) {
    const station = typeof row.station === "string" ? row.station : null;
    if (!station) continue;
    toilets.push({
      line: typeof row.ligne === "string" ? row.ligne : "",
      station,
      free: typeof row.tarif_gratuit_payant === "string" ? row.tarif_gratuit_payant.toLowerCase().includes("gratuit") : null,
      insideGates: yesNo(row.en_zone_controlee),
      where: typeof row.localisation === "string" && row.localisation.trim() ? row.localisation.trim() : null,
    });
  }

  // Nothing arrived: keep whatever is cached rather than replacing real numbers
  // with an empty set, and let the caller report the absence.
  if (stations.length === 0 && toilets.length === 0) return cache?.facts ?? null;

  const facts: NetworkFacts = { fetchedAt: new Date().toISOString(), stations, toilets };
  cache = { at: now, facts };
  return facts;
}
