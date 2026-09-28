import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkTransactionSignerNetworkMatch,
  warnOnTransactionSignerNetworkMismatch,
  TransactionSignerNetworkMismatchError,
} from "@/app/lib/transaction_signer";

describe("transaction_signer checkTransactionSignerNetworkMatch (#216)", () => {
  it("reports no mismatch when both networks are testnet", () => {
    const state = checkTransactionSignerNetworkMatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
    expect(state.walletNetwork).toBe("testnet");
    expect(state.appNetwork).toBe("testnet");
  });

  it("reports no mismatch when both networks are mainnet", () => {
    const state = checkTransactionSignerNetworkMatch("mainnet", "mainnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("reports a mismatch when wallet is mainnet and app is testnet", () => {
    const state = checkTransactionSignerNetworkMatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.warningMessage).toContain("Network mismatch");
    expect(state.warningMessage).toContain("Mainnet");
    expect(state.warningMessage).toContain("Testnet");
  });

  it("reports a mismatch when wallet is testnet and app is mainnet", () => {
    const state = checkTransactionSignerNetworkMatch("testnet", "mainnet");
    expect(state.mismatched).toBe(true);
    expect(state.warningMessage).toContain("Network mismatch");
    expect(state.warningMessage).toContain("Testnet");
    expect(state.warningMessage).toContain("Mainnet");
  });

  it("preserves both network values in the returned state", () => {
    const state = checkTransactionSignerNetworkMatch("mainnet", "testnet");
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("testnet");
  });
});

describe("warnOnTransactionSignerNetworkMismatch (#216)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("logs a warning to the console when networks mismatch", () => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = warnOnTransactionSignerNetworkMismatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[transaction_signer]");
    expect(logged).toContain("Network mismatch");
  });

  it("does not log when networks match", () => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = warnOnTransactionSignerNetworkMismatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns the same state as checkTransactionSignerNetworkMatch", () => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const warnState = warnOnTransactionSignerNetworkMismatch(
      "mainnet",
      "testnet"
    );
    const checkState = checkTransactionSignerNetworkMatch(
      "mainnet",
      "testnet"
    );
    expect(warnState.mismatched).toBe(checkState.mismatched);
    expect(warnState.warningMessage).toBe(checkState.warningMessage);
    expect(warnState.walletNetwork).toBe(checkState.walletNetwork);
    expect(warnState.appNetwork).toBe(checkState.appNetwork);
  });
});

describe("TransactionSignerNetworkMismatchError (#216)", () => {
  it("has the correct name and message", () => {
    const err = new TransactionSignerNetworkMismatchError(
      "mainnet",
      "testnet"
    );
    expect(err.name).toBe("TransactionSignerNetworkMismatchError");
    expect(err.message).toContain("Network mismatch");
    expect(err.walletNetwork).toBe("mainnet");
    expect(err.appNetwork).toBe("testnet");
  });

  it("is an instance of Error", () => {
    const err = new TransactionSignerNetworkMismatchError(
      "testnet",
      "mainnet"
    );
    expect(err).toBeInstanceOf(Error);
  });
});
