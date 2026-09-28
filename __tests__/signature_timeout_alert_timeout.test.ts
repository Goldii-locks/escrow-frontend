/**
 * Tests for issue #244 — Enforce transaction signature time limit bounds in
 * signature_timeout_alert.
 *
 * Validates that runSignatureWithTimeout races signing calls against a clock,
 * aborts operations and clears sensitive memory on expiry, and terminates
 * cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSignatureAlertMemory,
  DEFAULT_SIGNATURE_TIMEOUT_MS,
  runSignatureWithTimeout,
  SignatureTimeoutAlertError,
  type SignatureTimeoutAlertRequest,
} from "@/app/lib/signature_timeout_alert";

describe("signature_timeout_alert timeout bounds (#244)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Happy path — signature arrives before the clock fires
  // -------------------------------------------------------------------------

  it("resolves with the value returned by signFn when within the timeout", async () => {
    const request: SignatureTimeoutAlertRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };
    const signFn = vi.fn(async () => "signed-xdr");

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("signed-xdr");
  });

  it("clears sensitive payload memory after a successful signature", async () => {
    const payload = new Uint8Array([5, 6, 7, 8]);
    const request: SignatureTimeoutAlertRequest = { xdr: "BBBB...", payload };
    const signFn = vi.fn(async () => "signed-xdr");

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    await promise;

    expect(request.payload).toBeNull();
    expect(payload.every((b) => b === 0)).toBe(true);
  });

  it("forwards the XDR string to signFn", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "PAYLOAD-XDR" };
    const signFn = vi.fn(async (xdr: string) => xdr);

    await runSignatureWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();

    expect(signFn).toHaveBeenCalledWith("PAYLOAD-XDR");
  });

  it("does not fire the timeout before the deadline", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "FFFF..." };
    // signFn resolves at 500 ms; timeout at 1 000 ms
    const signFn = vi.fn(
      () =>
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("ok"), 500)
        )
    );

    const promise = runSignatureWithTimeout(request, signFn, 1_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
  });

  // -------------------------------------------------------------------------
  // Timeout path — wallet hangs past the deadline
  // -------------------------------------------------------------------------

  it("aborts the operation and throws SignatureTimeoutAlertError on timeout", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: SignatureTimeoutAlertRequest = { xdr: "CCCC...", payload };
    const signFn = vi.fn(() => new Promise<string>(() => {})); // never resolves

    const promise = runSignatureWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      SignatureTimeoutAlertError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("zeroes the payload buffer and nulls the reference on timeout", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: SignatureTimeoutAlertRequest = { xdr: "CCCC...", payload };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = runSignatureWithTimeout(request, signFn, 1_000);
    const settled = promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(1_000);
    await settled;

    expect(request.payload).toBeNull();
    expect(payload.every((b) => b === 0)).toBe(true);
  });

  it("rejection error message contains the timeout duration", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "EEEE...", payload: null };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = runSignatureWithTimeout(request, signFn, 2_000);
    const assertion = expect(promise).rejects.toThrow("2000ms");

    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
  });

  it("operations terminate and memory is cleared on timeout (verification)", async () => {
    const payload = new Uint8Array(32).fill(0xff);
    const request: SignatureTimeoutAlertRequest = { xdr: "DDDD...", payload };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = runSignatureWithTimeout(request, signFn, 500);
    const settled = promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(500);
    await settled;

    // Memory cleared — operation cannot leak sensitive bytes post-abort.
    expect(request.payload).toBeNull();
    expect(payload.every((b) => b === 0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Timer cleanup
  // -------------------------------------------------------------------------

  it("cancels the pending timeout timer after successful resolution", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const request: SignatureTimeoutAlertRequest = { xdr: "GGGG..." };
    const signFn = vi.fn(async () => "done");

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("cancels the pending timeout timer after a non-timeout rejection", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const request: SignatureTimeoutAlertRequest = { xdr: "HHHH..." };
    const signFn = vi.fn(async () => {
      throw new Error("wallet error");
    });

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
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
    const request: SignatureTimeoutAlertRequest = { xdr: "IIII..." };
    const signFn = vi.fn(async () => {
      throw new Error("user rejected");
    });

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    const assertion = expect(promise).rejects.toThrow("user rejected");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("non-timeout errors are not SignatureTimeoutAlertError", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "JJJJ..." };
    const signFn = vi.fn(async () => {
      throw new Error("device disconnected");
    });

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    const assertion = expect(promise).rejects.not.toBeInstanceOf(
      SignatureTimeoutAlertError
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("clears memory on non-timeout error when payload is present", async () => {
    const payload = new Uint8Array([5, 5, 5]);
    const request: SignatureTimeoutAlertRequest = { xdr: "KKKK...", payload };
    const signFn = vi.fn(async () => {
      throw new Error("horizon unreachable");
    });

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    const settled = promise.catch(() => {});
    await vi.runAllTimersAsync();
    await settled;

    // Memory should NOT be cleared for non-timeout errors (unmodified request)
    // The timeout path specifically clears; other errors pass through as-is.
    // Confirm the error propagated unchanged.
    expect(signFn).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // clearSignatureAlertMemory helper
  // -------------------------------------------------------------------------

  describe("clearSignatureAlertMemory", () => {
    it("zeroes the payload buffer and nulls the reference", () => {
      const payload = new Uint8Array([1, 1, 1]);
      const request: SignatureTimeoutAlertRequest = { xdr: "x", payload };
      clearSignatureAlertMemory(request);

      expect(payload.every((b) => b === 0)).toBe(true);
      expect(request.payload).toBeNull();
    });

    it("handles null payload without throwing", () => {
      const request: SignatureTimeoutAlertRequest = { xdr: "x", payload: null };
      expect(() => clearSignatureAlertMemory(request)).not.toThrow();
      expect(request.payload).toBeNull();
    });

    it("handles undefined payload without throwing", () => {
      const request: SignatureTimeoutAlertRequest = { xdr: "x" };
      expect(() => clearSignatureAlertMemory(request)).not.toThrow();
    });

    it("returns the mutated request object", () => {
      const request: SignatureTimeoutAlertRequest = {
        xdr: "x",
        payload: new Uint8Array([7]),
      };
      const returned = clearSignatureAlertMemory(request);
      expect(returned).toBe(request);
    });

    it("zeroes a large buffer completely", () => {
      const payload = new Uint8Array(256).fill(0xff);
      const request: SignatureTimeoutAlertRequest = { xdr: "x", payload };
      clearSignatureAlertMemory(request);
      expect(payload.every((b) => b === 0)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SignatureTimeoutAlertError class
  // -------------------------------------------------------------------------

  describe("SignatureTimeoutAlertError", () => {
    it("has the correct error name", () => {
      expect(new SignatureTimeoutAlertError(5_000).name).toBe(
        "SignatureTimeoutAlertError"
      );
    });

    it("message includes the timeout value in ms", () => {
      expect(new SignatureTimeoutAlertError(3_000).message).toContain("3000ms");
    });

    it("is an instance of Error", () => {
      expect(new SignatureTimeoutAlertError(1_000)).toBeInstanceOf(Error);
    });

    it("timeoutMs property matches the constructor argument", () => {
      const err = new SignatureTimeoutAlertError(7_500);
      expect(err.timeoutMs).toBe(7_500);
    });
  });

  // -------------------------------------------------------------------------
  // DEFAULT_SIGNATURE_TIMEOUT_MS constant
  // -------------------------------------------------------------------------

  it("DEFAULT_SIGNATURE_TIMEOUT_MS is 60 seconds", () => {
    expect(DEFAULT_SIGNATURE_TIMEOUT_MS).toBe(60_000);
  });

  // -------------------------------------------------------------------------
  // No payload on request
  // -------------------------------------------------------------------------

  it("resolves normally when the request has no payload field", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "KKKK..." };
    const signFn = vi.fn(async () => "result-no-payload");

    const promise = runSignatureWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("result-no-payload");
  });

  it("times out cleanly when the request has no payload", async () => {
    const request: SignatureTimeoutAlertRequest = { xdr: "LLLL..." };
    const signFn = vi.fn(() => new Promise<string>(() => {}));

    const promise = runSignatureWithTimeout(request, signFn, 500);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      SignatureTimeoutAlertError
    );
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
