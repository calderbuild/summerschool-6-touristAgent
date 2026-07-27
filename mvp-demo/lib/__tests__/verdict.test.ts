import { describe, it, expect } from "vitest";
import { plan } from "../router";
import { verdictSummary, tally } from "../verdict";
import type { DemoRoute, RouteNode } from "../data";

/**
 * The card summarises a route in one line, and that line is the product.
 *
 * This used to assert on the text of `ChatRouteCard.tsx`, because the summary was
 * written inside the component. Reading source proved only that a string appeared
 * somewhere in a file. The summary is a pure function now, so each sentence the
 * product printed wrongly gets a case that states it in words.
 *
 * `t` returns the key it is given, so nothing here depends on English: the real
 * dictionary is trilingual and an English assertion over a French line is its own
 * bug (see the local mistakes log, entry 1).
 */

const t = (k: string) => k;
const walk = (minutes: number, climbM: number | null = null, metres = 1000) => ({
  metres,
  climbM,
  minutes,
});

describe("the one-line verdict", () => {
  it("says step-free only when nothing at all is in the way", () => {
    expect(verdictSummary(t, "A", "B", { barriers: 0, conditional: 0, unknowns: 0 })).toBe(
      "A → B: verdict_clear",
    );
  });

  it("counts a staff-conditional stop as not step-free", () => {
    // A journey whose every stop the operator marks "only with a member of staff"
    // was once summarised "step-free the whole way".
    const out = verdictSummary(t, "A", "B", { barriers: 0, conditional: 4, unknowns: 0 });
    expect(out).not.toContain("verdict_clear");
    expect(out).toContain("4 verdict_conditional");
  });

  it("has real routes whose stops are staff-conditional, so the rule matters", () => {
    const result = plan("IDFM:71673", "IDFM:73626", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.nodes.filter((n) => n.at === "conditional").length).toBeGreaterThan(0);
  });

  it("puts a climb in the verdict, because a hill is not a station", () => {
    const out = verdictSummary(
      t,
      "A",
      "Sacré-Cœur",
      { barriers: 0, conditional: 0, unknowns: 0 },
      walk(21, 74, 1329),
    );
    expect(out).not.toContain("verdict_clear");
    expect(out).toContain("74 verdict_climb");
  });

  it("has a real route whose only obstacle is that hill", () => {
    const result = plan("IDFM:73626", "Sacré-Cœur Basilica", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.barriers).toEqual([]);
    expect(result.route.finalWalk?.climbM ?? 0).toBeGreaterThan(20);
  });

  it("puts a long flat walk in the verdict too, because neither is a station", () => {
    // The Eiffel Tower has no rail station near it in the open feed, so the last
    // 1,451 m are flat, long, and the whole of what stands in her way. With only
    // the climb rule this line read "1 unknown".
    const out = verdictSummary(
      t,
      "Nation",
      "Eiffel Tower",
      { barriers: 0, conditional: 0, unknowns: 1 },
      walk(23, 3, 1451),
    );
    expect(out).toContain("23 verdict_walk");
    expect(out).not.toContain("verdict_climb");
  });

  it("has a real route whose only obstacle is that walk", () => {
    const result = plan("IDFM:71673", "Eiffel Tower", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.barriers).toEqual([]);
    expect(result.route.finalWalk?.minutes ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("leaves a short walk out of the line instead of crowding it", () => {
    expect(verdictSummary(t, "A", "B", { barriers: 0, conditional: 0, unknowns: 0 }, walk(9, 2, 586))).toBe(
      "A → B: verdict_clear",
    );
  });

  it("names every kind of obstacle at once rather than the worst one", () => {
    const out = verdictSummary(
      t,
      "A",
      "B",
      { barriers: 1, conditional: 2, unknowns: 3 },
      walk(30, 20, 2000),
    );
    for (const part of [
      "1 verdict_barrier",
      "2 verdict_conditional",
      "3 verdict_unknown",
      "20 verdict_climb",
      "30 verdict_walk",
    ]) {
      expect(out).toContain(part);
    }
  });
});

describe("counting what a traveller would meet", () => {
  const node = (over: Partial<RouteNode>) =>
    ({ name: "X", at: "ok", atText: { en: "", fr: "", zh: "" }, ...over }) as RouteNode;
  const route = (nodes: RouteNode[]) => ({ nodes }) as unknown as DemoRoute;

  it("counts a named barrier even when the status itself is passable", () => {
    const r = route([node({ barrier: { en: "a kerb", fr: "un trottoir", zh: "路缘" } }), node({})]);
    expect(tally(r).barriers).toBe(1);
    expect(tally(r).clear).toBe(false);
  });

  it("treats a lift that is down as a barrier rather than an unknown", () => {
    const c = tally(route([node({ at: "lift_down" }), node({ at: "unknown" })]));
    expect(c.barriers).toBe(1);
    expect(c.unknowns).toBe(1);
  });
});
