import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { contrastRatio, lineTextColor, luminance } from "../status";

const NET = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "network.json"), "utf8"),
) as { lines: { short?: string; name?: string; color?: string }[] };

/**
 * The line badge is the most repeated piece of colour in this product, and it sits
 * in the middle of the route spine, so it is the last place that should be hard to
 * read on a product about access.
 *
 * It was. The old rule switched from white to black at a luminance of 0.5, which is
 * the common guess; black and white actually give equal contrast at 0.179, so every
 * mid-tone line got white text for being "darker than half". Metro line 8 measured
 * 2.74:1 in the browser. This runs the same check over every line the graph knows.
 */
describe("every line badge is readable", () => {
  const lines = NET.lines.filter((l) => typeof l.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(l.color));

  it("has line colours to check", () => {
    expect(lines.length).toBeGreaterThan(20);
  });

  it("meets 4.5:1 on every line in the network", () => {
    const failures: string[] = [];
    for (const l of lines) {
      const hex = l.color!.startsWith("#") ? l.color! : `#${l.color}`;
      const r = contrastRatio(luminance(lineTextColor(hex)), luminance(hex));
      if (r < 4.5) failures.push(`${l.short ?? l.name} ${hex} -> ${r.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("picks the better of black and white rather than a threshold", () => {
    // A mid-tone that the old 0.5 rule got wrong: white reads 2.7:1 here, black 7.7:1.
    const mid = "#8b6bb1";
    const chosen = luminance(lineTextColor(mid));
    const other = lineTextColor(mid) === "#ffffff" ? luminance("#000000") : luminance("#ffffff");
    expect(contrastRatio(chosen, luminance(mid))).toBeGreaterThanOrEqual(contrastRatio(other, luminance(mid)));
  });
});
