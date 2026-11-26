/**
 * Unit tests for the OpenGraph / Twitter metadata constants (Task 4).
 *
 * Imports from app/lib/site_metadata rather than app/layout so we don't
 * pull in next/font (which only works inside the Next.js build pipeline).
 *
 * Verifies:
 *  - metadataBase is set to an https:// URL
 *  - og:image is a relative /…png path (resolved by metadataBase, never localhost)
 *  - explicit 1200×630 dimensions
 *  - og:url is set to an https:// URL
 *  - Twitter image also points to the PNG
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

async function loadMetadata(siteUrl?: string): Promise<Metadata> {
  vi.resetModules();
  if (siteUrl !== undefined) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  }
  const { buildMetadata } = await import("@/app/lib/site_metadata");
  return buildMetadata();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ── metadataBase ──────────────────────────────────────────────────────────────

describe("site_metadata — metadataBase", () => {
  it("defaults to https://milestonepay.app when NEXT_PUBLIC_SITE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const metadata = await loadMetadata("");
    const base = metadata.metadataBase as URL;
    expect(base).toBeInstanceOf(URL);
    expect(base.protocol).toBe("https:");
    expect(base.hostname).toBe("milestonepay.app");
  });

  it("honours a custom NEXT_PUBLIC_SITE_URL", async () => {
    const metadata = await loadMetadata("https://staging.milestonepay.app");
    const base = metadata.metadataBase as URL;
    expect(base.toString()).toContain("staging.milestonepay.app");
  });
});

// ── og:image ──────────────────────────────────────────────────────────────────

describe("site_metadata — og:image", () => {
  it("URL ends with .png, not .svg", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const images = (metadata.openGraph as { images?: unknown[] })?.images ?? [];
    expect(images.length).toBeGreaterThan(0);
    const first = images[0] as { url: string };
    expect(first.url).toMatch(/\.png$/);
    expect(first.url).not.toMatch(/\.svg/);
  });

  it("is a relative path (resolved by metadataBase, not hardcoded absolute)", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const images = (metadata.openGraph as { images?: unknown[] })?.images ?? [];
    const first = images[0] as { url: string };
    expect(first.url).toMatch(/^\//);
    expect(first.url).not.toContain("localhost");
    expect(first.url).not.toMatch(/^https?:\/\//);
  });

  it("has explicit 1200×630 dimensions", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const images = (metadata.openGraph as { images?: unknown[] })?.images ?? [];
    const first = images[0] as { width: number; height: number };
    expect(first.width).toBe(1200);
    expect(first.height).toBe(630);
  });

  it("has non-empty alt text", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const images = (metadata.openGraph as { images?: unknown[] })?.images ?? [];
    const first = images[0] as { alt: string };
    expect(typeof first.alt).toBe("string");
    expect(first.alt.length).toBeGreaterThan(0);
  });
});

// ── og:url ────────────────────────────────────────────────────────────────────

describe("site_metadata — og:url", () => {
  it("is an https:// string", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const url = (metadata.openGraph as { url?: string })?.url;
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^https:\/\//);
    expect(url).not.toContain("localhost");
  });

  it("reflects NEXT_PUBLIC_SITE_URL", async () => {
    const metadata = await loadMetadata("https://staging.milestonepay.app");
    const url = (metadata.openGraph as { url?: string })?.url;
    expect(url).toContain("staging.milestonepay.app");
  });
});

// ── twitter:image ─────────────────────────────────────────────────────────────

describe("site_metadata — twitter:image", () => {
  it("points to .png, not .svg", async () => {
    const metadata = await loadMetadata("https://milestonepay.app");
    const images = (metadata.twitter as { images?: unknown[] })?.images ?? [];
    expect(images.length).toBeGreaterThan(0);
    const first = images[0] as { url: string };
    expect(first.url).toMatch(/\.png$/);
  });
});
