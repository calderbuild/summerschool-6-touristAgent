import type { DemoRoute } from "./data";

/**
 * The one line a traveller actually reads, kept where it can be tested.
 *
 * This lived inside the chat card, which made it the least testable string in the
 * product and also the most dangerous one: it is the sentence that says whether a
 * journey is possible. It has been wrong twice, both times by the same mechanism.
 * It summarised statuses and did not know `conditional` existed, so a journey
 * every stop of which the operator marks "only with a member of staff" was called
 * step-free. Then it summarised statuses and a climb, so 1,451 m of flat pushing
 * to the Eiffel Tower came out as "1 unknown".
 *
 * The lesson is structural rather than a list of fixes: a verdict derived from a
 * subset of the route's fields is blind to every field the route later gains. So
 * it is a pure function of (counts, finalWalk) here, and `verdict.test.ts` states
 * the cases in words. Add a field to the route and add a case here.
 */

export interface Counts {
  barriers: number;
  conditional: number;
  unknowns: number;
  clear: boolean;
}

/** How many nodes of each kind the traveller would meet. */
export function tally(route: DemoRoute): Counts {
  const barriers = route.nodes.filter(
    (n) => n.barrier || n.at === "stairs" || n.at === "lift_down",
  ).length;
  const conditional = route.nodes.filter((n) => n.at === "conditional").length;
  const unknowns = route.nodes.filter((n) => n.at === "unknown").length;
  return { barriers, conditional, unknowns, clear: barriers + conditional + unknowns === 0 };
}

/** Minutes of walking at the end that are worth naming in one line. */
const WALK_MINUTES = 10;
/** Metres of climb likewise. Both thresholds are ours, and both are stated. */
const CLIMB_METRES = 8;

export function verdictSummary(
  t: (k: string) => string,
  from: string,
  to: string,
  counts: Pick<Counts, "barriers" | "conditional" | "unknowns">,
  finalWalk?: { metres: number; climbM: number | null; minutes: number } | null,
): string {
  const parts: string[] = [];
  if (counts.barriers > 0) parts.push(`${counts.barriers} ${t("verdict_barrier")}`);
  if (counts.conditional > 0) parts.push(`${counts.conditional} ${t("verdict_conditional")}`);
  if (counts.unknowns > 0) parts.push(`${counts.unknowns} ${t("verdict_unknown")}`);
  // A hill is not a station and neither is twenty minutes of pushing, so the
  // counts above cannot carry either. The walk's own duration comes from the
  // walking model, so the same hill reads as longer for a wheelchair than for
  // somebody with a stroller, which is the whole point of having profiles.
  if (finalWalk && finalWalk.climbM !== null && finalWalk.climbM >= CLIMB_METRES) {
    parts.push(`${finalWalk.climbM} ${t("verdict_climb")}`);
  }
  if (finalWalk && finalWalk.minutes >= WALK_MINUTES) {
    parts.push(`${finalWalk.minutes} ${t("verdict_walk")}`);
  }
  return `${from} → ${to}: ${parts.length ? parts.join(" · ") : t("verdict_clear")}`;
}
