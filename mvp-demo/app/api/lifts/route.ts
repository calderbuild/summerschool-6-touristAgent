import { liftFeed, liftsConfigured } from "@/lib/lifts";

/**
 * Live lift state, and an honest answer when there is none.
 *
 * This endpoint exists before the token does, on purpose. Unconfigured it returns
 * `live: false` with an empty list and a sentence saying why, so the interface can
 * distinguish "no lift is broken" from "we cannot see the lifts", which are
 * completely different things to tell someone in a wheelchair.
 *
 * `seenStatuses` is the payload that matters on the very first authenticated
 * call: it reports every distinct value the operator's `liftstatus` field
 * actually takes. Those values go into `VERIFIED_STATUSES` in lib/lifts.ts, and
 * only then does the app start calling a lift working or out. Until then every
 * lift reads `unknown` with the operator's own wording beside it.
 */
export async function GET() {
  const feed = await liftFeed();
  return Response.json(
    {
      live: feed.live,
      configured: liftsConfigured(),
      fetchedAt: feed.fetchedAt,
      count: feed.lifts.length,
      // What the enum really is, so nobody has to guess it.
      seenStatuses: feed.seenStatuses,
      classified: {
        working: feed.lifts.filter((l) => l.status === "working").length,
        out: feed.lifts.filter((l) => l.status === "out").length,
        unknown: feed.lifts.filter((l) => l.status === "unknown").length,
      },
      lifts: feed.lifts,
      note: liftsConfigured()
        ? "Live from Île-de-France Mobilités etat-des-ascenseurs (Licence Mobilité)."
        : "No IDFM_PRIM_TOKEN is set, so this app cannot see lift state. It says so rather than implying every lift works.",
    },
    {
      headers: {
        // Short, because a lift changes in minutes. The upstream quota is the
        // real limit and lib/lifts.ts holds the 15 minute cache that respects it.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
