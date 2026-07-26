import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--ff-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const body = Atkinson_Hyperlegible({
  variable: "--ff-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--ff-mono",
  subsets: ["latin"],
  display: "swap",
});

// The one canonical host. Every absolute URL below is built from it, so the
// canonical link and og:url can never drift apart or point at a preview
// deployment, whose URL changes on every push.
const SITE = "https://voie-libre.vercel.app";

const DESCRIPTION =
  "Plan a step-free route across Paris. Voie Libre shows working lifts, stairs, and long walks along the way, and tells you honestly when a status is unknown.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Voie Libre: step-free routes across Paris",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // This link is the deliverable. It gets pasted into a jury's chat, an
  // instructor's inbox and the team's own group, and until now every one of
  // those showed a bare URL with no title, no summary and no picture. The image
  // is generated in opengraph-image.tsx from the same palette as the app.
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Voie Libre",
    title: "Voie Libre: step-free routes across Paris",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voie Libre: step-free routes across Paris",
    description: DESCRIPTION,
  },
};

// viewport-fit: cover makes env(safe-area-inset-*) resolve to real values on
// notched phones; interactiveWidget resizes the layout for the Android keyboard
// (iOS is handled by the visualViewport effect in ChatShell).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Matches the navy header band, so on a phone the browser's own chrome
  // continues the app instead of sitting above it in a different colour.
  themeColor: "#12202e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-body">
        {children}
      </body>
    </html>
  );
}
