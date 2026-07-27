import raw from "./network.json";
import { ACCESS_LEVELS } from "./idfm";
import { PLACES } from "./places";
import type { L, RouteNode, Status } from "./data";

/**
 * Step-free routing over Île-de-France Mobilités' published network.
 *
 * The app used to answer with one of four journeys written by hand. Those four
 * were honest about their own contents and dishonest about the product: nobody's
 * trip is one of our four. This searches the operator's own graph instead, so
 * "Bastille to Orsay" is answered from data.
 *
 * The graph is built by `data/build_network.py` and committed as `network.json`,
 * so nothing is downloaded at request time. What the search optimises is not
 * time: it is time plus what each station would cost *this* traveller, which is
 * the whole point of the product. A wheelchair user changing trains at a station
 * the operator marks "non accessible" pays two thousand seconds for it, so the
 * search goes around rather than through, and the extra ten minutes on the clock
 * is the honest price of a route that exists for them.
 *
 * Penalties, never bans. A hard ban answers "no route", which helps nobody: a
 * traveller would rather see the only route there is, with its barrier named, and
 * decide for themselves.
 */

interface RawStation {
  name: string;
  lat: number;
  lng: number;
  lines: string[];
  access: { level: number; levelFr: string; note: string | null } | null;
  /** The operator's per-platform flags, aggregated at build time. */
  platforms: {
    boarding: "yes" | "no" | "mixed" | "unknown";
    accessible: number;
    partial: number;
    notAccessible: number;
    unknown: number;
    audible: number;
    visual: number;
  };
  /** Metres above sea level, so a walk can say whether it climbs. */
  elevation: number | null;
  osm: {
    lifts: number;
    stairways: number;
    maxSteps: number | null;
    stairwaysWithoutCount: number;
  };
}

interface RawLine {
  id: string;
  name: string;
  mode: string;
  color: string;
  text: string;
  stations: string[];
}

interface RawHop {
  a: string;
  b: string;
  line: string;
  mode: string;
  color: string;
  /** Fastest ride the timetable publishes, or 0 where the feed omitted times. */
  seconds: number;
}

const NET = raw as unknown as {
  builtAt: string;
  placeElevation: Record<string, number | null>;
  sources: { name: string; url: string; licence: string }[];
  pathwayModes: Record<string, number>;
  lines: RawLine[];
  hops: RawHop[];
  stations: Record<string, RawStation>;
  transfers: { a: string; b: string; seconds: number; metres: number }[];
};

export const NETWORK_META = {
  builtAt: NET.builtAt,
  sources: NET.sources,
  stations: Object.keys(NET.stations).length,
  lines: NET.lines.length,
  hops: NET.hops.length,
  /** Published as measured: every pathway row IDFM ships is a plain walkway, so
   *  the lift and stair counts here come from OpenStreetMap, not the operator. */
  pathwayModes: NET.pathwayModes,
};

export type ProfileId = "wheelchair" | "stroller" | "senior" | "lowenergy";

/**
 * The size of the gap, counted rather than described.
 *
 * The page used to open with "about 30 of 300+ stations have a working lift",
 * which came from reading around rather than from a file, and which nobody
 * (including us) could check. These numbers come from the register the operator
 * publishes, and the build script prints them every time it runs.
 */
export const COVERAGE = (() => {
  const all = Object.values(NET.stations);
  const level = (n: number) => all.filter((s) => s.access?.level === n).length;
  const boarding = (v: string) => all.filter((s) => s.platforms.boarding === v).length;
  return {
    stations: all.length,
    lines: NET.lines.length,
    withClass: all.filter((s) => s.access).length,
    autonomous: level(6),
    conditional: level(3) + level(4),
    notAccessible: level(1),
    /** Stations the operator says nothing about in either register. */
    silent: all.filter((s) => !s.access && s.platforms.boarding === "unknown").length,
    platformsAllAccessible: boarding("yes"),
    platformsNoneAccessible: boarding("no"),
    platformsMixed: boarding("mixed"),
  };
})();

// ---------------------------------------------------------------------------
// what a station costs a traveller
// ---------------------------------------------------------------------------

