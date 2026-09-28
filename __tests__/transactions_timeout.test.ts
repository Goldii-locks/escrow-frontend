import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTxSensitiveMemory,
  DEFAULT_SIGNING_TIMEOUT_MS,
  signTxWithTimeout,
  TxSignatureTimeoutError,
  type TxSignRequest,
} from "@/app/lib/transactions";

describe("transactions signature timeout bounds (#214)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Happy path: signature arrives before the deadline
  // -------------------------------------------------------------------------

  it("resolves when the signature arrives before the timeout", async () => {
    const request: TxSignRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const signFn = vi.fn(async () => "signed-xdr");

    const promise = signTxWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("signed-xdr");
    // memory cleared even on success
    expect(request.payload).toBeNull();
  });

  it("passes the xdr string to the sign function", async () => {
    const request: TxSignRequest = { xdr: "XDR_PAYLOAD", payload: null };
    const signFn = vi.fn(async (xdr: string) => xdr);

    const promise = signTxWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(signFn).toHaveBeenCalledWith("XDR_PAYLOAD");
    expect(result).toBe("XDR_PAYLOAD");
  });

  // -------------------------------------------------------------------------
  // Timeout: signature hangs past the deadline — operation aborted
  // -------------------------------------------------------------------------

  it("aborts the operation and clears memory when the signature times out", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: TxSignRequest = { xdr: "BBBB...", payload };

    const signFn = vi.fn(
      () =>
        new Promise<string>(() => {
          /* never resolves — simulates a hung wallet */
        })
    );

    const promise = signTxWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      TxSignatureTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("rejection error contains the timeout duration in milliseconds", async () => {
    const request: TxSignRequest = { xdr: "CCCC...", payload: null };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = signTxWithTimeout(request, signFn, 2_000);
    const assertion = expect(promise).rejects.toThrow("2000ms");

    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
  });

  it("nulls the payload reference and zeroes the buffer on timeout", async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const request: TxSignRequest = { xdr: "DDDD...", payload };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = signTxWithTimeout(request, signFn, 500);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      TxSignatureTimeoutError
    );

    await vi.advanceTimersByTimeAsync(500);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload[0]).toBe(0);
    expect(payload[1]).toBe(0);
    expect(payload[2]).toBe(0);
  });

  it("does not fire the timeout before the deadline", async () => {
    const request: TxSignRequest = { xdr: "EEEE..." };

    // signFn resolves at 500 ms, timeout at 1000 ms — should resolve normally
    const signFn = vi.fn(
      () =>
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("on-time"), 500)
        )
    );

    const promise = signTxWithTimeout(request, signFn, 1_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("on-time");
  });

  // -------------------------------------------------------------------------
  // Timer cleanup
  // -------------------------------------------------------------------------

  it("cancels the pending timeout timer after a successful resolution", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const request: TxSignRequest = { xdr: "FFFF..." };
    const signFn = vi.fn(async () => "done");

    const promise = signTxWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("cancels the pending timeout timer after a non-timeout rejection", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const request: TxSignRequest = { xdr: "GGGG..." };
    const signFn = vi.fn(async () => {
      throw new Error("wallet error");
    });

    const promise = signTxWithTimeout(request, signFn, 5_000);
    const assertion = expect(promise).rejects.toThrow("wallet error");

    await vi.runAllTimersAsync();
    await assertion;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Non-timeout error propagation
  // -------------------------------------------------------------------------

  it("re-throws non-timeout errors from the sign function", async () => {
    const request: TxSignRequest = { xdr: "HHHH..." };
    const signFn = vi.fn(async () => {
      throw new Error("user rejected");
    });

    const promise = signTxWithTimeout(request, signFn, 5_000);
    const assertion = expect(promise).rejects.toThrow("user rejected");

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("non-timeout errors are not TxSignatureTimeoutError", async () => {
    const request: TxSignRequest = { xdr: "IIII..." };
    const signFn = vi.fn(async () => {
      throw new Error("network failure");
    });

    const promise = signTxWithTimeout(request, signFn, 5_000);
    const assertion = expect(promise).rejects.not.toBeInstanceOf(
      TxSignatureTimeoutError
    );

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("re-throws a non-timeout error without swallowing it", async () => {
    const payload = new Uint8Array([5, 5, 5]);
    const request: TxSignRequest = { xdr: "JJJJ...", payload };
    const signFn = vi.fn(async () => {
      throw new Error("horizon unreachable");
    });

    await expect(
      signTxWithTimeout(request, signFn, 5_000)
    ).rejects.toThrow("horizon unreachable");
  });

  // -------------------------------------------------------------------------
  // DEFAULT_SIGNING_TIMEOUT_MS constant
  // -------------------------------------------------------------------------

  it("DEFAULT_SIGNING_TIMEOUT_MS is 60 seconds", () => {
    expect(DEFAULT_SIGNING_TIMEOUT_MS).toBe(60_000);
  });

  it("uses DEFAULT_SIGNING_TIMEOUT_MS when no timeoutMs argument is supplied", async () => {
    // We verify the default is wired in by checking a timeout longer than the
    // default does NOT fire within the default window. We advance to just
    // under 60 s and confirm the promise is still pending.
    const request: TxSignRequest = { xdr: "KKKK..." };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = signTxWithTimeout(request, signFn);
    // advance to 59_999 ms — should still be pending (no timeout yet)
    await vi.advanceTimersByTimeAsync(59_999);

    let settled = false;
    promise.then(() => { settled = true; }).catch(() => { settled = true; });
    // give microtask queue a tick
    await Promise.resolve();
    expect(settled).toBe(false);

    // clean up
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(1);
  });

  // -------------------------------------------------------------------------
  // TxSignatureTimeoutError class
  // -------------------------------------------------------------------------

  it("TxSignatureTimeoutError has the correct name", () => {
    const err = new TxSignatureTimeoutError(5_000);
    expect(err.name).toBe("TxSignatureTimeoutError");
  });

  it("TxSignatureTimeoutError message includes the timeout value", () => {
    const err = new TxSignatureTimeoutError(3_000);
    expect(err.message).toContain("3000ms");
  });

  it("TxSignatureTimeoutError is an instance of Error", () => {
    const err = new TxSignatureTimeoutError(1_000);
    expect(err).toBeInstanceOf(Error);
  });

  // -------------------------------------------------------------------------
  // clearTxSensitiveMemory helper
  // -------------------------------------------------------------------------

  it("clearTxSensitiveMemory zeroes the buffer and nulls the reference", () => {
    const payload = new Uint8Array([1, 1, 1]);
    const request: TxSignRequest = { xdr: "x", payload };
    clearTxSensitiveMemory(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });

  it("clearTxSensitiveMemory is a no-op when payload is already null", () => {
    const request: TxSignRequest = { xdr: "x", payload: null };
    expect(() => clearTxSensitiveMemory(request)).not.toThrow();
    expect(request.payload).toBeNull();
  });

  it("clearTxSensitiveMemory is a no-op when payload field is absent", () => {
    const request: TxSignRequest = { xdr: "x" };
    expect(() => clearTxSensitiveMemory(request)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Memory cleared on success (no payload)
  // -------------------------------------------------------------------------

  it("resolves correctly when request has no payload", async () => {
    const request: TxSignRequest = { xdr: "LLLL..." };
    const signFn = vi.fn(async () => "result-no-payload");

    const promise = signTxWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("result-no-payload");
  });

  it("timeout fires and rejects correctly when request has no payload", async () => {
    const request: TxSignRequest = { xdr: "MMMM..." };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = signTxWithTimeout(request, signFn, 500);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      TxSignatureTimeoutError
    );
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
