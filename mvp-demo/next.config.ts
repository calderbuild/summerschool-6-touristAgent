import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * Every host named below is one this app genuinely talks to, and the list is
 * short because the app deliberately has few dependencies. Anything not on it is
 * refused by the browser, which is the point: if a script ever ends up on a page
 * here that wants to send data somewhere else, it fails instead of succeeding
 * quietly.
 *
 * The two map libraries are why this is not simply 'self'. Google Maps loads
 * further scripts and tiles from its own domains after the first one; MapLibre
 * fetches vector tiles and glyphs from OpenFreeMap and runs its decoder in a
 * worker built from a blob. Both were verified against the running app rather
 * than assumed, because a CSP that is wrong is invisible until a map goes blank
 * in front of an audience.
 */
const CSP = [
  "default-src 'self'",
  // Next inlines a bootstrap script and the Maps loader writes further script
  // tags; neither can be nonced without giving up static rendering.
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",
  // Tailwind arrives as a stylesheet, but both map libraries set inline styles
  // on the elements they draw.
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts at build time, so there is no external font host.
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://tiles.openfreemap.org",
  // The browser calls our own API routes plus the two tile services. Open-Meteo
  // is absent on purpose: the weather is fetched server-side.
  "connect-src 'self' https://maps.googleapis.com https://tiles.openfreemap.org",
  // MapLibre decodes vector tiles in a worker it creates from a blob.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No other site may frame this one: reframing an accessibility route inside
  // someone else's page is a way to show a traveller a lift status that is not
  // ours. Our own origin is allowed, which is worth nothing to an attacker (to
  // use it they would already have to be serving from this domain) and is how
  // the phone layout gets checked at a true 390px, since window resizing is
  // clamped by the OS and lies about having worked.
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Vercel already sends HSTS. These are the ones it does not.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The pre-CSP equivalent of frame-ancestors above, kept in step with it.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Other sites get our origin, never the path. A route someone planned
          // is not something to hand to a third party in a Referer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app asks for the microphone, for voice input, and nothing else.
          // Every other capability is denied here rather than left to a default.
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