/**
 * What the operator says about standing here, as a status the UI can draw.
 *
 * Two registers, in order of authority. The station register (459 stops, mostly
 * rail) is a statement about the whole station and wins. Where it is silent, the
 * stop register's platform flags answer for 933 of the 945 stations, which is what
 * took "nobody published anything" from 320 stations down to 7.
 *
 * Nothing here ever returns `lift`. That means "working lift" in this app's
 * legend, and no free feed says a lift is working.
 */
export function statusOf(s: RawStation): Status {
  const level = s.access?.level;
  if (level === 6) return "ok";
  if (level === 4 || level === 3) return "conditional";
  if (level === 1) return "stairs";
  switch (s.platforms.boarding) {
    case "yes":
      return "ok";
    case "no":
      return "stairs";
    case "mixed":
      // Some platforms yes, some no. Which one you need depends on your line, so
      // it is a condition rather than a yes and rather than a barrier.
      return "conditional";
    default:
      return "unknown";
  }
}

/** Seconds of extra cost for standing at this station as a change or an end.
 *
 * `statusOf` already folds both registers together, so the penalty reads the
 * status rather than the sources: one place decides what a station means, and the
 * cost function cannot drift away from what the page shows. */
function stationPenalty(s: RawStation, profile: ProfileId): number {
  const st = statusOf(s);
  if (profile === "wheelchair") {
    if (st === "stairs") return 2400;
    if (st === "unknown") return 900;
    if (st === "conditional") return 600;
    return 0;
  }
  // A stroller, a tired traveller or an older traveller can take a few steps.
  // What they cannot take is many, so the published count drives the cost.
  const steps = s.osm.maxSteps ?? (st === "stairs" ? 30 : 0);
  const perStep = profile === "stroller" ? 12 : 8;
  const unknownCost = profile === "senior" ? 240 : 180;
  if (st === "stairs") return steps * perStep;
  if (st === "unknown") return unknownCost + steps * perStep * 0.5;
  if (st === "conditional") return 120;
  return 0;
}

/**
 * How long a walk costs this traveller, with the hill in it.
 *
 * Distance alone made a 1,300 m push up 74 m of Montmartre look cheaper than a
 * station with stairs, which is true on the clock and false on the ground. Ascent
 * is weighted hardest for a wheelchair and a tired traveller, because that is who
 * a gradient stops.
 */
function walkSeconds(metres: number, climb: number | null, profile: ProfileId): number {
  const perMetreUp =
    profile === "wheelchair" ? 20 : profile === "lowenergy" ? 15 : profile === "senior" ? 12 : 8;
  return metres / 1.1 + Math.max(0, climb ?? 0) * perMetreUp;
}

/** Seconds added for changing trains at all, before the station's own cost. */
function interchangeCost(profile: ProfileId): number {
  if (profile === "wheelchair") return 420;
  if (profile === "lowenergy" || profile === "senior") return 360;
  return 300;
}

const RAIL = new Set(["rail"]);

