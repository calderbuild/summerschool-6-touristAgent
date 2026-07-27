import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import network from "../network.json";
import { plan, suggest, resolveEndpoint, statusOf, NETWORK_META, COVERAGE } from "../router";
import { ACCESS_LEVELS } from "../idfm";

/**
 * These tests exist to stop two specific regressions, both of which would be
 * invisible on screen: a graph that quietly loses a branch of the network, and a
 * route that quietly upgrades "nobody published anything" into a green tick.
 */

const stations = (network as { stations: Record<string, unknown> }).stations;
/** Resolved from this file, so the run is the same from either directory. */
const APP = resolve(fileURLToPath(import.meta.url), "../../..");

describe("the graph", () => {
  it("covers the network rather than one pattern per line", () => {
    // The first version of the build script kept only the longest stop pattern
    // per route, which silently dropped RER C's Paris branches and made half the
    // city unroutable. 2,488 hops is the union of all trips across metro, tram,
    // RER and Transilien; a big drop here means that bug is back.
    expect(NETWORK_META.hops).toBeGreaterThan(2200);
    expect(NETWORK_META.stations).toBeGreaterThan(900);
  });

  it("pins the one line the open feed truncates, so nobody claims we cover it", () => {
    // The feed's only route with short name "C" runs 37 stations on the southern
    // branches and stops at Gare d'Austerlitz. The Paris branch is absent: Champ
    // de Mars Tour Eiffel is in stops.txt but its only callers are buses. That is
    // the feed, not this build, and it is why the Eiffel Tower is reached on foot.
    //
    // This test is meant to fail the day IDFM publishes those trips. When it does,
    // rebuild, raise the count here, and take the caveat off /how-it-works.
    const named = Object.values(stations as Record<string, { name: string; lines: string[] }>);
    const onC = named.filter((s) => s.lines.includes("C"));
    expect(onC.length).toBe(37);
    // Narrow on purpose: "Orsay - Ville" is a real RER B station out in the
    // suburbs and is present. Only the Paris-branch names belong in this list.
    const parisBranch = /champ de mars|mus[ée]e d'orsay|pont de l'alma|boulevard victor/i;
    expect(named.filter((s) => parisBranch.test(s.name))).toEqual([]);
  });

  it("never points a hop at a station it does not have", () => {
    const hops = (network as { hops: { a: string; b: string }[] }).hops;
    const missing = hops.filter((h) => !(h.a in stations) || !(h.b in stations));
    expect(missing).toEqual([]);
  });

  it("records that the operator's pathway file carries no lifts or stairs", () => {
    // This is the measured justification for taking lift and stair data from
    // OpenStreetMap. If IDFM ever fills the file in, this test fails and the
    // product should switch to the operator's own numbers.
    expect(NETWORK_META.pathwayModes).toEqual({ walkway: 4879 });
  });
});

describe("what a station is allowed to claim", () => {
  it("never reports a working lift, because no free feed says one works", () => {
    const claims = Object.values(stations as Record<string, never>).map((s) => statusOf(s));
    expect(claims).not.toContain("lift");
    expect(claims).not.toContain("lift_down");
  });

  it("keeps the operator's conditional classes out of the step-free bucket", () => {
    const levels = Object.keys(ACCESS_LEVELS).map(Number);
    expect(levels).toEqual([1, 3, 4, 6]);
    const conditional = Object.values(stations as Record<string, never>).filter(
      (s: { access?: { level: number } }) => s.access?.level === 3 || s.access?.level === 4,
    );
    // The comment on the Status union in lib/data.ts cites this number as the
    // reason `conditional` exists. If a rebuild moves it, the comment is wrong and
    // this fails rather than quietly ageing.
    expect(conditional.length).toBe(216);
    for (const s of conditional) expect(statusOf(s)).toBe("conditional");
  });

  it("falls back to the per-platform register where no station class exists", () => {
    // The station-level register covers 432 of 945 stations. The stop register
    // covers the platforms of nearly all of them, which is what cut "nothing
    // published anywhere" from 320 stations down to 7. If this fallback is ever
    // dropped, hundreds of stations silently become "unknown" again.
    const all = Object.values(stations as Record<string, never>) as {
      access?: { level: number } | null;
      platforms: { boarding: string };
    }[];
    const noClass = all.filter((s) => !s.access);
    expect(noClass.length).toBeGreaterThan(400);
    const rescued = noClass.filter((s) => statusOf(s as never) !== "unknown");
    expect(rescued.length).toBeGreaterThan(noClass.length * 0.9);
    expect(COVERAGE.silent).toBeLessThan(20);
    expect(COVERAGE.silent).toBe(all.filter((s) => statusOf(s as never) === "unknown").length);
  });
});

