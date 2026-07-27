import { suggest } from "@/lib/router";

/**
 * What the two journey pickers offer while somebody types.
 *
 * It lives on the server for one reason: the graph is 745 stations and the phone
 * should not download it to autocomplete three letters.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  return Response.json(
    { results: suggest(q, 8) },
    { headers: { "Cache-Control": "public, s-maxage=86400" } },
  );
}
