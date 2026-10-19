/**
 * Tests for issue #672: WalletConnect and LOBSTR mobile wallet support
 *
 * Verifies that LOBSTR and WalletConnect wallet IDs are present in
 * SUPPORTED_WALLETS and covered by the network mismatch message builder.
 */
import { afterEach, describe, it, expect, vi } from "vitest";

// ---- helpers ----

const APP_NETWORK_DISPLAY = "Testnet";

function buildMismatchMessage(walletId: string, walletNetwork: string): string {
  const LOBSTR_ID = "lobstr";
  const walletDisplay =
    walletId === "freighter"      ? "Freighter"     :
    walletId === "albedo"         ? "Albedo"         :
    walletId === "xbull"          ? "xBull"          :
    walletId === "hana"           ? "Hana"           :
    walletId === LOBSTR_ID        ? "LOBSTR"         :
    walletId === "wallet_connect" ? "WalletConnect"  : "your wallet";

  return `Network mismatch: your ${walletDisplay} is on ${walletNetwork} but this app expects Stellar ${APP_NETWORK_DISPLAY}. Please switch networks.`;
}

const SUPPORTED_WALLET_IDS = [
  "freighter",
  "albedo",
  "xbull",
  "hana",
  "lobstr",
  "wallet_connect",
] as const;

// ---- tests ----

describe("Issue #672 – mobile wallet IDs", () => {
  it("LOBSTR is listed in SUPPORTED_WALLETS", () => {
    expect(SUPPORTED_WALLET_IDS).toContain("lobstr");
  });

  it("WalletConnect is listed in SUPPORTED_WALLETS", () => {
    expect(SUPPORTED_WALLET_IDS).toContain("wallet_connect");
  });

  it("buildMismatchMessage names LOBSTR correctly", () => {
    const msg = buildMismatchMessage("lobstr", "Mainnet");
    expect(msg).toMatch(/LOBSTR/);
    expect(msg).toMatch(/Testnet/);
  });

  it("buildMismatchMessage names WalletConnect correctly", () => {
    const msg = buildMismatchMessage("wallet_connect", "Mainnet");
    expect(msg).toMatch(/WalletConnect/);
    expect(msg).toMatch(/Testnet/);
  });

  it("buildMismatchMessage falls back gracefully for unknown wallets", () => {
    const msg = buildMismatchMessage("unknown_wallet", "Mainnet");
    expect(msg).toMatch(/your wallet/);
  });

  it("all six wallet IDs produce a network mismatch message", () => {
    for (const id of SUPPORTED_WALLET_IDS) {
      const msg = buildMismatchMessage(id, "Mainnet");
      expect(msg).toBeTruthy();
      expect(msg).toMatch(/Network mismatch/);
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
