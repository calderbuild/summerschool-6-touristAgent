import type { Status } from "./data";

export function statusColorVar(s: Status): string {
  if (s === "ok" || s === "lift") return "var(--color-ok)";
  if (s === "lift_down" || s === "stairs") return "var(--color-barrier)";
  return "var(--color-unknown)";
}

// Kept in lockstep with the CSS tokens (used for imperative Google Maps markers,
// which can't read CSS vars). Unknown darkened to #616671 to match --color-unknown.
export function statusHex(s: Status): string {
  if (s === "ok" || s === "lift") return "#1e8e5a";
  if (s === "lift_down" || s === "stairs") return "#c63a2f";
  return "#616671";
}

// Readable text colour for a transit-line badge, chosen by the line colour's
// luminance: RATP yellow lines (M1, RER C) need near-black text; darker lines
// (M14, M4, RER B) read best in white. Keeps line bullets legible, not just on-brand.
export function lineTextColor(hex: string): string {
  const h = hex.replace("#", "");
  const c = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(c(0)) + 0.7152 * lin(c(2)) + 0.0722 * lin(c(4));
  return L > 0.5 ? "#1a1c22" : "#ffffff";
}

export const isBarrier = (s: Status) => s === "lift_down" || s === "stairs";
export const isUnknown = (s: Status) => s === "unknown";

export const legendKey: Record<Status, string> = {
  ok: "legend_ok",
  lift: "legend_lift",
  lift_down: "legend_liftdown",
  stairs: "legend_stairs",
  unknown: "legend_unknown",
};
