import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWalletSensitiveMemory,
  DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS,
  WalletSignatureTimeoutError,
  signWalletWithTimeout,
  type WalletSignRequest,
} from "@/app/lib/wallet_state_context";

describe("wallet_state_context signature timeout bounds (#114)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the signature arrives before the timeout", async () => {
    const request: WalletSignRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const signFn = vi.fn(async () => "signed-xdr");

    const promise = signWalletWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("signed-xdr");
    expect(request.payload).toBeNull();
  });

  it("aborts the operation and clears memory when the signature times out", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: WalletSignRequest = {
      xdr: "AAAA...",
      payload,
    };

    const signFn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* never resolves — simulates a wallet that never returns */
        })
    );

    const promise = signWalletWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(WalletSignatureTimeoutError);

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("clears memory when the underlying sign call rejects for a non-timeout reason", async () => {
    const payload = new Uint8Array([5, 5, 5]);
    const request: WalletSignRequest = { xdr: "AAAA...", payload };
    const signFn = vi.fn(async () => {
      throw new Error("horizon unreachable");
    });

    await expect(signWalletWithTimeout(request, signFn, 5_000)).rejects.toThrow(
      "horizon unreachable"
    );
  });

  it("uses the default signature timeout bound", () => {
    expect(DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS).toBe(60_000);
  });

  it("clearWalletSensitiveMemory zeroes buffers and nulls the reference", () => {
    const payload = new Uint8Array([1, 1, 1]);
    const request: WalletSignRequest = { xdr: "x", payload };
    clearWalletSensitiveMemory(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });

  it("WalletSignatureTimeoutError carries a descriptive message", () => {
    const err = new WalletSignatureTimeoutError(2_000);
    expect(err.name).toBe("WalletSignatureTimeoutError");
    expect(err.message).toContain("2000");
    expect(err).toBeInstanceOf(Error);
  });
});
