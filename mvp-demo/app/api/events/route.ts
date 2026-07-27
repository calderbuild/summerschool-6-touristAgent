import { EVENT_SOURCE, cityEvents, joinCounts, rank } from "@/lib/events";

/**
 * What is on in Paris this week, with the journey attached.
 *
 * Two records per event and they are never merged: `access` is the city's claim
 * about the venue, `station` is ours about getting there. A single green tick
 * covering both would be a claim nobody published.
 */
export const revalidate = 0;

export async function GET(request: Request) {
  const feed = await cityEvents();

  if (!feed) {
    return Response.json(
      { error: "unavailable", source: EVENT_SOURCE.url },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 40), 1), 200);
  const events = rank(feed.events).slice(0, limit);

  return Response.json(
    {
      fetchedAt: feed.fetchedAt,
      source: EVENT_SOURCE,
      totals: feed.totals,
      // Counted over the events actually held, not over the whole dataset, and
      // labelled that way wherever it is printed. This is the join: what the
      // city says about the venue against what the operator says about the way
      // in. Neither dataset can produce it alone.
      join: joinCounts(feed.events),
      held: feed.events.length,
      events,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
