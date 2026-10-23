import type { MetadataRoute } from "next";

// `output: export` requires metadata route handlers to be fully static.
export const dynamic = "force-static";

/**
 * sitemap.xml for the Milestone static export.
 *
 * Only the landing page is indexable. The app routes (`/admin`, `/create`,
 * `/dashboard`) require a wallet and are disallowed in robots.txt, so they
 * are intentionally absent here.
 *
 * Next.js writes this to `out/sitemap.xml` during `next build` (output: export),
 * and nginx serves it from the root via the `try_files $uri ...` location.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://milestonepay.app",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
