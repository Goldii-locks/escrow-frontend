import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectWalletExtensionById,
  checkWalletAvailabilityById,
  disconnectWalletWithCheck,
  runWalletDisconnectWithTimeout,
  WalletDisconnectTimeoutError,
  walletActiveKeysStore,
  type PendingTxSnapshot,
} from "@/app/lib/wallet_disconnect_handler";

// ---------------------------------------------------------------------------
// detectWalletExtensionById
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler detectWalletExtensionById (#task-4)", () => {
  beforeEach(() => {
    walletActiveKeysStore.clear();
  });

  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["freighterApi"];
    delete w["freighter"];
    delete w["albedo"];
    delete w["albedoApi"];
    delete w["xBullSDK"];
    delete w["hanaWallet"];
    delete w["hana"];
  });

  it("returns false when no wallet globals are present for freighter", () => {
    expect(detectWalletExtensionById("freighter")).toBe(false);
  });

  it("returns true when freighterApi is present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectWalletExtensionById("freighter")).toBe(true);
  });

  it("returns true when freighter is present", () => {
    (window as unknown as Record<string, unknown>)["freighter"] = {};
    expect(detectWalletExtensionById("freighter")).toBe(true);
  });

  it("returns false when no wallet globals are present for albedo", () => {
    expect(detectWalletExtensionById("albedo")).toBe(false);
  });

  it("returns true when albedo is present", () => {
    (window as unknown as Record<string, unknown>)["albedo"] = {};
    expect(detectWalletExtensionById("albedo")).toBe(true);
  });

  it("returns true when albedoApi is present", () => {
    (window as unknown as Record<string, unknown>)["albedoApi"] = {};
    expect(detectWalletExtensionById("albedo")).toBe(true);
  });

  it("returns false when no wallet globals are present for xbull", () => {
    expect(detectWalletExtensionById("xbull")).toBe(false);
  });

  it("returns true when xBullSDK is present", () => {
    (window as unknown as Record<string, unknown>)["xBullSDK"] = {};
    expect(detectWalletExtensionById("xbull")).toBe(true);
  });

  it("returns false when no wallet globals are present for hana", () => {
    expect(detectWalletExtensionById("hana")).toBe(false);
  });

  it("returns true when hanaWallet is present", () => {
    (window as unknown as Record<string, unknown>)["hanaWallet"] = {};
    expect(detectWalletExtensionById("hana")).toBe(true);
  });

  it("returns true when hana is present", () => {
    (window as unknown as Record<string, unknown>)["hana"] = {};
    expect(detectWalletExtensionById("hana")).toBe(true);
  });

  it("honours an injected detector callback returning true", () => {
    expect(detectWalletExtensionById("freighter", () => true)).toBe(true);
  });

  it("honours an injected detector callback returning false", () => {
    expect(detectWalletExtensionById("freighter", () => false)).toBe(false);
  });

  it("uses the detector callback even when wallet globals are present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectWalletExtensionById("freighter", () => false)).toBe(false);
  });

  it("propagates the error when the detector throws", () => {
    expect(() =>
      detectWalletExtensionById("freighter", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });

  it("returns false for an unknown wallet ID", () => {
    expect(detectWalletExtensionById("unknown-wallet")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkWalletAvailabilityById
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler checkWalletAvailabilityById (#task-4)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    walletActiveKeysStore.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("returns available=true when wallet is present (freighter)", () => {
    const result = checkWalletAvailabilityById("freighter", () => true);
    expect(result.available).toBe(true);
    expect(result.setupInstruction).toBeNull();
    expect(result.installUrl).toBeNull();
  });

  it("returns available=true when wallet is present (albedo)", () => {
    const result = checkWalletAvailabilityById("albedo", () => true);
    expect(result.available).toBe(true);
    expect(result.setupInstruction).toBeNull();
    expect(result.installUrl).toBeNull();
  });

  it("returns available=false with setup instructions when wallet is missing (freighter)", () => {
    const result = checkWalletAvailabilityById("freighter", () => false);
    expect(result.available).toBe(false);
    expect(result.setupInstruction).not.toBeNull();
    expect(result.setupInstruction).toMatch(/freighter/i);
    expect(result.setupInstruction).toMatch(/install/i);
    expect(result.setupInstruction).toMatch(/refresh/i);
    expect(result.installUrl).toContain("freighter.app");
  });

  it("returns available=false with setup instructions when wallet is missing (albedo)", () => {
    const result = checkWalletAvailabilityById("albedo", () => false);
    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/albedo/i);
    expect(result.installUrl).toContain("albedo.link");
  });

  it("returns available=false with setup instructions when wallet is missing (xbull)", () => {
    const result = checkWalletAvailabilityById("xbull", () => false);
    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/xbull/i);
  });

  it("returns available=false with setup instructions when wallet is missing (hana)", () => {
    const result = checkWalletAvailabilityById("hana", () => false);
    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/hana/i);
  });

  it("returns fallback instructions for an unknown wallet ID", () => {
    const result = checkWalletAvailabilityById("unknown-wallet", () => false);
    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/wallet extension not found/i);
    expect(result.installUrl).toBeNull();
  });

  it("returns error status with fallback messages when the detector throws", () => {
    const result = checkWalletAvailabilityById("freighter", () => {
      throw new Error("detector boom");
    });
    expect(result.available).toBe(false);
    expect(result.setupInstruction).not.toBeNull();
    expect(result.installUrl).toContain("freighter.app");
    expect(errorSpy).toHaveBeenCalled();
    // The actual Error object must be passed so the stack trace is preserved.
    const [firstArg, secondArg] = errorSpy.mock.calls[0];
    expect(String(firstArg)).toContain("[wallet_disconnect_handler]");
    expect(secondArg).toBeInstanceOf(Error);
    expect((secondArg as Error).message).toBe("detector boom");
  });

  it("does not log when the wallet is available", () => {
    checkWalletAvailabilityById("freighter", () => true);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("does not log when the wallet is simply missing (unavailable)", () => {
    checkWalletAvailabilityById("freighter", () => false);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disconnectWalletWithCheck
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler disconnectWalletWithCheck (#task-4)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    walletActiveKeysStore.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("returns success=true when wallet is available and disconnect succeeds", async () => {
    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true,
    );
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.fallbackInstructions).toBeNull();
    expect(result.installUrl).toBeNull();
    expect(disconnectFn).toHaveBeenCalled();
  });

  it("returns fallbackInstructions when wallet is not installed", async () => {
    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => false,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeNull();
    expect(result.fallbackInstructions).not.toBeNull();
    expect(result.fallbackInstructions).toMatch(/freighter/i);
    expect(result.fallbackInstructions).toMatch(/install/i);
    expect(result.installUrl).toContain("freighter.app");
    expect(disconnectFn).not.toHaveBeenCalled();
  });

  it("skips disconnect for albedo when not installed", async () => {
    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "albedo",
      disconnectFn,
      () => false,
    );
    expect(result.success).toBe(false);
    expect(result.fallbackInstructions).toMatch(/albedo/i);
    expect(result.installUrl).toContain("albedo.link");
    expect(disconnectFn).not.toHaveBeenCalled();
  });

  it("skips disconnect for xbull when not installed", async () => {
    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "xbull",
      disconnectFn,
      () => false,
    );
    expect(result.success).toBe(false);
    expect(result.fallbackInstructions).toMatch(/xbull/i);
    expect(disconnectFn).not.toHaveBeenCalled();
  });

  it("skips disconnect for hana when not installed", async () => {
    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "hana",
      disconnectFn,
      () => false,
    );
    expect(result.success).toBe(false);
    expect(result.fallbackInstructions).toMatch(/hana/i);
    expect(disconnectFn).not.toHaveBeenCalled();
  });

  it("returns error when disconnect function throws", async () => {
    const disconnectFn = vi.fn(async () => {
      throw new Error("extension crashed");
    });
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("extension crashed");
    expect(result.fallbackInstructions).toBeNull();
    expect(result.installUrl).toBeNull();
    // console.error must be called (not warn) so the stack trace is preserved.
    expect(errorSpy).toHaveBeenCalled();
    const [firstArg, secondArg] = errorSpy.mock.calls[0];
    expect(String(firstArg)).toContain("[wallet_disconnect_handler]");
    expect(String(firstArg)).toContain("DISCONNECT FAILED");
    // The actual Error object must be the second argument so stack is visible.
    expect(secondArg).toBeInstanceOf(Error);
    expect((secondArg as Error).message).toBe("extension crashed");
  });

  it("returns error with non-Error thrown value", async () => {
    const disconnectFn = vi.fn(async () => {
      throw "string error";
    });
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error during wallet disconnect.");
  });

  it("logs a warning when wallet is not installed", async () => {
    const disconnectFn = vi.fn(async () => {});
    await disconnectWalletWithCheck("freighter", disconnectFn, () => false);
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[wallet_disconnect_handler]");
    expect(logged).toContain("not installed");
  });

  // -------------------------------------------------------------------------
  // Issue #241 — structured console error/warn + transaction debug tracking
  // -------------------------------------------------------------------------

  it("#241: successful disconnect with no pending tx produces no console.error output", async () => {
    const disconnectFn = vi.fn(async () => {});
    await disconnectWalletWithCheck("freighter", disconnectFn, () => true);
    expect(errorSpy).not.toHaveBeenCalled();
    // The success log is informational, so it goes to console.info rather
    // than warn/error.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0][0])).toContain("disconnected successfully");
  });

  it("#241: disconnect that encounters a cleanup error logs console.error with the actual error object", async () => {
    const boom = new Error("SDK exploded");
    const disconnectFn = vi.fn(async () => {
      throw boom;
    });
    await disconnectWalletWithCheck("freighter", disconnectFn, () => true);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [firstArg, secondArg] = errorSpy.mock.calls[0];
    // Tag must be present and greppable.
    expect(String(firstArg)).toContain("[wallet_disconnect_handler]");
    expect(String(firstArg)).toContain("DISCONNECT FAILED");
    // The actual Error object (with stack) must be the second argument.
    expect(secondArg).toBe(boom);
    expect(secondArg).toBeInstanceOf(Error);
    expect((secondArg as Error).stack).toBeDefined();
  });

  it("#241: disconnect while a transaction is pending logs console.warn with transaction identifying info", async () => {
    const disconnectFn = vi.fn(async () => {});
    const pending: PendingTxSnapshot = {
      txId: "abc123hash",
      status: "signing",
      context: "payment",
    };
    await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true,
      // #357 already claimed the 4th slot for timeout options, so pendingTx
      // sits after it.
      undefined,
      pending,
    );

    // The pending-tx notice is the only console.warn on this path -- the
    // success line is informational and goes to console.info.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [pendingArg, pendingDetail] = warnSpy.mock.calls[0];
    expect(String(pendingArg)).toContain("[wallet_disconnect_handler]");
    expect(String(pendingArg)).toContain("DISCONNECT WITH PENDING TRANSACTION");
    // Transaction identifying fields must be present in the logged object.
    expect(pendingDetail).toMatchObject({
      txId: "abc123hash",
      status: "signing",
      context: "payment",
    });
  });
});

