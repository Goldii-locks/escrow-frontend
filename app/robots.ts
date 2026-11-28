import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site-url";

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
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
