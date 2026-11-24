import { describe, expect, it } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import { assertWalletNetwork, buildNetworkMismatchMessage } from "@/app/lib/network";

describe("assertWalletNetwork", () => {
  it("returns null when the wallet matches the app on testnet", () => {
    expect(assertWalletNetwork(Networks.TESTNET, "Freighter", Networks.TESTNET)).toBeNull();
  });

  it("returns null when the wallet matches the app on mainnet", () => {
    expect(assertWalletNetwork(Networks.PUBLIC, "Freighter", Networks.PUBLIC)).toBeNull();
  });

  it("reports a mainnet wallet against a testnet app", () => {
    expect(assertWalletNetwork(Networks.PUBLIC, "Freighter", Networks.TESTNET)).toBe(
      "Network mismatch: your Freighter is on Mainnet but this app expects Stellar Testnet. Please switch networks."
    );
  });

  it("reports a testnet wallet against a mainnet app", () => {
    expect(assertWalletNetwork(Networks.TESTNET, "Albedo", Networks.PUBLIC)).toBe(
      buildNetworkMismatchMessage(Networks.TESTNET, "Albedo", Networks.PUBLIC)
    );
    expect(buildNetworkMismatchMessage(Networks.TESTNET, "Albedo", Networks.PUBLIC)).toContain(
      "expects Stellar Mainnet"
    );
  });

  it("defaults to the configured NETWORK_PASSPHRASE", () => {
    expect(assertWalletNetwork(Networks.TESTNET)).toBeNull();
    expect(assertWalletNetwork(Networks.PUBLIC)).toContain("your wallet is on Mainnet");
  });
});