/** Only for the handful of hops the feed ships without usable times. */
function hopSeconds(metres: number, mode: string): number {
  return RAIL.has(mode) ? 40 + metres / 16 : 30 + metres / 9;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371000;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// the graph
// ---------------------------------------------------------------------------

interface LineRef {
  name: string;
  mode: string;
  color: string;
}

interface Edge {
  to: string;
  line: LineRef | null; // null = walk between two stations of an interchange
  seconds: number;
  metres: number;
  /** True when the ride time came off the timetable rather than from distance. */
  timed: boolean;
}

/** Built once per process: 570 stations, so this is cheap and never stale
 *  between requests (the file only changes when the build script runs). */
const EDGES: Map<string, Edge[]> = (() => {
  const g = new Map<string, Edge[]>();
  const push = (from: string, e: Edge) => {
    const list = g.get(from);
    if (list) list.push(e);
    else g.set(from, [e]);
  };
  for (const hop of NET.hops) {
    const sa = NET.stations[hop.a];
    const sb = NET.stations[hop.b];
    if (!sa || !sb) continue;
    const line: LineRef = { name: hop.line, mode: hop.mode, color: hop.color };
    const m = haversine(sa.lat, sa.lng, sb.lat, sb.lng);
    const secs = hop.seconds || hopSeconds(m, hop.mode);
    // The feed publishes each direction as its own trip, so a hop is directed.
    push(hop.a, { to: hop.b, line, seconds: secs, metres: m, timed: hop.seconds > 0 });
  }
  for (const tr of NET.transfers) {
    const secs = tr.seconds || Math.round(tr.metres / 1.1);
    const e = { seconds: secs, metres: tr.metres, line: null, timed: false } as const;
    push(tr.a, { ...e, to: tr.b });
    push(tr.b, { ...e, to: tr.a });
  }
  return g;
})();

// ---------------------------------------------------------------------------
// finding a station by what a traveller typed
// ---------------------------------------------------------------------------

/** Mirrors `stationKey` in idfm.ts and `norm` in build_network.py. */
export function key(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Sacré-Cœur is typed both ways, and the ligature is one code point that NFD
    // does not split, so it would otherwise never match "Sacre-Coeur".
    .replace(/\u0153/g, "oe")
    .replace(/\u00e6/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(gare|station|paris|de|du|des|la|le|les|d|l)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface StationHit {
  id: string;
  name: string;
  lines: string[];
  status: Status;
}

const ALL: StationHit[] = Object.entries(NET.stations)
  .map(([id, s]) => ({ id, name: s.name, lines: s.lines, status: statusOf(s) }))
  .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name));

/** Search for the picker. Interchanges first, because a traveller typing three
 *  letters usually means the big station, and the small one is one keystroke on. */
export function searchStations(q: string, limit = 8): StationHit[] {
  const k = key(q);
  if (!k) return ALL.slice(0, limit);
  const starts: StationHit[] = [];
  const contains: StationHit[] = [];
  for (const s of ALL) {
    const sk = key(s.name);
    if (sk.startsWith(k)) starts.push(s);
    else if (sk.includes(k)) contains.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function stationById(id: string): RawStation | undefined {
  return NET.stations[id];
}

/** Accepts a station id or a station name typed by a person. */
export function resolveStation(input: string): StationHit | null {
  if (NET.stations[input]) {
    const s = NET.stations[input];
    return { id: input, name: s.name, lines: s.lines, status: statusOf(s) };
  }
  return searchStations(input, 1)[0] ?? null;
}

/**
 * The station to use for a place, for this traveller.
 *
 * Not simply the nearest one. The nearest station to the Eiffel Tower is
 * Bir-Hakeim, whose two platforms the operator marks not accessible, so sending a
 * wheelchair user there and then admitting the barrier is worse than sending them
 * to a station they can leave and letting them walk further. The comparison is in
 * seconds: the extra walk against what the station itself would cost them.
 */
function nearestStation(
  lat: number,
  lng: number,
  profile: ProfileId,
  placeHeight: number | null,
): { hit: StationHit; metres: number } {
  let best = ALL[0];
  let bestCost = Infinity;
  let bestM = Infinity;
  for (const s of ALL) {
    const st = NET.stations[s.id];
    const m = haversine(lat, lng, st.lat, st.lng);
    // A kilometre and a half is the outer edge of "walkable instead"; beyond that
    // the accessible station is a different trip, not a longer walk.
    if (m > 1500) continue;
    const climb = placeHeight !== null && st.elevation !== null ? placeHeight - st.elevation : null;
    const cost = walkSeconds(m, climb, profile) + stationPenalty(st, profile);
    if (cost < bestCost) {
      bestCost = cost;
      bestM = m;
      best = s;
    }
  }
  if (bestCost === Infinity) {
    for (const s of ALL) {
      const st = NET.stations[s.id];
      const m = haversine(lat, lng, st.lat, st.lng);
      if (m < bestM) {
        bestM = m;
        best = s;
      }
    }
  }
  return { hit: best, metres: Math.round(bestM) };
}

export interface Endpoint {
  station: StationHit;
  /** Set when the traveller named a place rather than a station. */
  place?: { id: string; name: string; lat: number; lng: number; walkM: number };
}

/**
 * Where a journey starts or ends, from whatever the traveller typed.
 *
 * A station name is the easy case. A landmark is the one that matters: somebody
 * asks for the Eiffel Tower, not for Bir-Hakeim, and the feed IDFM publishes has
 * no RER C service through Champ de Mars at all, so the nearest station the
 * timetable actually runs is the honest answer plus the walk it leaves you.
 */
export function resolveEndpoint(input: string, profile: ProfileId = "wheelchair"): Endpoint | null {
  const direct = NET.stations[input] ? resolveStation(input) : null;
  if (direct) return { station: direct };

  const k = key(input);
  if (!k) return null;
  const place = PLACES.find((p) => {
    const en = key(p.nameEn);
    const fr = key(p.nameFr);
    return en === k || fr === k || en.startsWith(k) || fr.startsWith(k) || p.id === input;
  });

  const station = searchStations(input, 1)[0] ?? null;
  // A station whose name matches what was typed beats a landmark that merely
  // starts the same way, unless the landmark is an exact hit.
  if (station && (!place || key(station.name) === k)) return { station };
  if (!place) return station ? { station } : null;

  const near = nearestStation(
    place.coord.lat,
    place.coord.lng,
    profile,
    NET.placeElevation[place.id] ?? null,
  );
  return {
    station: near.hit,
    place: {
      id: place.id,
      name: place.nameEn,
      lat: place.coord.lat,
      lng: place.coord.lng,
      walkM: near.metres,
    },
  };
}

// ---------------------------------------------------------------------------
// the search
// ---------------------------------------------------------------------------

interface State {
  station: string;
  line: string | null; // the line we are riding, so a change can be charged
}

const sid = (s: State) => `${s.station}|${s.line ?? "-"}`;

interface Came {
  from: State;
  edge: Edge;
}

/** Dijkstra over (station, line) with a binary heap. 570 stations and ~1,500
 *  edges, so the heap is not the interesting part; the cost function is. */
function search(fromId: string, toId: string, profile: ProfileId) {
  const dist = new Map<string, number>();
  const came = new Map<string, Came>();
  const heap: { cost: number; state: State }[] = [];

  const up = (item: { cost: number; state: State }) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].cost <= heap[i].cost) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const down = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].cost < heap[m].cost) m = l;
        if (r < heap.length && heap[r].cost < heap[m].cost) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const start: State = { station: fromId, line: null };
  dist.set(sid(start), 0);
  up({ cost: 0, state: start });

  let best: State | null = null;
  while (heap.length) {
    const { cost, state } = down();
    if (cost > (dist.get(sid(state)) ?? Infinity)) continue;
    if (state.station === toId) {
      best = state;
      break;
    }
    for (const edge of EDGES.get(state.station) ?? []) {
      const lineName = edge.line?.name ?? null;
      const changing = state.line !== null && lineName !== state.line;
      const here = NET.stations[state.station];
      let step = edge.seconds;
      if (changing || edge.line === null) {
        step += interchangeCost(profile) + stationPenalty(here, profile);
      }
      const next: State = { station: edge.to, line: lineName };
      const nid = sid(next);
      const total = cost + step;
      if (total < (dist.get(nid) ?? Infinity)) {
        dist.set(nid, total);
        came.set(nid, { from: state, edge });
        up({ cost: total, state: next });
      }
    }
  }
  if (!best) return null;

  const legs: Came[] = [];
  let cur = best;
  for (;;) {
    const c = came.get(sid(cur));
    if (!c) break;
    legs.unshift(c);
    cur = c.from;
  }
  return { legs, cost: dist.get(sid(best))! };
}

