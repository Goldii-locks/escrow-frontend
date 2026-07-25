import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkNetworkMatch,
  clearSensitiveMemory,
  DEFAULT_SIGNATURE_TIMEOUT_MS,
  formatConsoleWarningBlock,
  formatStackTrace,
  isUserRejectedError,
  LedgerSignatureTimeoutError,
  LedgerTransactionTracker,
  ledgerTracker,
  LedgerUserRejectedError,
  logLedgerWarning,
  signCatchingRejection,
  signWithTimeout,
  warnOnLedgerNetworkMismatch,
  type LedgerSignRequest,
  type LedgerSignResult,
} from "@/app/lib/ledger_usb_bridge";

describe("ledger_usb_bridge signature timeout bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the signature arrives before the timeout", async () => {
    const request: LedgerSignRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const signFn = vi.fn(async (): Promise<LedgerSignResult> => ({
      signedXdr: "signed-xdr",
    }));

    const promise = signWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.signedXdr).toBe("signed-xdr");
    expect(request.payload).toBeNull();
  });

  it("aborts the operation and clears memory when the signature times out", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: LedgerSignRequest = {
      xdr: "AAAA...",
      payload,
    };

    const signFn = vi.fn(
      () =>
        new Promise<LedgerSignResult>(() => {
          /* never resolves — simulates hung Ledger */
        })
    );

    const promise = signWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      LedgerSignatureTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("uses the default signature timeout bound", () => {
    expect(DEFAULT_SIGNATURE_TIMEOUT_MS).toBe(60_000);
  });

  it("clearSensitiveMemory zeroes buffers and nulls the reference", () => {
    const payload = new Uint8Array([1, 1, 1]);
    const request: LedgerSignRequest = { xdr: "x", payload };
    clearSensitiveMemory(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });
});

describe("ledger_usb_bridge user rejection handling", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("detects user rejected transaction exceptions", () => {
    expect(isUserRejectedError(new LedgerUserRejectedError())).toBe(true);
    expect(isUserRejectedError(new Error("user rejected transaction"))).toBe(
      true
    );
    expect(isUserRejectedError(new Error("User Declined the request"))).toBe(
      true
    );
    expect(isUserRejectedError(new Error("device locked"))).toBe(false);
  });

  it("catches rejection errors and shows a clean warning toast", async () => {
    const showToast = vi.fn();

    const result = await signCatchingRejection(async () => {
      throw new Error("user rejected transaction");
    }, showToast);

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "Transaction cancelled — you rejected the signature on your Ledger.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[ledger_usb_bridge]");
    expect(logged).toContain("SIGNATURE REJECTED");
    expect(logged).toContain("--- stack trace ---");
    expect(logged).toContain("user rejected transaction");
  });

  it("re-throws non-rejection errors without toasting", async () => {
    const showToast = vi.fn();

    await expect(
      signCatchingRejection(async () => {
        throw new Error("USB disconnect");
      }, showToast)
    ).rejects.toThrow("USB disconnect");

    expect(showToast).not.toHaveBeenCalled();
  });

  it("returns the signed result when the user approves", async () => {
    const showToast = vi.fn();
    const result = await signCatchingRejection(
      async () => ({ signedXdr: "ok" }),
      showToast
    );
    expect(result).toEqual({ signedXdr: "ok" });
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("ledger_usb_bridge network mismatch checks", () => {
  it("reports no mismatch when networks align", () => {
    const state = checkNetworkMatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("builds a warning message when Mainnet vs Testnet diverge", () => {
    const state = checkNetworkMatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("testnet");
    expect(state.warningMessage).toMatch(/Network mismatch/i);
    expect(state.warningMessage).toMatch(/Mainnet/);
    expect(state.warningMessage).toMatch(/Testnet/);
  });
});

describe("ledger_usb_bridge console warning blocks", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    ledgerTracker.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("formats stack traces from Error instances", () => {
    const err = new Error("sign failed");
    const stack = formatStackTrace(err);

    expect(stack).toContain("Error: sign failed");
    expect(stack).toMatch(/at /);
  });

  it("builds a console warning block that includes the stack trace format", () => {
    const stack = formatStackTrace(new Error("tx debug"));
    const block = formatConsoleWarningBlock({
      title: "TX SIGNING",
      body: "Awaiting Ledger signature",
      stack,
      txId: "tx-ledger-1",
      phase: "signing",
    });

    expect(block).toContain("[ledger_usb_bridge]");
    expect(block).toContain("TX SIGNING");
    expect(block).toContain("Awaiting Ledger signature");
    expect(block).toContain("txId: tx-ledger-1");
    expect(block).toContain("phase: signing");
    expect(block).toContain("--- stack trace ---");
    expect(block).toContain("--- end stack ---");
    expect(block).toContain("Error: tx debug");
  });

  it("logs formatted warning blocks (with stack) via console.warn", () => {
    const formatted = logLedgerWarning("TX ERROR", "USB transport failed", {
      err: new Error("device busy"),
      txId: "tx-2",
      phase: "error",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toMatch(/--- stack trace ---[\s\S]*Error: device busy/);
  });

  it("tracks transaction phases and logs a warning block per phase", () => {
    const tracker = new LedgerTransactionTracker();

    tracker.track("tx-99", "building", "Preparing XDR");
    tracker.track("tx-99", "signing", "Prompting Ledger device");
    tracker.track(
      "tx-99",
      "error",
      "Ledger returned failure",
      new Error("locked device")
    );

    const history = tracker.getHistory("tx-99");
    expect(history).toHaveLength(3);
    expect(history.map((e) => e.phase)).toEqual([
      "building",
      "signing",
      "error",
    ]);
    expect(history[2].stack).toContain("Error: locked device");
    expect(warnSpy).toHaveBeenCalledTimes(3);

    const lastCall = String(warnSpy.mock.calls[2][0]);
    expect(lastCall).toContain("TX ERROR");
    expect(lastCall).toContain("--- stack trace ---");
  });

  it("warnOnLedgerNetworkMismatch logs a formatted block on mismatch", () => {
    const state = warnOnLedgerNetworkMismatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("NETWORK MISMATCH");
    expect(logged).toContain("--- stack trace ---");
  });
});
