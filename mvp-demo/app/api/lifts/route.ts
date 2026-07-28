import { liftCounts, liftFeed, liftsConfigured, liftsOut } from "@/lib/lifts";

/**
 * Live lift state, and an honest answer when there is none.
 *
 * This endpoint existed before the token did, on purpose. Unconfigured it returns
 * `live: false` with an empty list and a sentence saying why, so the interface can
 * distinguish "no lift is broken" from "we cannot see the lifts", which are
 * completely different things to tell someone in a wheelchair. Nothing in the
 * interface had to change when the token arrived; the page had been asking all
 * along.
 *
 * `seenStatuses` is still reported, because it is the check that the enum in
 * `VERIFIED_STATUSES` has not drifted: a value appearing here that is not in that
 * map means the operator added a state and every lift in it currently reads
 * `unknown`.
 */
export async function GET() {
  const feed = await liftFeed();
  const counts = liftCounts(feed);
  return Response.json(
    {
      live: feed.live,
      configured: liftsConfigured(),
      fetchedAt: feed.fetchedAt,
      count: counts.total,
      // What the enum really is, so nobody has to guess it.
      seenStatuses: feed.seenStatuses,
      classified: { working: counts.working, out: counts.out, unknown: counts.unknown },
      // The broken ones on their own, because that is the answer someone came for.
      out: liftsOut(feed),
      lifts: feed.lifts,
      note: liftsConfigured()
        ? "Live from Île-de-France Mobilités etat-des-ascenseurs (Licence Mobilité, dataset token)."
        : "No IDFM_DATASET_TOKEN is set, so this app cannot see lift state. It says so rather than implying every lift works.",
    },
    {
      headers: {
        // Short, because a lift changes in minutes. lib/lifts.ts holds the ten
        // minute in-process cache, so a burst of readers costs one upstream call.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
