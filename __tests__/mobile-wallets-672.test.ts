/**
 * Tests for issue #672: WalletConnect and LOBSTR mobile wallet support
 *
 * Verifies that LOBSTR and WalletConnect are supported, named in the network
 * mismatch message, and that WalletConnect is only offered when configured.
 */
import { afterEach, describe, it, expect, vi } from "vitest";

import { Networks } from "@stellar/stellar-sdk";
import { SUPPORTED_WALLETS } from "@/app/context/WalletContext";
import { assertWalletNetwork } from "@/app/lib/network";

function labelFor(id: string): string | undefined {
  return SUPPORTED_WALLETS.find((w) => w.id === id)?.label;
}

describe("Issue #672 – mobile wallet network mismatch messages", () => {
  it("names LOBSTR in the mismatch message", () => {
    const msg = assertWalletNetwork(Networks.PUBLIC, labelFor("lobstr"), Networks.TESTNET);
    expect(msg).toMatch(/your LOBSTR is on Mainnet/);
    expect(msg).toMatch(/expects Stellar Testnet/);
  });

  it("names WalletConnect in the mismatch message", () => {
    const msg = assertWalletNetwork(Networks.PUBLIC, labelFor("wallet_connect"), Networks.TESTNET);
    expect(msg).toMatch(/your WalletConnect is on Mainnet/);
  });

  it("falls back to a generic name for unknown wallets", () => {
    const msg = assertWalletNetwork(Networks.PUBLIC, labelFor("unknown_wallet"), Networks.TESTNET);
    expect(msg).toMatch(/your wallet is on Mainnet/);
  });

  it("every supported wallet gets a mismatch message, and none when networks match", () => {
    for (const { label } of SUPPORTED_WALLETS) {
      expect(assertWalletNetwork(Networks.PUBLIC, label, Networks.TESTNET)).toMatch(
        /Network mismatch/
      );
      expect(assertWalletNetwork(Networks.TESTNET, label, Networks.TESTNET)).toBeNull();
    }
  });
});

describe("wallet selector list (#672)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("supports LOBSTR and WalletConnect", async () => {
    const { SUPPORTED_WALLETS } = await import("@/app/context/WalletContext");
    const ids = SUPPORTED_WALLETS.map((w) => w.id);
    expect(ids).toContain("lobstr");
    expect(ids).toContain("wallet_connect");
  });

  it("hides WalletConnect when no project ID is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    const { isWalletSelectable } = await import("@/app/components/WalletSelectorModal");
    expect(isWalletSelectable({ id: "wallet_connect" })).toBe(false);
    expect(isWalletSelectable({ id: "lobstr" })).toBe(true);
  });

  it("offers WalletConnect when a project ID is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "test-project-id");
    const { isWalletSelectable } = await import("@/app/components/WalletSelectorModal");
    expect(isWalletSelectable({ id: "wallet_connect" })).toBe(true);
  });
});
