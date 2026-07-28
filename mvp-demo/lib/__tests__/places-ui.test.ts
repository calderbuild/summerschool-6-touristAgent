import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLACES, ease, type Place } from "../places";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const at = (...p: string[]) => readFileSync(join(APP, ...p), "utf8");

const like = (wheelchair: string): Place => ({ ...PLACES[0], wheelchair });

/**
 * The sights page turns a sentence somebody wrote into a badge, and a badge is read
 * far more often than the sentence under it. So the classifier is the claim.
 */
describe("classifying what a wheelchair user will meet", () => {
  it("never promotes a record that contains a staircase, however it opens", () => {
    // Real string from the knowledge base. It starts with "Yes" and ends in 424 steps.
    expect(ease(like("Yes (cathedral, step-free entrance); No (towers, ~424 steps)"))).toBe("depends");
    expect(ease(like("Partial (1st & 2nd floors by lift; summit not accessible)"))).toBe("depends");
    expect(ease(like("Partial (lower chapel step-free; upper chapel via spiral stairs, not accessible)"))).toBe(
      "depends",
    );
  });

  it("reads a clean yes as a yes", () => {
    expect(ease(like("Yes (accessible)"))).toBe("yes");
    expect(ease(like("Step-free entrance (OSM wheelchair=yes)"))).toBe("yes");
  });

  it("reads a flat no as a no, and a closed venue as neither", () => {
    expect(ease(like("No (stairs only)"))).toBe("no");
    // "N/A (closed)" says nothing about a doorway, so it must not be reported as a
    // barrier at the door either.
    expect(ease(like("N/A (closed)"))).toBe("depends");
  });

  it("defaults anything it cannot read to a condition, never to yes", () => {
    for (const w of ["", "under review", "ask staff", "unknown", "sometimes"]) {
      expect(ease(like(w)), w).not.toBe("yes");
    }
  });

  it("classifies every shipped record without throwing, and calls nothing accessible on a maybe", () => {
    for (const p of PLACES) {
      const e = ease(p);
      expect(["yes", "depends", "no"]).toContain(e);
      if (e === "yes") {
        // The one invariant worth stating: a "can get in" badge may not sit on a
        // record whose own words mention stairs or a limit.
        expect(p.wheelchair.toLowerCase(), p.id).not.toMatch(/stairs|not accessible|partial/);
      }
    }
  });
});

describe("the 360 view is dated, because a photograph of a door is a claim about it", () => {
  it("stamps the capture date and warns when the imagery is old", () => {
    const src = at("components", "StreetLook.tsx");
    expect(src).toMatch(/imageDate/);
    expect(src).toMatch(/street_dated/);
    expect(src).toMatch(/STALE_AFTER_YEARS/);
    expect(src).toMatch(/street_stale/);
  });

  it("says there is no imagery rather than showing somewhere else", () => {
    const src = at("components", "StreetLook.tsx");
    expect(src).toMatch(/ZERO_RESULTS/);
    expect(src).toMatch(/street_none/);
    // Substituting a nearby panorama would be the same defect as a guessed step count.
    expect(src).not.toMatch(/radius:\s*(\d{3,})/);
  });
});

describe("the page shows what the assistant answers from", () => {
  it("reads the corrected records, not the committed ones", () => {
    expect(at("app", "places", "page.tsx")).toMatch(/livePlaces\(\)/);
  });

  it("every record it renders carries a check date", () => {
    for (const p of PLACES) {
      expect(p.lastVerified, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