// ---------------------------------------------------------------------------
// turning a path into something the page already knows how to draw
// ---------------------------------------------------------------------------

const STOPS: (n: number) => L = (n) => ({
  en: n === 1 ? "1 stop" : `${n} stops`,
  fr: n === 1 ? "1 arrêt" : `${n} arrêts`,
  zh: `${n} 站`,
});

const WALK: (m: number) => L = (m) => ({
  en: `Change on foot, about ${m} m`,
  fr: `Correspondance à pied, environ ${m} m`,
  zh: `步行换乘，约 ${m} 米`,
});

const NO_RECORD: L = {
  en: "The operator publishes no accessibility class for this station",
  fr: "L'opérateur ne publie pas de classe d'accessibilité pour cette gare",
  zh: "运营方未公布该站的无障碍等级",
};

/**
 * What is known about standing at this station, and who says it.
 *
 * Two sources, never blended: the operator's class, then what OpenStreetMap
 * contributors have mapped. The OSM half is deliberately phrased as a count of
 * what is mapped nearby rather than as a property of the journey, because a
 * staircase within 150 m of the station is not necessarily on your path, and
 * saying "26 steps" would claim it is.
 */
function osmClause(s: RawStation): L {
  const { lifts, stairways, maxSteps } = s.osm;
  if (!lifts && !stairways) return { en: "", fr: "", zh: "" };
  const en: string[] = [];
  const fr: string[] = [];
  const zh: string[] = [];
  if (lifts) {
    en.push(`${lifts} lift${lifts === 1 ? "" : "s"}`);
    fr.push(`${lifts} ascenseur${lifts === 1 ? "" : "s"}`);
    zh.push(`${lifts} 台电梯`);
  }
  if (stairways) {
    en.push(
      `${stairways} stairway${stairways === 1 ? "" : "s"}${maxSteps ? `, longest ${maxSteps} steps` : ", none with a step count"}`,
    );
    fr.push(
      `${stairways} escalier${stairways === 1 ? "" : "s"}${maxSteps ? `, le plus long de ${maxSteps} marches` : ", aucun avec un nombre de marches"}`,
    );
    zh.push(`${stairways} 处楼梯${maxSteps ? `，最长 ${maxSteps} 级` : "，均未标注级数"}`);
  }
  return {
    en: ` · OpenStreetMap maps ${en.join(" and ")} within 150 m, status unknown`,
    fr: ` · OpenStreetMap recense ${fr.join(" et ")} dans un rayon de 150 m, état inconnu`,
    zh: ` · OpenStreetMap 在 150 米内标注 ${zh.join("、")}，状态未知`,
  };
}

