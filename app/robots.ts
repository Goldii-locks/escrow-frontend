import type { MetadataRoute } from "next";

// `output: export` requires metadata route handlers to be fully static.
export const dynamic = "force-static";

/**
 * robots.txt for the Milestone static export.
 *
 * The landing page (`/`) is the only public, crawlable surface. The app
 * routes — `/admin`, `/create`, `/dashboard` — require a connected wallet and
 * carry no indexable content, so they are disallowed.
 *
 * Next.js writes this to `out/robots.txt` during `next build` (output: export),
 * and nginx serves it from the root via the `try_files $uri ...` location.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/create", "/dashboard"],
    },
    sitemap: "https://milestonepay.app/sitemap.xml",
  };
}
