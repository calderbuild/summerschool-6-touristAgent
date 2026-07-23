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

export const metadata: Metadata = {
  title: "Voie Libre: step-free routes across Paris",
  description:
    "Plan a step-free route across Paris. Voie Libre shows working lifts, stairs, and long walks along the way, and tells you honestly when a status is unknown.",
};

// viewport-fit: cover makes env(safe-area-inset-*) resolve to real values on
// notched phones; interactiveWidget resizes the layout for the Android keyboard
// (iOS is handled by the visualViewport effect in ChatShell).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