function platformClause(s: RawStation): L {
  const { boarding, accessible, partial, notAccessible } = s.platforms;
  const total = accessible + partial + notAccessible;
  if (!total) return { en: "", fr: "", zh: "" };
  if (boarding === "yes") {
    return {
      en: `Operator's stop register: all ${total} platform${total === 1 ? "" : "s"} accessible`,
      fr: `Registre des arrêts de l'exploitant : ${total} quai${total === 1 ? "" : "s"} accessible${total === 1 ? "" : "s"} sur ${total}`,
      zh: `运营方站点登记：全部 ${total} 个站台可通行`,
    };
  }
  if (boarding === "no") {
    return {
      en: `Operator's stop register: none of the ${total} platform${total === 1 ? "" : "s"} accessible`,
      fr: `Registre des arrêts de l'exploitant : aucun des ${total} quais accessible`,
      zh: `运营方站点登记：${total} 个站台均不可通行`,
    };
  }
  const yes = accessible + partial;
  return {
    en: `Operator's stop register: ${yes} of ${total} platforms accessible, so it depends which line you need`,
    fr: `Registre des arrêts de l'exploitant : ${yes} quais accessibles sur ${total}, cela dépend donc de votre ligne`,
    zh: `运营方站点登记：${total} 个站台中 ${yes} 个可通行，因此取决于你要坐哪条线`,
  };
}

function atText(s: RawStation): L {
  const osm = osmClause(s);
  const level = s.access?.level;
  if (level === undefined) {
    const pf = platformClause(s);
    if (pf.en) {
      return {
        en: pf.en + osm.en,
        fr: pf.fr + osm.fr,
        zh: pf.zh + osm.zh,
      };
    }
    return {
      en: NO_RECORD.en + osm.en,
      fr: NO_RECORD.fr + osm.fr,
      zh: NO_RECORD.zh + osm.zh,
    };
  }
  const gloss = ACCESS_LEVELS[level];
  return {
    en: gloss.en + osm.en,
    fr: gloss.fr + osm.fr,
    zh: gloss.zh + osm.zh,
  };
}

