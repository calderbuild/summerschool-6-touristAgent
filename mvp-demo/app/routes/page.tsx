import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import App from "@/components/App";
import { plan, COVERAGE, NETWORK_META } from "@/lib/router";

// Its own title and canonical: this page gets linked directly (it is the one
// that shows a whole route at once), and inheriting the root's metadata meant
// two different pages sharing one title and one canonical URL.
export const metadata: Metadata = {
  title: "Step-free routes across Paris: Voie Libre",
  description:
    "Plan a step-free journey between any two of 945 Paris stations, stop by stop: the operator's accessibility class and platform flags at every change, where the stairs are, how far the walk is, and where the status is honestly unknown.",
  alternates: { canonical: "/routes" },
  openGraph: {
    type: "website",
    url: "/routes",
    title: "Step-free routes across Paris: Voie Libre",
    description:
      "Plan a step-free journey between any two of 945 Paris stations, stop by stop: which changes you can actually get through, where the stairs are, and where the status is honestly unknown.",
  },
};

// The visual route planner (profile picker + journey pickers + spine + map). The
// chat at "/" is the primary interface; this is the direct way to plan a journey.
//
// The first route is computed here, on the server, rather than fetched by the
// browser after paint. It means the page arrives with a real answer on it instead
// of an empty frame, and the client never runs a search it did not ask for.
const OPENING = { from: "IDFM:73626", to: "Eiffel Tower" } as const;

/**
 * `?to=` lets another page hand a journey over, which is how the week's events
 * become routes: the listing knows the station, and this page can already plan
 * one. An unknown value is not an error here, it simply falls back to the
 * opening journey, because a bad link should still land somebody on a working
 * page rather than an error state.
 */
export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.to;
  const asked = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 80).trim();
  const to = asked || OPENING.to;
  const attempt = asked ? plan(OPENING.from, asked, "wheelchair") : null;
  const first = attempt?.ok ? attempt : plan(OPENING.from, OPENING.to, "wheelchair");
  return (
    <I18nProvider>
      <App
        initialFrom={OPENING.from}
        initialFromLabel="Gare de Lyon"
        initialTo={attempt?.ok ? to : OPENING.to}
        initialRoute={first.ok ? first.route : null}
        graphBuiltAt={NETWORK_META.builtAt}
        coverage={COVERAGE}
      />
    </I18nProvider>
  );
}
