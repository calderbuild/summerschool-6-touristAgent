import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import HowItWorks from "@/components/HowItWorks";

// In the product rather than only in the pitch: two of the things we are asked
// to demonstrate are claims about how this was built, and a claim a juror can
// check while using the app is worth more than the same claim on a slide.
export const metadata: Metadata = {
  title: "How Voie Libre works: data, model and the checks on both",
  description:
    "Every technology choice with the reason it was chosen, where the accessibility data comes from, and the checks that keep the assistant from inventing a lift.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "website",
    url: "/how-it-works",
    title: "How Voie Libre works: data, model and the checks on both",
    description:
      "Every technology choice with its reason, where the data comes from, and the checks that keep the assistant from inventing a lift.",
  },
};

export default function HowItWorksPage() {
  return (
    <I18nProvider>
      <HowItWorks />
    </I18nProvider>
  );
}