export interface PlannedRoute {
  id: string;
  from: string;
  to: string;
  title: L;
  profile: ProfileId;
  sources: string[];
  nodes: RouteNode[];
  /** Every station passed through, for the map line. The nodes are the legs a
   *  person reads; this is the shape the journey actually traces. */
  shape: { lat: number; lng: number }[];
  /** Rounded up: a traveller plans with the worse number, not the prettier one. */
  minutes: number;
  changes: number;
  stops: number;
  /** Stations on the way that would stop this traveller, named not hidden. */
  barriers: string[];
  /** Stations where nobody has published enough to say. */
  unknowns: string[];
  /** The last walk, as numbers rather than a sentence.
   *
   *  A summary that counts stations and finds none of them marked inaccessible
   *  reads like a clean bill of health for the journey to Sacre-Coeur, whose real
   *  obstacle is 74 m of hill on the last 1,329 m. The obstacle is not a station,
   *  so counting stations cannot see it. It belongs on the route.
   *
   *  `minutes` is here because distance alone does not decide anything either.
   *  The open feed has no rail trip within a kilometre of the Eiffel Tower, so a
   *  wheelchair journey there ends in a 1,451 m push on the flat: no barrier, no
   *  climb, and 22 minutes that the traveller has to do themselves. It is the
   *  walking model's own figure for this profile, not a second guess. */
  finalWalk: { metres: number; climbM: number | null; minutes: number } | null;
}

/**
 * The last leg, with its climb.
 *
 * This used to read "street-level walk of about 405 m", which is what the walk
 * from Lamarck - Caulaincourt to Sacre-Coeur was called. That walk climbs about
 * 34 m up the Butte Montmartre. For the person this product is for, the gradient
 * is the whole question, so the height difference between the station and the
 * place is stated whenever both are known.
 */
const FINAL_WALK: (m: number, name: string, climb: number | null) => L = (m, name, climb) => {
  const up = climb !== null && climb >= 8;
  const down = climb !== null && climb <= -8;
  return {
    en: `Walk of about ${m} m outside the station to ${name}${up ? `, climbing about ${climb} m` : down ? `, descending about ${Math.abs(climb!)} m` : climb === null ? "" : ", level to within 8 m"}`,
    fr: `Environ ${m} m à pied hors de la gare jusqu'à ${name}${up ? `, avec environ ${climb} m de montée` : down ? `, avec environ ${Math.abs(climb!)} m de descente` : climb === null ? "" : ", à moins de 8 m de dénivelé"}`,
    zh: `出站后步行约 ${m} 米前往${name}${up ? `，需上行约 ${climb} 米` : down ? `，下行约 ${Math.abs(climb!)} 米` : climb === null ? "" : "，高差在 8 米以内"}`,
  };
};

const NO_PAVEMENT_DATA: L = {
  en: "The height comes from the terrain, not from the pavement: nobody publishes kerbs or crossings for this walk, so it is not rated",
  fr: "Le dénivelé vient du terrain, pas du trottoir : personne ne publie les bordures ni les traversées de ce trajet, qui n'est donc pas évalué",
  zh: "高差来自地形数据，不是人行道数据：这段步行的路缘和过街口没人公布，因此未作评级",
};

export type PlanResult =
  | { ok: true; route: PlannedRoute }
  /** Named rather than generic, because "no route" and "we do not know that
   *  station" need different sentences in front of a traveller. */
  | { ok: false; reason: "unknown_from" | "unknown_to" | "same_place" | "no_route" };

