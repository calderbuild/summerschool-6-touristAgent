import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { plan } from "../router";

const APP = resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * The card summarises a route in one line, and that line is the product. This
 * pins the rule that produced a real bug: a journey whose every stop the operator
 * marks "only with a member of staff" was summarised "step-free the whole way".
 */
describe("the one-line verdict", () => {
  it("counts a staff-conditional stop as not step-free", () => {
    const source = readFileSync(join(APP, "components", "chat", "ChatRouteCard.tsx"), "utf8");
    // The tally must include `conditional`, and "clear" must require it to be zero.
    expect(source).toMatch(/at === "conditional"/);
    expect(source).toMatch(/barriers \+ conditional \+ unknowns === 0/);
  });

  it("has real routes whose stops are staff-conditional, so the rule matters", () => {
    const result = plan("IDFM:71673", "IDFM:73626", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const conditional = result.route.nodes.filter((n) => n.at === "conditional");
    expect(conditional.length).toBeGreaterThan(0);
  });

  it("puts a climb in the verdict, because a hill is not a station", () => {
    // Every station on the wheelchair route to Sacré-Cœur can be passed, so the
    // station counts come out clean while the traveller faces 74 m of hill. If
    // the climb ever drops out of the summary, that route reads as step-free.
    const result = plan("IDFM:73626", "Sacré-Cœur Basilica", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.barriers).toEqual([]);
    expect(result.route.finalWalk?.climbM ?? 0).toBeGreaterThan(20);
    const source = readFileSync(join(APP, "components", "chat", "ChatRouteCard.tsx"), "utf8");
    expect(source).toMatch(/verdict_climb/);
    expect(readFileSync(join(APP, "components", "App.tsx"), "utf8")).toMatch(/plan_climb_1/);
  });
});
