import { SOURCES, networkFacts } from "@/lib/idfm";

/**
 * The operator's accessibility record, for the browser.
 *
 * It goes through us rather than straight from the page for two reasons: the
 * result is cached once for everyone instead of once per visitor, and the
 * content security policy can keep `connect-src` down to this origin plus the
 * two map services.
 */
export const revalidate = 0;

export async function GET() {
  const facts = await networkFacts();

  if (!facts) {
    // Not a 500: the app works without this, and the page says the official
    // record could not be reached rather than showing a made-up one.
    return Response.json(
      { error: "unavailable", source: SOURCES.stations.url },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { ...facts, sources: [SOURCES.stations, SOURCES.toilets] },
    {
      headers: {
        // Six hours matches the server-side cache; a station's class changes when
        // building work finishes, not on the hour.
        "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
      },
    }
  );
}
