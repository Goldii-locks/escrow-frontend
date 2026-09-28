import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  abortAllWalletSelectorOperations,
  clearWalletSelectorSensitiveMemory,
  DEFAULT_WALLET_SELECTOR_TIMEOUT_MS,
  getPendingWalletSelectorOperationCount,
  getPendingWalletSelectorWalletIds,
  signWithWalletSelectorTimeout,
  WalletSelectorTimeoutError,
  type WalletSelectorSignRequest,
} from "@/app/lib/wallet_selector_modal";

const hang = () => new Promise<string>(() => {});

describe("wallet_selector_modal — transaction timeout clocks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    abortAllWalletSelectorOperations();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("resolves when the signature arrives before the clock fires", async () => {
    const request: WalletSelectorSignRequest = {
      walletId: "freighter",
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const promise = signWithWalletSelectorTimeout(
      request,
      async () => "signed-xdr",
      5_000
    );
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("signed-xdr");
  });

  it("forwards the XDR to the provider callback", async () => {
    const signFn = vi.fn(async (xdr: string) => xdr);
    const promise = signWithWalletSelectorTimeout(
      { walletId: "albedo", xdr: "SELECTOR-XDR" },
      signFn,
      5_000
    );
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("SELECTOR-XDR");
    expect(signFn).toHaveBeenCalledWith("SELECTOR-XDR", expect.any(AbortSignal));
  });

  it("clears sensitive payload memory after a successful signature", async () => {
    const payload = new Uint8Array([5, 6, 7, 8]);
    const request: WalletSelectorSignRequest = {
      walletId: "xbull",
      xdr: "BBBB...",
      payload,
    };

    const promise = signWithWalletSelectorTimeout(
      request,
      async () => "ok",
      5_000
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("does not abort the signal on a successful signature", async () => {
    let captured: AbortSignal | undefined;
    const promise = signWithWalletSelectorTimeout(
      { walletId: "hana", xdr: "CCCC..." },
      async (_xdr, signal) => {
        captured = signal;
        return "ok";
      },
      5_000
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(captured?.aborted).toBe(false);
  });

  it("does not fire the clock before the deadline", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "freighter", xdr: "DDDD..." },
      () =>
        new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 500)),
      1_000
    );
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
  });

  // -------------------------------------------------------------------------
  // Timeout: abort + memory clearing
  // -------------------------------------------------------------------------

  it("aborts the operation and clears memory on timeout", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: WalletSelectorSignRequest = {
      walletId: "freighter",
      xdr: "EEEE...",
      payload,
    };

    const promise = signWithWalletSelectorTimeout(request, hang, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("signals the provider abort signal on timeout", async () => {
    let captured: AbortSignal | undefined;

    const promise = signWithWalletSelectorTimeout(
      { walletId: "albedo", xdr: "FFFF..." },
      (_xdr, signal) => {
        captured = signal;
        return hang();
      },
      1_000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(captured?.aborted).toBe(true);
  });

  it("names the wallet and the duration in the timeout error", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "ledger", xdr: "GGGG..." },
      hang,
      2_000
    );
    const assertion = expect(promise).rejects.toThrow(
      'Wallet "ledger" signature timed out after 2000ms'
    );

    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
  });

  it("logs a console warning describing the aborted operation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const promise = signWithWalletSelectorTimeout(
      { walletId: "xbull", xdr: "HHHH..." },
      hang,
      1_000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("[wallet_selector_modal]");
    expect(String(warn.mock.calls[0][0])).toContain("SIGNATURE TIMEOUT");
  });

  it("times out cleanly when the request carries no payload", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "hana", xdr: "IIII..." },
      hang,
      500
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("falls back to the default bound for a non-positive timeout", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "freighter", xdr: "JJJJ..." },
      hang,
      0
    );
    const assertion = expect(promise).rejects.toThrow(
      `${DEFAULT_WALLET_SELECTOR_TIMEOUT_MS}ms`
    );

    await vi.advanceTimersByTimeAsync(DEFAULT_WALLET_SELECTOR_TIMEOUT_MS);
    await assertion;
  });

  // -------------------------------------------------------------------------
  // Timer / registry cleanup
  // -------------------------------------------------------------------------

  it("cancels the pending timer after a successful resolution", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const promise = signWithWalletSelectorTimeout(
      { walletId: "freighter", xdr: "KKKK..." },
      async () => "done",
      5_000
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("tracks the operation while it is in flight", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "albedo", xdr: "LLLL..." },
      hang,
      1_000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    expect(getPendingWalletSelectorOperationCount()).toBe(1);
    expect(getPendingWalletSelectorWalletIds()).toEqual(["albedo"]);

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("empties the pending registry after a timeout", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "albedo", xdr: "MMMM..." },
      hang,
      1_000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(getPendingWalletSelectorOperationCount()).toBe(0);
  });

  it("empties the pending registry after a successful signature", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "hana", xdr: "NNNN..." },
      async () => "ok",
      5_000
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(getPendingWalletSelectorOperationCount()).toBe(0);
  });

  it("empties the pending registry after a provider rejection", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "hana", xdr: "OOOO..." },
      async () => {
        throw new Error("user rejected");
      },
      5_000
    );
    const assertion = expect(promise).rejects.toThrow("user rejected");

    await vi.runAllTimersAsync();
    await assertion;

    expect(getPendingWalletSelectorOperationCount()).toBe(0);
  });

  it("tracks several concurrent requests independently", async () => {
    const first = signWithWalletSelectorTimeout(
      { walletId: "freighter", xdr: "P1" },
      hang,
      1_000
    );
    const second = signWithWalletSelectorTimeout(
      { walletId: "albedo", xdr: "P2" },
      hang,
      2_000
    );
    const assertions = Promise.all([
      expect(first).rejects.toBeInstanceOf(WalletSelectorTimeoutError),
      expect(second).rejects.toBeInstanceOf(WalletSelectorTimeoutError),
    ]);

    expect(getPendingWalletSelectorWalletIds()).toEqual([
      "freighter",
      "albedo",
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    await assertions;

    expect(getPendingWalletSelectorOperationCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // abortAllWalletSelectorOperations — modal close / unmount
  // -------------------------------------------------------------------------

  it("aborts every in-flight request when the modal closes", async () => {
    let captured: AbortSignal | undefined;
    const promise = signWithWalletSelectorTimeout(
      { walletId: "freighter", xdr: "QQQQ" },
      (_xdr, signal) => {
        captured = signal;
        return hang();
      },
      10_000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    expect(abortAllWalletSelectorOperations()).toBe(1);
    expect(captured?.aborted).toBe(true);
    expect(getPendingWalletSelectorOperationCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("returns 0 when there is nothing to abort", () => {
    expect(abortAllWalletSelectorOperations()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Non-timeout error propagation
  // -------------------------------------------------------------------------

  it("re-throws provider errors unchanged", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "ledger", xdr: "RRRR" },
      async () => {
        throw new Error("device disconnected");
      },
      5_000
    );
    const assertion = expect(promise).rejects.toThrow("device disconnected");

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("provider errors are not WalletSelectorTimeoutError", async () => {
    const promise = signWithWalletSelectorTimeout(
      { walletId: "ledger", xdr: "SSSS" },
      async () => {
        throw new Error("user rejected");
      },
      5_000
    );
    const assertion = expect(promise).rejects.not.toBeInstanceOf(
      WalletSelectorTimeoutError
    );

    await vi.runAllTimersAsync();
    await assertion;
  });

  // -------------------------------------------------------------------------
  // Helpers and constants
  // -------------------------------------------------------------------------

  it("DEFAULT_WALLET_SELECTOR_TIMEOUT_MS is 60 seconds", () => {
    expect(DEFAULT_WALLET_SELECTOR_TIMEOUT_MS).toBe(60_000);
  });

  it("clearWalletSelectorSensitiveMemory zeroes and nulls the payload", () => {
    const payload = new Uint8Array([1, 1, 1]);
    const request: WalletSelectorSignRequest = {
      walletId: "freighter",
      xdr: "x",
      payload,
    };
    expect(clearWalletSelectorSensitiveMemory(request)).toBe(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });

  it("clearWalletSelectorSensitiveMemory tolerates a missing payload", () => {
    const request: WalletSelectorSignRequest = {
      walletId: "freighter",
      xdr: "x",
    };
    expect(() => clearWalletSelectorSensitiveMemory(request)).not.toThrow();
    expect(request.payload).toBeNull();
  });

  it("clearWalletSelectorSensitiveMemory zeroes a large buffer completely", () => {
    const payload = new Uint8Array(256).fill(0xff);
    clearWalletSelectorSensitiveMemory({
      walletId: "freighter",
      xdr: "x",
      payload,
    });
    expect(payload.every((b) => b === 0)).toBe(true);
  });

  it("WalletSelectorTimeoutError exposes the bound and wallet id", () => {
    const err = new WalletSelectorTimeoutError(3_000, "albedo");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WalletSelectorTimeoutError");
    expect(err.timeoutMs).toBe(3_000);
    expect(err.walletId).toBe("albedo");
  });

  it("WalletSelectorTimeoutError falls back to generic copy without a wallet id", () => {
    expect(new WalletSelectorTimeoutError(1_000).message).toBe(
      "Wallet signature timed out after 1000ms"
    );
  });
});
