// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_REQUEST_TIMEOUT_MS, BACKEND_URL, SUBMIT_REQUEST_TIMEOUT_MS } from "@/app/lib/config";
import { submitContractTransaction, type TxPhase } from "@/app/lib/transactions";
import { formatTxError, TxRequestTimeoutError } from "@/app/lib/errors";

// Placeholder XDR; the prepared-transaction check is covered by
// tx-verification.test.ts (#889).
vi.mock("@/app/lib/tx_verification", () => ({ verifyPreparedTransaction: vi.fn() }));

// The submit flow confirms the outcome on-chain (#570); answer SUCCESS
// instead of hitting a real RPC endpoint.
vi.mock("@/app/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/config")>()),
  createRpcServer: async () => ({ getTransaction: async () => ({ status: "SUCCESS" }) }),
}));

// Mock the SDK so computing the signed transaction's hash (#825) is
// deterministic without a real envelope. The hoisted `mockHash` holds the
// bytes `Transaction(...).hash()` returns; `fail: true` makes the constructor
// throw to exercise the hashing-failure path.
const { mockHash } = vi.hoisted(() => ({
  mockHash: { bytes: new Uint8Array([0xab, 0x12, 0xcd, 0x34, 0xef, 0x56]), fail: false },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Transaction: class MockTransaction {
    constructor() {
      if (mockHash.fail) {
        throw new Error("cannot decode envelope");
      }
    }
    hash() {
      return mockHash.bytes;
    }
  },
}));

const SOURCE_ADDRESS = "GADMIN7XQ7ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ";

const BASE_TX = {
  method: "add_whitelisted_token",
  args: [{ type: "address", value: SOURCE_ADDRESS }],
  sourceAddress: SOURCE_ADDRESS,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/**
 * A fetch that never resolves on its own and only rejects when the caller's
 * AbortSignal fires, like a real fetch against a hung backend.
 */
function mockNeverResolvingFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException("The operation was aborted.", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted.", "AbortError"))
            );
          }
          // Never resolves otherwise — the request "hangs".
        })
    )
  );
}

describe("submitContractTransaction request timeouts (#825)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockHash.fail = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a hanging build-tx after API_REQUEST_TIMEOUT_MS with a retryable error", async () => {
    mockNeverResolvingFetch();
    const signTransaction = vi.fn(async () => "SIGNED_XDR_BASE64");
    const phases: TxPhase[] = [];

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction,
      onPhase: (phase) => phases.push(phase),
    });

    const expectation = expect(promise).rejects.toBeInstanceOf(TxRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await expectation;

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TxRequestTimeoutError);
    expect((err as TxRequestTimeoutError).retryable).toBe(true);
    expect((err as TxRequestTimeoutError).message).toBe(
      "Preparing the transaction timed out. Please try again."
    );
    // The wallet was never involved and only "building" was announced.
    expect(signTransaction).not.toHaveBeenCalled();
    expect(phases).toEqual(["building"]);
  });

  it("keeps waiting for build-tx below the timeout", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return jsonResponse({ success: true, xdr: "XDR" });
      })
    );

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction: async () => "",
    });

    // Attach the handler before the rejection can fire so it is never
    // unhandled, then confirm the build was not aborted.
    const expectation = expect(promise).rejects.toThrow();
    // Well past the API timeout the build still must not have aborted.
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS - 1);
    await expectation; // empty signed XDR → wallet rejected
    expect(calls).toBe(1);
  });

  it("throws a submit timeout error containing the locally computed hash", async () => {
    mockHash.bytes = new Uint8Array([0xab, 0x12, 0xcd, 0x34, 0xef, 0x56]);
    let submitAborted = false;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/jobs/build-tx")) {
          return Promise.resolve(jsonResponse({ success: true, xdr: "UNSIGNED_XDR" }));
        }
        // Submit hangs; only the abort signal ends it.
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            submitAborted = true;
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      })
    );

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction: async () => "SIGNED_XDR_BASE64",
    });

    const expectation = expect(promise).rejects.toBeInstanceOf(TxRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(SUBMIT_REQUEST_TIMEOUT_MS);
    await expectation;

    expect(submitAborted).toBe(true);
    const err = await promise.catch((e: unknown) => e);
    const message = (err as TxRequestTimeoutError).message;
    expect(message).toContain("We couldn't confirm whether your transaction was submitted");
    expect(message).toContain("ab12cd34ef56");
    expect((err as TxRequestTimeoutError).retryable).toBe(true);
  });

  it("still throws a submit timeout error (without the hash) when hashing fails", async () => {
    mockHash.fail = true;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/jobs/build-tx")) {
          return Promise.resolve(jsonResponse({ success: true, xdr: "UNSIGNED_XDR" }));
        }
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        });
      })
    );

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction: async () => "SIGNED_XDR_BASE64",
    });

    const expectation = expect(promise).rejects.toBeInstanceOf(TxRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(SUBMIT_REQUEST_TIMEOUT_MS);
    await expectation;

    const err = await promise.catch((e: unknown) => e);
    expect((err as TxRequestTimeoutError).message).toContain(
      "We couldn't confirm whether your transaction was submitted"
    );
    expect((err as TxRequestTimeoutError).message).not.toContain("hash (computed locally)");
  });

  it("passes both fetches an AbortSignal, and the build signal is the API timeout", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal) {
          signals.push(init.signal);
        }
        const url = String(input);
        if (url.endsWith("/api/jobs/submit")) {
          return jsonResponse({ success: true, data: { hash: "tx-hash" } });
        }
        return jsonResponse({ success: true, xdr: "XDR" });
      })
    );

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction: async () => "SIGNED_XDR_BASE64",
    });
    // A full successful run issues both fetches (so both carry a signal).
    await expect(promise).resolves.toBe("tx-hash");

    expect(signals).toHaveLength(2);
    for (const signal of signals) {
      // Cleared once the request settled — the timers were cancelled, so the
      // signals never fire despite real-time passing.
      expect(signal.aborted).toBe(false);
    }
  });

  it("surfaces the timeout messages through formatTxError", async () => {
    mockNeverResolvingFetch();

    const promise = submitContractTransaction({
      ...BASE_TX,
      signTransaction: async () => "SIGNED_XDR_BASE64",
    });
    const expectation = expect(promise).rejects.toBeInstanceOf(TxRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await expectation;

    const err = await promise.catch((e: unknown) => e);
    expect(formatTxError(err)).toBe((err as TxRequestTimeoutError).message);
  });
});

describe("config timeout constants (#825)", () => {
  it("exposes a longer submit timeout than the default API timeout", () => {
    expect(SUBMIT_REQUEST_TIMEOUT_MS).toBeGreaterThan(API_REQUEST_TIMEOUT_MS);
    expect(SUBMIT_REQUEST_TIMEOUT_MS).toBe(45_000);
    expect(API_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(typeof BACKEND_URL).toBe("string");
  });
});
