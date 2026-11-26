import type { MetadataRoute } from "next";

// `output: export` requires metadata route handlers to be fully static.
export const dynamic = "force-static";

/**
 * robots.txt for the Milestone static export.
 *
 * Crawlers can fetch app pages to read their noindex directives.
 *
 * Next.js writes this to `out/robots.txt` during `next build` (output: export),
 * and nginx serves it from the root via the `try_files $uri ...` location.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://milestonepay.app/sitemap.xml",
  };
}
