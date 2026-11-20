// @vitest-environment jsdom
/**
 * Landing page contract link (#855): the hero proof strip and the illustrative
 * rail link to the escrow factory, not the legacy single escrow (CONTRACT_ID).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const FACTORY = "CFACTORYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const LEGACY = "CLEGACYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

async function renderHome(factory: string) {
  vi.resetModules();
  vi.doMock("@/app/lib/network_config", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/app/lib/network_config")>()),
    CONTRACT_ID: LEGACY,
    FACTORY_CONTRACT_ID: factory,
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  }));
  vi.doMock("@/app/components/LandingNav", () => ({ default: () => <nav /> }));
  const { default: Home } = await import("@/app/(marketing)/page");
  return render(<Home />);
}

describe("landing page factory link", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("links to the factory explorer page and labels it", async () => {
    const { container } = await renderHome(FACTORY);
    expect(screen.getByText("ESCROW FACTORY")).toBeInTheDocument();
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[href*='/contract/']")
    );
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.href).toBe(`https://stellar.expert/explorer/testnet/contract/${FACTORY}`);
    }
    expect(container.innerHTML).not.toContain(LEGACY);
  });

  it("shows no explorer link when no factory is configured", async () => {
    const { container } = await renderHome("");
    expect(screen.getByText("ESCROW FACTORY")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(container.querySelector("a[href*='/contract/']")).toBeNull();
    expect(container.innerHTML).not.toContain(LEGACY);
  });
});
