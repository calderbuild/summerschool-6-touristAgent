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

export const isBarrier = (s: Status) => s === "lift_down" || s === "stairs";
export const isUnknown = (s: Status) => s === "unknown";

export const legendKey: Record<Status, string> = {
  ok: "legend_ok",
  lift: "legend_lift",
  lift_down: "legend_liftdown",
  stairs: "legend_stairs",
  unknown: "legend_unknown",
};
