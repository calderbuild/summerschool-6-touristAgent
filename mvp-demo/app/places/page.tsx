import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import Places from "@/components/Places";
import { livePlaces } from "@/lib/overrides.server";

// Server-rendered from the same records the assistant answers from, including any
// correction the team has made in the console, so the page and the chat can never
// disagree about what a traveller will meet at a door.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Paris sights, and whether you can actually get in",
  description:
    "Seventeen Paris sights with what a wheelchair user meets at the venue, whether the nearest station is step-free, accessible toilets, prices, hours, and the date each was checked. Plus a look at the entrance before you travel.",
  alternates: { canonical: "/places" },
  openGraph: {
    type: "website",
    url: "/places",
    title: "Paris sights, and whether you can actually get in",
    description:
      "The access facts behind the assistant's answers, with their check dates and sources, and a 360 look at each entrance.",
  },
};

export default async function Page() {
  const places = await livePlaces();
  return (
    <I18nProvider>
      <Places places={places} />
    </I18nProvider>
  );
}
