import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import App from "@/components/App";

// Its own title and canonical: this page gets linked directly (it is the one
// that shows a whole route at once), and inheriting the root's metadata meant
// two different pages sharing one title and one canonical URL.
export const metadata: Metadata = {
  title: "Step-free routes across Paris: Voie Libre",
  description:
    "Three step-free routes across Paris, stop by stop: which lifts work, where the stairs are, how far the walk is, and where the status is honestly unknown.",
  alternates: { canonical: "/routes" },
  openGraph: {
    type: "website",
    url: "/routes",
    title: "Step-free routes across Paris: Voie Libre",
    description:
      "Three step-free routes across Paris, stop by stop: which lifts work, where the stairs are, and where the status is honestly unknown.",
  },
};

// The visual route browser (profile picker + spine + map). The chat at "/" is
// the primary interface; this stays as a direct way to browse all prepared routes.
export default function RoutesPage() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
