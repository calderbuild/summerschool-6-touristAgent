import type { Status } from "./data";

export function statusColorVar(s: Status): string {
  if (s === "ok" || s === "lift") return "var(--color-ok)";
  if (s === "conditional") return "var(--color-caution)";
  if (s === "lift_down" || s === "stairs") return "var(--color-barrier)";
  return "var(--color-unknown)";
}

// Kept in lockstep with the CSS tokens (used for imperative Google Maps markers,
// which can't read CSS vars). Unknown darkened to #616671 to match --color-unknown.
export function statusHex(s: Status): string {
  if (s === "ok" || s === "lift") return "#1e8e5a";
  if (s === "conditional") return "#c77a16";
  if (s === "lift_down" || s === "stairs") return "#c63a2f";
  return "#616671";
}

// Readable text colour for a transit-line badge, chosen by the line colour's
// luminance: RATP yellow lines (M1, RER C) need near-black text; darker lines
// (M14, M4, RER B) read best in white. Keeps line bullets legible, not just on-brand.
/** Relative luminance of a hex colour, per WCAG 2.x. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const c = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c(0)) + 0.7152 * lin(c(2)) + 0.0722 * lin(c(4));
}

/** Contrast ratio between two luminances, per WCAG 2.x. */
export const contrastRatio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * True black rather than the ink token, and only here.
 *
 * Three official colours (RER A, RER D and tram T6) land between 4.26 and 4.38
 * against #1a1c22, just under the 4.5 this product claims. The alternative was to
 * darken the operators' own brand colours, which would make a line badge a slightly
 * wrong shade of the thing people recognise on the network. Taking the text to true
 * black instead costs nothing anybody can see at this size and carries all three
 * over. Nothing else in the app uses it.
 */
const INK = "#000000";
const PAPER = "#ffffff";

/**
 * Black or white on a line's own colour, whichever a person can actually read.
 *
 * This used to switch at a luminance of 0.5, which is the usual guess and is wrong.
 * The point where black and white give identical contrast is L = 0.179, so every
 * mid-tone line in the palette got white text on the strength of being "darker than
 * half". Metro line 8 came out at 2.74:1, well under the 4.5:1 this product claims
 * to meet, on the line badge in the middle of the route spine. Black on that same
 * colour is over 7:1.
 *
 * Comparing the two ratios directly is both correct and self-explaining, and it
 * cannot drift the way a magic threshold can.
 */
export function lineTextColor(hex: string): string {
  const bg = luminance(hex);
  return contrastRatio(luminance(INK), bg) >= contrastRatio(luminance(PAPER), bg) ? INK : PAPER;
}

export const isBarrier = (s: Status) => s === "lift_down" || s === "stairs";
export const isUnknown = (s: Status) => s === "unknown";

export const legendKey: Record<Status, string> = {
  ok: "legend_ok",
  lift: "legend_lift",
  conditional: "legend_conditional",
  lift_down: "legend_liftdown",
  stairs: "legend_stairs",
  unknown: "legend_unknown",
};
