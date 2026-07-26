import type { MetadataRoute } from "next";

// The console is behind a password and the API routes are not pages, so there is
// nothing in either for a crawler to do. /admin also carries a noindex, which is
// what actually keeps it out of results; this just stops the crawl.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: "https://voie-libre.vercel.app/sitemap.xml",
  };
}
