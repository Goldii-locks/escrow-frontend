import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSensitiveMemory,
  DEFAULT_SIGNATURE_TIMEOUT_MS,
  NetworkSyncSignatureTimeoutError,
  signWithTimeout,
  type NetworkSyncSignRequest,
  type NetworkSyncSignResult,
} from "@/app/lib/network_sync_checker";

describe("network_sync_checker signature timeout bounds (#154)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the signature arrives before the timeout", async () => {
    const request: NetworkSyncSignRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const signFn = vi.fn(async (): Promise<NetworkSyncSignResult> => ({
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
    const request: NetworkSyncSignRequest = {
      xdr: "AAAA...",
      payload,
    };

    const signFn = vi.fn(
      () =>
        new Promise<NetworkSyncSignResult>(() => {
          /* never resolves — simulates hung wallet */
        })
    );

    const promise = signWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      NetworkSyncSignatureTimeoutError
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
    const request: NetworkSyncSignRequest = { xdr: "x", payload };
    clearSensitiveMemory(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });
});
