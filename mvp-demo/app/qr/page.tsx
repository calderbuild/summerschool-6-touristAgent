import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import QrPoster from "@/components/QrPoster";

// Static: this is the one page that has to render when the hall's wifi is poor,
// because its whole job is getting somebody onto a working phone.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Open Voie Libre on your phone",
  description:
    "A QR code and the plain address for Voie Libre, the step-free Paris travel assistant. No sign-in and nothing you type is stored.",
  alternates: { canonical: "/qr" },
  // Nothing to gain from this in search results, and it would compete with the
  // pages that actually answer something.
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <I18nProvider>
      <QrPoster />
    </I18nProvider>
  );
}
