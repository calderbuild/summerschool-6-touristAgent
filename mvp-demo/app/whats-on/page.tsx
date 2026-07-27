import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import WhatsOn from "@/components/WhatsOn";
import { cityEvents, joinCounts, rank } from "@/lib/events";

// Computed on the server like /routes, so the page arrives with the week's real
// listing on it rather than an empty frame that fills in after paint. It also
// means the join numbers are in the HTML, where anybody can check them without
// running the app.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "What is on in Paris this week, and whether you can get there",
  description:
    "The city's own events feed joined to the transport operator's accessibility register: which of this week's wheelchair-accessible events have a step-free station, which need a booking or a member of staff, and which the city says nothing about.",
  alternates: { canonical: "/whats-on" },
  openGraph: {
    type: "website",
    url: "/whats-on",
    title: "What is on in Paris this week, and whether you can get there",
    description:
      "Paris publishes an accessibility flag on every event. The transport operator publishes one on every station. Joined, they answer a question neither can answer alone.",
  },
};

export default async function WhatsOnPage() {
  const feed = await cityEvents();
  const ranked = feed ? rank(feed.events) : [];
  const cityYes = ranked.filter((e) => e.access.wheelchair === "yes");

  // Two lists rather than one, because one list sorted best-first buried the
  // whole point: the 89 events with a step-free station filled the page and not
  // one of the 73 with a station that needs a booking was visible, while the
  // text underneath promised the reader they would be. A page that states its
  // thesis and then shows only the easy half is making a claim it does not keep.
  const reachable = cityYes.filter((e) => e.station.status === "ok" || e.station.status === "lift").slice(0, 12);
  const tension = cityYes.filter((e) => e.station.status !== "ok" && e.station.status !== "lift").slice(0, 8);

  return (
    <I18nProvider>
      <WhatsOn
        feed={feed ? { fetchedAt: feed.fetchedAt, totals: feed.totals } : null}
        reachable={reachable}
        tension={tension}
        join={feed ? joinCounts(feed.events) : null}
        held={feed ? feed.events.length : 0}
      />
    </I18nProvider>
  );
}