export function plan(fromInput: string, toInput: string, profile: ProfileId): PlanResult {
  const a = resolveEndpoint(fromInput, profile);
  const b = resolveEndpoint(toInput, profile);
  if (!a) return { ok: false, reason: "unknown_from" };
  if (!b) return { ok: false, reason: "unknown_to" };
  if (a.station.id === b.station.id) return { ok: false, reason: "same_place" };
  const found = search(a.station.id, b.station.id, profile);
  if (!found) return { ok: false, reason: "no_route" };

  // Collapse consecutive hops on one line into a single leg, which is how a
  // person describes a journey: three lines, not nineteen stations.
  const nodes: RouteNode[] = [];
  const shape: { lat: number; lng: number }[] = [];
  const barriers: string[] = [];
  const unknowns: string[] = [];
  let seconds = 0;
  let changes = 0;

  const first = NET.stations[a.station.id];
  shape.push({ lat: first.lat, lng: first.lng });
  nodes.push({
    name: first.name,
    coord: { lat: first.lat, lng: first.lng },
    at: statusOf(first),
    atText: atText(first),
  });

  let runLine: LineRef | null = null;
  let runStops = 0;
  let runMetres = 0;

  const flush = (station: RawStation) => {
    const status = statusOf(station);
    nodes.push({
      name: station.name,
      line: runLine ? { label: label(runLine), color: runLine.color || "#616671" } : undefined,
      coord: { lat: station.lat, lng: station.lng },
      into: runLine
        ? { status: "ok", text: STOPS(runStops) }
        : { status: "unknown", text: WALK(Math.round(runMetres)) },
      at: status,
      atText: atText(station),
    });
    if (status === "stairs") barriers.push(station.name);
    if (status === "unknown") unknowns.push(station.name);
  };

  for (let i = 0; i < found.legs.length; i += 1) {
    const { edge } = found.legs[i];
    const next = found.legs[i + 1];
    const to = NET.stations[edge.to];
    shape.push({ lat: to.lat, lng: to.lng });
    seconds += edge.seconds;
    if (edge.line) {
      if (runLine && runLine.name !== edge.line.name) {
        runStops = 0;
        runMetres = 0;
      }
      runLine = edge.line;
      runStops += 1;
      runMetres += edge.metres;
    } else {
      runLine = null;
      runStops = 0;
      runMetres = edge.metres;
    }
    const lineChanges = !next || (next.edge.line?.name ?? null) !== (edge.line?.name ?? null);
    if (lineChanges) {
      flush(to);
      if (next) {
        changes += 1;
        seconds += interchangeCost(profile) + stationPenalty(to, profile);
      }
      runLine = null;
      runStops = 0;
      runMetres = 0;
    }
  }

  // The walk from the last station to the place that was actually asked for.
  // Rated `unknown` rather than `ok`, because street-level step-free is a claim
  // no dataset here supports and a kerb is enough to end a journey.
  let finalWalk: { metres: number; climbM: number | null; minutes: number } | null = null;
  if (b.place && b.place.walkM > 60) {
    const placeHeight = NET.placeElevation[b.place.id] ?? null;
    const stationHeight = NET.stations[b.station.id].elevation;
    const climb =
      placeHeight !== null && stationHeight !== null
        ? Math.round(placeHeight - stationHeight)
        : null;
    finalWalk = {
      metres: b.place.walkM,
      climbM: climb,
      minutes: Math.round(walkSeconds(b.place.walkM, climb, profile) / 60),
    };
    shape.push({ lat: b.place.lat, lng: b.place.lng });
    nodes.push({
      name: b.place.name,
      coord: { lat: b.place.lat, lng: b.place.lng },
      into: { status: "unknown", text: FINAL_WALK(b.place.walkM, b.place.name, climb) },
      at: "unknown",
      atText: NO_PAVEMENT_DATA,
      walkM: b.place.walkM,
    });
    unknowns.push(b.place.name);
    seconds += walkSeconds(b.place.walkM, climb, profile);
  }

  const destination = b.place?.name ?? NET.stations[b.station.id].name;
  const origin = a.place?.name ?? first.name;
  const heading = `${origin} → ${destination}`;

  const route: PlannedRoute = {
    id: `plan-${a.station.id}-${b.station.id}-${profile}`,
    from: origin,
    to: destination,
    title: { en: heading, fr: heading, zh: heading },
    profile,
    sources: NET.sources.map((s) => `${s.name} (${s.licence})`),
    nodes,
    shape,
    minutes: Math.ceil(seconds / 60),
    changes,
    stops: found.legs.filter((l) => l.edge.line).length,
    barriers,
    unknowns,
    finalWalk,
  };
  return { ok: true, route };
}

