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
});
