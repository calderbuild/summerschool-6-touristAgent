import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import Legal from "@/components/Legal";

export const metadata: Metadata = {
  title: "Data and accessibility: Voie Libre",
  description:
    "Where your question goes, what is stored (nothing), and how far this site's own accessibility actually reaches, written as claims you can check.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: "Data and accessibility: Voie Libre",
    description:
      "Where your question goes, what is stored, and how far this site's own accessibility actually reaches.",
  },
};

// One page for both statements. Splitting them would put the accessibility of an
// accessibility product on a page nobody opens, and the two questions get asked
// by the same person in the same breath.
export default function PrivacyPage() {
  return (
    <I18nProvider>
      <Legal />
    </I18nProvider>
  );
}