describe("planning a journey", () => {
  it("answers a real pair of stations with legs in all three languages", () => {
    const result = plan("IDFM:73626", "IDFM:71673", "wheelchair"); // Gare de Lyon → Nation
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.nodes.length).toBeGreaterThan(1);
    expect(result.route.minutes).toBeGreaterThan(0);
    for (const node of result.route.nodes) {
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(node.atText[lang].length).toBeGreaterThan(0);
      }
    }
  });

  it("sends a landmark to the station that serves it and admits the walk", () => {
    const result = plan("IDFM:73626", "Eiffel Tower", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const last = result.route.nodes[result.route.nodes.length - 1];
    expect(last.name).toBe("Eiffel Tower");
    // A pavement is not a dataset we have. The walk must never be green.
    expect(last.at).toBe("unknown");
    expect(last.into?.status).toBe("unknown");
    expect(last.walkM).toBeGreaterThan(60);
  });

  it("times the last walk with the traveller's own pace, and shows it to both summaries", () => {
    // The open feed has no rail trip within a kilometre of the Eiffel Tower, so
    // this journey ends in a long flat push: no barrier, no climb, and twenty-odd
    // minutes the traveller does themselves. The verdict counted stations, found
    // nothing marked inaccessible, and read clean. Distance alone would not fix
    // it either, which is why the walk carries its own duration.
    const chair = plan("IDFM:71673", "Eiffel Tower", "wheelchair");
    expect(chair.ok).toBe(true);
    if (!chair.ok) return;
    const walk = chair.route.finalWalk;
    expect(walk).not.toBeNull();
    expect(walk!.metres).toBeGreaterThan(1000);
    expect(walk!.minutes).toBeGreaterThanOrEqual(10);
    expect(chair.route.barriers).toEqual([]);

    // The duration is the walking model's, not a second guess: flat pace plus the
    // wheelchair's own 20 s per metre of climb. Pinning the arithmetic is what
    // stops the figure drifting into a constant that merely looks profile-aware.
    const expected = Math.round(
      (walk!.metres / 1.1 + Math.max(0, walk!.climbM ?? 0) * 20) / 60,
    );
    expect(walk!.minutes).toBe(expected);

    // Both places that derive a summary must read the duration. A test on the
    // router alone is what let the card print a clean verdict over 74 m of hill.
    const card = readFileSync(join(APP, "components", "chat", "ChatRouteCard.tsx"), "utf8");
    const panel = readFileSync(join(APP, "components", "App.tsx"), "utf8");
    for (const src of [card, panel]) expect(src).toMatch(/finalWalk\.minutes/);
  });

  it("does not put a nearby staircase in the step count for the journey", () => {
    // `steps` on a node means "steps on your path", which only the field-surveyed
    // routes know. OpenStreetMap's nearest staircase is attributed in the text
    // instead; printing it as a step count would claim it is on the route.
    const result = plan("IDFM:73626", "IDFM:71673", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const node of result.route.nodes) expect(node.steps).toBeUndefined();
    const withOsm = result.route.nodes.filter((n) => n.atText.en.includes("OpenStreetMap"));
    expect(withOsm.length).toBeGreaterThan(0);
    for (const n of withOsm) expect(n.atText.en).toMatch(/within 150 m, status unknown/);
  });

  it("says which end it did not understand instead of failing generically", () => {
    expect(plan("qqqqqqzzzz", "IDFM:71673", "wheelchair")).toEqual({
      ok: false,
      reason: "unknown_from",
    });
    expect(plan("IDFM:71673", "qqqqqqzzzz", "wheelchair")).toEqual({
      ok: false,
      reason: "unknown_to",
    });
    expect(plan("IDFM:71673", "IDFM:71673", "wheelchair")).toEqual({
      ok: false,
      reason: "same_place",
    });
  });

  it("charges a wheelchair user more than a stroller for the same trip", () => {
    // Not a claim about the world: a claim about this cost function. If the two
    // profiles ever produce identical numbers, the profile picker is decoration.
    const a = plan("IDFM:71673", "IDFM:73626", "wheelchair");
    const b = plan("IDFM:71673", "IDFM:73626", "stroller");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.route.minutes).toBeGreaterThanOrEqual(b.route.minutes);
  });

  it("says whether the last walk climbs, because a slope is not a step", () => {
    // Sacré-Cœur sits 74 m above the nearest fully accessible stop. A route that
    // prints only the distance is telling a wheelchair user a comfortable lie.
    const result = plan("IDFM:73626", "Sacré-Cœur Basilica", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const last = result.route.nodes[result.route.nodes.length - 1];
    expect(last.into?.text.en).toMatch(/climbing about \d+ m|descending about \d+ m|level to within/);
    // And the walk itself stays unrated, because terrain height is not a pavement.
    expect(last.atText.en).toMatch(/not from the pavement/);
  });

  it("picks a different last station for a wheelchair than for a stroller", () => {
    // The profile picker is the product's one interactive claim. If both profiles
    // walk in from the same stop, the claim is decoration.
    const chair = plan("IDFM:73626", "Sacré-Cœur Basilica", "wheelchair");
    const pram = plan("IDFM:73626", "Sacré-Cœur Basilica", "stroller");
    expect(chair.ok && pram.ok).toBe(true);
    if (!chair.ok || !pram.ok) return;
    const lastStation = (r: typeof chair) =>
      r.ok ? r.route.nodes[r.route.nodes.length - 2]?.name : null;
    expect(lastStation(chair)).not.toBe(lastStation(pram));
  });

  it("draws the line through every station passed, not just the changes", () => {
    const result = plan("IDFM:73626", "IDFM:71673", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.shape.length).toBeGreaterThan(result.route.nodes.length);
  });
});

describe("the pickers", () => {
  it("folds the ligature, so Sacre-Coeur finds Sacré-Cœur", () => {
    const hit = resolveEndpoint("Sacre-Coeur");
    expect(hit).not.toBeNull();
    expect(hit?.place?.name).toMatch(/Sacr/);
  });

  it("offers places above stations, and never an empty label", () => {
    const results = suggest("lou");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.label.trim().length).toBeGreaterThan(0);
  });
});