describe("wallet_disconnect_handler timeout bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts a stalled operation and clears payload and listeners", async () => {
    let signal: AbortSignal | undefined;
    const payload = new Uint8Array([1, 2, 3]);
    const cleanup = vi.fn();
    const operation = runWalletDisconnectWithTimeout(
      (operationSignal) => {
        signal = operationSignal;
        return new Promise<never>(() => {});
      },
      { timeoutMs: 100, request: { payload }, cleanup },
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(operation).rejects.toBeInstanceOf(WalletDisconnectTimeoutError);
    expect(signal?.aborted).toBe(true);
    expect([...payload]).toEqual([0, 0, 0]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears payload, listeners, and the timer when the operation succeeds", async () => {
    const payload = new Uint8Array([4, 5]);
    const cleanup = vi.fn();

    await expect(
      runWalletDisconnectWithTimeout(
        async () => "disconnected",
        { timeoutMs: 100, request: { payload }, cleanup },
      ),
    ).resolves.toBe("disconnected");

    expect([...payload]).toEqual([0, 0]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a timeout error from disconnectWalletWithCheck and aborts its provider", async () => {
    let signal: AbortSignal | undefined;
    const payload = new Uint8Array([9]);
    const cleanup = vi.fn();
    const resultPromise = disconnectWalletWithCheck(
      "freighter",
      (operationSignal) => {
        signal = operationSignal;
        return new Promise<void>(() => {});
      },
      () => true,
      { timeoutMs: 50, request: { payload }, cleanup },
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out after 50ms/);
    expect(signal?.aborted).toBe(true);
    expect([...payload]).toEqual([0]);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
