import { plan, NETWORK_META, type ProfileId } from "@/lib/router";

/**
 * The routing endpoint: the logic layer, on its own, addressable.
 *
 * Everything about a journey that needs deciding happens here and nowhere in the
 * components: which line, which interchange, what that interchange costs the
 * person travelling. The page's job is to draw the answer. That split is the
 * reason the same routing can serve the chat, the dashboard and anything the team
 * builds next without any of them re-implementing it.
 *
 * The graph is a committed file, so this answers from memory: no upstream call,
 * nothing to rate-limit, and no way for a slow third party to make a route take
 * four seconds on the day of the pitch.
 */

const PROFILES: ProfileId[] = ["wheelchair", "stroller", "senior", "lowenergy"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const asked = url.searchParams.get("profile") ?? "";
  const profile = (PROFILES as string[]).includes(asked)
    ? (asked as ProfileId)
    : "wheelchair";

  if (!from || !to) {
    return Response.json({ error: "missing_endpoints" }, { status: 400 });
  }

  const result = plan(from, to, profile);
  if (!result.ok) {
    // 200 with a reason, not a 404: the request was fine and the answer ("there
    // is no step-free way to do this") is the product, not a failure.
    return Response.json({ ok: false, reason: result.reason });
  }

  return Response.json(
    { ok: true, route: result.route, graphBuiltAt: NETWORK_META.builtAt },
    {
      headers: {
        // The graph only changes when the build script runs, so a day of cache
        // costs nothing and takes the repeated pitch queries off the function.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