/** What the two pickers offer: stations the timetable runs, plus the landmarks
 *  people actually name, each resolved to the station that serves it. */
export interface Suggestion {
  value: string;
  label: string;
  kind: "station" | "place";
  detail: string;
}

export function suggest(q: string, limit = 8): Suggestion[] {
  const k = key(q);
  const places: Suggestion[] = !k
    ? []
    : PLACES.filter((p) => key(p.nameEn).includes(k) || key(p.nameFr).includes(k))
        .slice(0, 4)
        .map((p) => ({
          value: p.nameEn,
          label: p.nameEn,
          kind: "place" as const,
          detail: p.nearestTransit,
        }));
  const stations: Suggestion[] = searchStations(q, limit).map((s) => ({
    value: s.id,
    label: s.name,
    kind: "station" as const,
    detail: s.lines.join(" · "),
  }));
  return [...places, ...stations].slice(0, limit);
}

/**
 * The two endpoints a sentence is asking about, found without a model.
 *
 * The chat used to emit its routing marker and then write prose about a route it
 * had never seen, which produced sentences like "the timetable includes lift data
 * for every station". It does not. So the endpoints are extracted here, the route
 * is computed before the model is called, and the model is given the real answer
 * to describe. Extraction is deliberately dumb: word n-grams from the message,
 * matched against station and place names, longest first.
 */
const STOPWORDS = new Set([
  "a", "am", "an", "and", "any", "are", "at", "avec", "best", "but", "by", "can",
  "child", "close", "day", "en", "for", "free", "from", "get", "go", "going",
  "how", "i", "in", "is", "it", "me", "my", "near", "nearest", "no", "not",
  "now", "of", "on", "or", "please", "pour", "pram", "route", "step", "stroller",
  "sur", "take", "than", "the", "then", "there", "till", "to", "today", "use",
  "using", "vers", "want", "way", "we", "wheelchair", "which", "with", "without",
  "would", "you", "your", "comment", "aller", "depuis", "jusqu", "je", "veux",
]);

function nameMatch(phrase: string): { value: string; label: string } | null {
  if (phrase.length < 4) return null;
  for (const p of PLACES) {
    for (const name of [p.nameEn, p.nameFr]) {
      const k = key(name);
      if (k === phrase || k.startsWith(`${phrase} `)) return { value: p.nameEn, label: p.nameEn };
    }
  }
  let best: { value: string; label: string; len: number } | null = null;
  for (const s of ALL) {
    const k = key(s.name);
    if (k === phrase || k.startsWith(`${phrase} `)) {
      // Prefer the shortest station whose name starts with the phrase: typing
      // "Nation" means Nation, not "Nationale".
      if (!best || k.length < best.len) best = { value: s.id, label: s.name, len: k.length };
    }
  }
  return best ? { value: best.value, label: best.label } : null;
}

export function mentionedEndpoints(
  text: string,
): { from: string; to: string; fromLabel: string; toLabel: string } | null {
  const words = key(text).split(" ").filter(Boolean);
  const found: { value: string; label: string }[] = [];
  for (let i = 0; i < words.length; i += 1) {
    if (STOPWORDS.has(words[i])) continue;
    let matched = 0;
    for (let n = Math.min(5, words.length - i); n >= 1; n -= 1) {
      const phrase = words.slice(i, i + n).join(" ");
      const hit = nameMatch(phrase);
      if (hit) {
        if (!found.some((f) => f.value === hit.value)) found.push(hit);
        matched = n;
        break;
      }
    }
    if (matched) i += matched - 1;
  }
  if (found.length < 2) return null;
  // First mentioned is the start and last is the destination, which is how the
  // sentence is written in all three languages this app answers in.
  const from = found[0];
  const to = found[found.length - 1];
  return { from: from.value, to: to.value, fromLabel: from.label, toLabel: to.label };
}

/** GTFS ships "1", "B", "TER"; the UI wants a badge a Parisian recognises. */
function label(line: LineRef): string {
  if (line.mode === "rail") return line.name.length <= 2 ? `RER ${line.name}` : line.name;
  return `M${line.name}`;
}
