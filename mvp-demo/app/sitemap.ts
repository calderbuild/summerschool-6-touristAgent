import type { MetadataRoute } from "next";

// Only the public pages. /admin is a password-gated console and the API
// routes are not pages, so listing either would be listing something a visitor
// cannot use.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = "https://voie-libre.vercel.app";
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/routes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/whats-on`, changeFrequency: "daily", priority: 0.7 },
    { url: `${site}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/privacy`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
