// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const FACTORY = "C" + "F".repeat(55);
const LEGACY = "C" + "L".repeat(55);
const TESTNET = "Test SDF Network ; September 2015";

vi.mock("@/app/components/LandingNav", () => ({ default: () => <nav /> }));

async function renderHome(factoryId: string) {
  vi.resetModules();
  vi.doMock("@/app/lib/network_config", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/app/lib/network_config")>()),
    CONTRACT_ID: LEGACY,
    FACTORY_CONTRACT_ID: factoryId,
    NETWORK_PASSPHRASE: TESTNET,
  }));
  const { default: Home } = await import("@/app/(marketing)/page");
  return render(<Home />);
}

afterEach(() => {
  vi.doUnmock("@/app/lib/network_config");
});

describe("landing page contract link (#855)", () => {
  it("shows the escrow factory and links to it on Stellar Expert", async () => {
    const { container } = await renderHome(FACTORY);

    expect(screen.getByText("ESCROW FACTORY")).toBeInTheDocument();
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[href*='stellar.expert']")
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.href).toBe(`https://stellar.expert/explorer/testnet/contract/${FACTORY}`);
    }
    expect(screen.getByText(/^CFFFFF.*FFFFFFF$/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(LEGACY.slice(0, 6) + "...");
  });

  it("hides the explorer links when no factory is configured", async () => {
    const { container } = await renderHome("");

    expect(container.querySelector("a[href*='stellar.expert']")).toBeNull();
    expect(screen.queryByText("View on Stellar Expert")).not.toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(LEGACY);
  });
});
