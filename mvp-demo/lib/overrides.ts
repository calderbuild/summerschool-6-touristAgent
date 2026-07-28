import { PLACES, type Place } from "./places";

/**
 * The knowledge base, plus whatever the team has corrected since the last deploy.
 *
 * `PLACES` stays the base and the authority on shape: it ships with the code, it
 * is reviewed in a pull request, and it is what the assistant answers from when
 * this table is empty, unconfigured or unreachable. An override is one row saying
 * "somebody went and looked, and the committed line is wrong", which used to mean
 * waiting for a deploy to fix a lift that had been boarded up for a month.
 *
 * Only the fields a person can actually go and verify are overridable, every one
 * is nullable, and null means "no correction". So an edit to one field cannot
 * quietly blank the rest of a record, which is the failure mode of a merge layer
 * that stores whole rows.
 *
 * Fail open, like every other feed in this app: on any error the committed data is
 * returned unchanged. A correction that does not load is a stale answer, and a
 * stale answer is a great deal better than no answer to somebody standing outside
 * a station.
 *
 * This half is pure, and it is pure on purpose. The staff console renders the
 * corrected record in the browser, so it imports `apply` from here; the reading of
 * the table lives in `overrides.server.ts`, which touches `next/headers` and would
 * break the client build if it travelled with the merge. Keeping the two apart is
 * also what lets the console and the model's prompt agree by construction: they run
 * the same function over the same rows.
 */

export interface Override {
  place_id: string;
  wheelchair: string | null;
  station_step_free: string | null;
  notes: string | null;
  status: "open" | "closed" | null;
  last_verified: string | null;
  hidden: boolean;
  updated_at: string;
  updated_by: string | null;
}

/** One place with its correction applied, or unchanged when there is none. */
export function apply(place: Place, row: Override | undefined): Place {
  if (!row) return place;
  return {
    ...place,
    wheelchair: row.wheelchair ?? place.wheelchair,
    stationStepFree: row.station_step_free ?? place.stationStepFree,
    notes: row.notes ?? place.notes,
    status: row.status ?? place.status,
    lastVerified: row.last_verified ?? place.lastVerified,
    // The correction's own provenance replaces the committed line's, because the
    // whole claim of this product is that a reader can tell where a fact came
    // from and when. A staff correction that kept the old source string would be
    // citing a check that did not produce this value.
    source: row.last_verified
      ? `Staff console${row.updated_by ? ` (${row.updated_by})` : ""}, checked ${row.last_verified}`
      : place.source,
  };
}

/**
 * Every place the assistant may talk about, corrected, with hidden ones removed.
 *
 * Hiding is not the same as marking closed: `status: "closed"` is a fact about the
 * venue that a traveller benefits from hearing, while hidden means we no longer
 * trust our own record enough to repeat it at all.
 */
export function merge(rows: Override[]): Place[] {
  if (rows.length === 0) return PLACES;
  const byId = new Map(rows.map((r) => [r.place_id, r]));
  return PLACES.filter((p) => !byId.get(p.id)?.hidden).map((p) => apply(p, byId.get(p.id)));
}
