import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS,
  WalletSignatureTimeoutError,
  readTransactionMaxTimeSecs,
  signWalletWithTimeout,
} from "@/app/lib/wallet_state_context";
import { formatTxError, isSignatureTimeoutError } from "@/app/lib/errors";
import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// #628 — single signing timeout, owned by WalletContext
//
// These tests exercise the single timeout implementation in
// `signWalletWithTimeout` and the `formatTxError` mapping that collapses the
// legacy `TxSignatureTimeoutError` and the current
// `WalletSignatureTimeoutError` into one alert path. Fake timers are used so
// the suite is deterministic and does not depend on wall-clock timing.
// ---------------------------------------------------------------------------

describe("signWalletWithTimeout — single timeout source (#628)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with WalletSignatureTimeoutError after the bound elapses", async () => {
    const signFn = vi.fn(() => new Promise<string>(() => {}));
    const promise = signWalletWithTimeout({ xdr: "XDR" }, signFn, 1_000);

    const assertion = expect(promise).rejects.toBeInstanceOf(WalletSignatureTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    // The wallet was asked once; the timeout is the only error raised.
    expect(signFn).toHaveBeenCalledTimes(1);
  });

  it("surfaces exactly one error: the alert state is set from WalletSignatureTimeoutError", async () => {
    const signFn = vi.fn(() => new Promise<string>(() => {}));
    const promise = signWalletWithTimeout({ xdr: "XDR" }, signFn, 500);

    let caught: unknown = null;
    promise.catch((e) => {
      caught = e;
    });

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    expect(caught).toBeInstanceOf(WalletSignatureTimeoutError);
    expect(isSignatureTimeoutError(caught)).toBe(true);
    // formatTxError collapses both error types into one alert message.
    expect(formatTxError(caught)).toBe(
      "Signature request timed out. Check your wallet and try again."
    );
  });

  it("resolves before the deadline and clears the timer", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const signFn = vi.fn(async () => "signed-xdr");

    const promise = signWalletWithTimeout({ xdr: "XDR" }, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("signed-xdr");
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("uses DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS when no bound is supplied", async () => {
    const signFn = vi.fn(() => new Promise<string>(() => {}));
    const promise = signWalletWithTimeout({ xdr: "XDR" }, signFn);

    // Advance to just under the default — should still be pending.
    await vi.advanceTimersByTimeAsync(DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS - 1);

    let settled = false;
    promise
      .then(() => {
        settled = true;
      })
      .catch(() => {
        settled = true;
      });
    await Promise.resolve();
    expect(settled).toBe(false);

    // Clean up.
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(1);
  });

  it("DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS is 60 seconds", () => {
    expect(DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS).toBe(60_000);
  });
});

describe("readTransactionMaxTimeSecs — derive the bound from the XDR (#628)", () => {
  it("returns null for an empty or non-string input", () => {
    expect(readTransactionMaxTimeSecs("")).toBeNull();
    expect(readTransactionMaxTimeSecs(null as unknown as string)).toBeNull();
    expect(readTransactionMaxTimeSecs(undefined as unknown as string)).toBeNull();
  });

  it("returns null for a malformed XDR envelope", () => {
    expect(readTransactionMaxTimeSecs("not-valid-base64-xdr")).toBeNull();
  });

  it("does not throw on a malformed XDR — falls back to the default bound", () => {
    expect(() => readTransactionMaxTimeSecs("garbage")).not.toThrow();
  });

  function envelopeWithTimeout(seconds: number): string {
    const account = new Account(Keypair.random().publicKey(), "0");
    const builder = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    }).addOperation(Operation.bumpSequence({ bumpTo: "1" }));
    return builder.setTimeout(seconds).build().toXDR();
  }

  it("returns the seconds left before the envelope's maxTime", () => {
    const xdr = envelopeWithTimeout(30);
    const secs = readTransactionMaxTimeSecs(xdr);
    expect(secs).not.toBeNull();
    expect(secs!).toBeGreaterThan(25);
    expect(secs!).toBeLessThanOrEqual(30);
  });

  it("returns null once maxTime has passed", () => {
    const xdr = envelopeWithTimeout(30);
    expect(readTransactionMaxTimeSecs(xdr, Date.now() + 60_000)).toBeNull();
  });

  it("returns null for an envelope without an upper time bound", () => {
    expect(readTransactionMaxTimeSecs(envelopeWithTimeout(0))).toBeNull();
  });
});

describe("formatTxError — single timeout mapping (#628)", () => {
  it("maps WalletSignatureTimeoutError to the alert message", () => {
    const err = new WalletSignatureTimeoutError(30_000);
    expect(formatTxError(err)).toBe(
      "Signature request timed out. Check your wallet and try again."
    );
  });

  it("isSignatureTimeoutError recognises both error names", () => {
    const a = new WalletSignatureTimeoutError(1_000);
    const b = new Error("legacy");
    b.name = "TxSignatureTimeoutError";
    expect(isSignatureTimeoutError(a)).toBe(true);
    expect(isSignatureTimeoutError(b)).toBe(true);
    expect(isSignatureTimeoutError(new Error("nope"))).toBe(false);
  });
});
