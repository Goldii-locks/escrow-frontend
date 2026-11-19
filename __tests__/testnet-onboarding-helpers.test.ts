/**
 * Unit tests for the pure helpers in app/lib/testnet_onboarding.ts.
 * No DOM needed — runs in the default Node environment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the network_config so isTestnet() can be driven by the test.
// ---------------------------------------------------------------------------
vi.mock("@/app/lib/network_config", () => ({
  NETWORK_PASSPHRASES: {
    TESTNET: "Test SDF Network ; September 2015",
    PUBLIC: "Public Global Stellar Network ; September 2015",
    FUTURENET: "Test SDF Future Network ; October 2022",
  },
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  CONTRACT_ID: "",
  FACTORY_CONTRACT_ID: "",
}));

vi.mock("@/app/lib/config", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  RPC_URL: "https://soroban-testnet.stellar.org",
  createRpcServer: vi.fn(),
}));

import { isTestnet, fundWithFriendbot, FRIENDBOT_URL } from "@/app/lib/testnet_onboarding";

// ---------------------------------------------------------------------------
// isTestnet()
// ---------------------------------------------------------------------------
describe("isTestnet()", () => {
  it("returns true when NETWORK_PASSPHRASE matches testnet", () => {
    expect(isTestnet()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fundWithFriendbot()
// ---------------------------------------------------------------------------
describe("fundWithFriendbot()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when Friendbot returns HTTP 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await expect(fundWithFriendbot("GCTEST")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      `${FRIENDBOT_URL}?addr=GCTEST`
    );
  });

  it("throws with status code when Friendbot returns a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ detail: "rate limited" }),
    });
    await expect(fundWithFriendbot("GCTEST")).rejects.toThrow(/HTTP 429/);
    await expect(fundWithFriendbot("GCTEST")).rejects.toThrow(/rate limited/);
  });

  it("URL-encodes the address", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await fundWithFriendbot("G+SPECIAL");
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("G%2BSPECIAL");
  });
});
