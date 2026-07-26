import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import NotFound from "@/components/NotFound";

export const metadata: Metadata = {
  title: "Page not found: Voie Libre",
  // A 404 that gets indexed is worse than one that does not exist.
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <I18nProvider>
      <NotFound />
    </I18nProvider>
  );
}
