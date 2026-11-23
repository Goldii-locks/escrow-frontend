/**
 * site_metadata — the app's static OpenGraph / Twitter metadata constants.
 *
 * Extracted into its own module so unit tests can import and assert on the
 * metadata values without pulling in `next/font` (which does not work outside
 * the Next.js build pipeline).
 */
import type { Metadata } from "next";

/**
 * `metadataBase` resolves relative OG/Twitter image URLs to an absolute
 * `https://` origin so social crawlers receive a valid URL. Supply
 * `NEXT_PUBLIC_SITE_URL` at build time (e.g. `https://milestonepay.app`);
 * falls back to the production domain when the env var is absent.
 */
export function buildSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  return new URL(raw && raw.length > 0 ? raw : "https://milestonepay.app");
}

export function buildMetadata(): Metadata {
  const siteUrl = buildSiteUrl();

  return {
    metadataBase: siteUrl,
    title: {
      default: "Milestone Escrow",
      template: "%s · Milestone Escrow",
    },
    description: "Trustless milestone-based escrow on Stellar",
    openGraph: {
      type: "website",
      siteName: "Milestone Escrow",
      title: "Milestone Escrow",
      description: "Trustless milestone-based escrow on Stellar",
      url: siteUrl.toString(),
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Milestone Escrow — trustless milestone-based escrow on Stellar",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Milestone Escrow",
      description: "Trustless milestone-based escrow on Stellar",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Milestone Escrow — trustless milestone-based escrow on Stellar",
        },
      ],
    },
  };
}
