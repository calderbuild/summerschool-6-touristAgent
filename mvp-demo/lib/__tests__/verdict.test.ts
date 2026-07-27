import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { plan } from "../router";

/**
 * The card summarises a route in one line, and that line is the product. This
 * pins the rule that produced a real bug: a journey whose every stop the operator
 * marks "only with a member of staff" was summarised "step-free the whole way".
 */
describe("the one-line verdict", () => {
  it("counts a staff-assisted stop as not step-free", () => {
    const source = readFileSync("components/chat/ChatRouteCard.tsx", "utf8");
    // The tally must include `assisted`, and "clear" must require it to be zero.
    expect(source).toMatch(/at === "assisted"/);
    expect(source).toMatch(/barriers \+ assisted \+ unknowns === 0/);
  });

  it("has real routes whose stops are staff-assisted, so the rule matters", () => {
    const result = plan("IDFM:71673", "IDFM:73626", "wheelchair");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const assisted = result.route.nodes.filter((n) => n.at === "assisted");
    expect(assisted.length).toBeGreaterThan(0);
  });
});
