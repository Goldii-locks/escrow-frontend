// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/(marketing)/page";
import { NETWORK_PASSPHRASES } from "@/app/lib/network_config";

const { config } = vi.hoisted(() => ({
  config: {
    passphrase: "",
    contractId: "CAAAAAZPKRQA6LYJ3OF7TDM5JACVJOH5MS4CSUGQNCRXKS5GRM72M5L5",
  },
}));

vi.mock("@/app/lib/network_config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/network_config")>()),
  get NETWORK_PASSPHRASE() {
    return config.passphrase;
  },
  CONTRACT_ID: config.contractId,
}));

// Historical claims corrected in #617. Keep this list in sync with the landing copy fixes.
const falseClaims = [
  /consent from both sides is recorded on-chain first/i,
  /neither party can move the finish line alone/i,
  /the most sensitive overrides are multisig-gated/i,
  /can be locked so it cannot change mid-project/i,
  /every milestone carries a deadline/i,
  /records each milestone.s amount and deadline/i,
  /a clock neither side can quietly reset/i,
  /once the review window closes, the provider claims auto-release/i,
  /(?:partially released milestones can (?:still )?be auto-released|claim auto-release (?:even )?(?:for|on) partially released milestones)/i,
];

describe("landing page", () => {
  it.each([
    [NETWORK_PASSPHRASES.TESTNET, "TESTNET", "testnet"],
    [NETWORK_PASSPHRASES.PUBLIC, "MAINNET", "public"],
  ])("renders the badge and contract links for %s", (passphrase, badge, explorerNetwork) => {
    config.passphrase = passphrase;
    const { container } = render(<Home />);
    const explorerUrl = `https://stellar.expert/explorer/${explorerNetwork}/contract/${config.contractId}`;

    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(nav.getByText(badge, { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on stellar expert/i })).toHaveAttribute(
      "href",
      explorerUrl
    );
    const facts = within(screen.getByRole("region", { name: "Project facts" }));
    expect(facts.getByRole("link", { name: "CAAAAA…M72M5L5" })).toHaveAttribute(
      "href",
      explorerUrl
    );

    expect(facts.getByRole("link", { name: "Open source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/Goldii-locks/escrow-contract"
    );

    const copy = (container.textContent ?? "").replace(/\s+/g, " ");
    for (const claim of falseClaims) {
      expect(copy).not.toMatch(claim);
    }
  });
});
