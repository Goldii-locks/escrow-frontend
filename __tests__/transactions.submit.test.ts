import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import buildTxError from "@/__tests__/fixtures/backend/build-tx-error.json";
import buildTxSuccess from "@/__tests__/fixtures/backend/build-tx-success.json";
import buildTxValidationError from "@/__tests__/fixtures/backend/build-tx-validation-error.json";
import submitError from "@/__tests__/fixtures/backend/submit-error.json";
import submitSuccess from "@/__tests__/fixtures/backend/submit-success.json";
import submitSuccessLegacyFlatHash from "@/__tests__/fixtures/backend/submit-success-legacy-flat-hash.json";
import submitValidationError from "@/__tests__/fixtures/backend/submit-validation-error.json";
import {
  BACKEND_URL,
  CONTRACT_ID,
  extractBackendErrorMessage,
  extractSubmitTxHash,
  submitContractTransaction,
  type TxPhase,
} from "@/app/lib/transactions";
import { WalletRejectedError } from "@/app/lib/errors";
import { WalletSignatureTimeoutError } from "@/app/lib/wallet_state_context";

/**
 * Builds a minimal `Response`-alike. The production code only touches `ok`
 * and `json()`, so a plain object is enough and keeps the fixtures (plain
 * JSON) usable without a `Blob`/`TextEncoder` round trip.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE\"... is not valid JSON");
    },
  } as unknown as Response;
}

const SOURCE_ADDRESS = "GADMIN7XQ7ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ";

type FetchCall = { url: string; init: RequestInit | undefined };

let calls: FetchCall[] = [];

function mockFetchOnce(responder: (url: string) => Response): void {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return responder(url);
    })
  );
}

/** Answers build-tx then submit in order, using the shared fixture bodies. */
function mockHappyPath(
  buildTxBody: unknown = buildTxSuccess,
  submitBody: unknown = submitSuccess
): void {
  mockFetchOnce((url) =>
    url.endsWith("/api/jobs/build-tx") ? jsonResponse(buildTxBody) : jsonResponse(submitBody)
  );
}

function bodyOf(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body ?? "{}")) as Record<string, unknown>;
}

const BASE_TX = {
  method: "add_whitelisted_token",
  args: [
    { type: "address", value: SOURCE_ADDRESS },
    { type: "address", value: "CTOKENCID6R37252VR7ZY4AFCEFO7HTGSJ7NX2EBYXUUNBZZMYNRLG2MPYQ" },
  ],
  sourceAddress: SOURCE_ADDRESS,
};

describe("submitContractTransaction against real backend response shapes (#686)", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("success path", () => {
    it("returns the hash nested under data and reports every phase", async () => {
      const phases: TxPhase[] = [];
      const signTransaction = vi.fn(async () => "SIGNED_XDR_BASE64");
      mockHappyPath();

      const txHash = await submitContractTransaction({
        ...BASE_TX,
        signTransaction,
        onPhase: (phase) => phases.push(phase),
      });

      expect(txHash).toBe(submitSuccess.data.hash);
      expect(phases).toEqual(["building", "signing", "submitting"]);
    });

    it("posts the documented build-tx request body then the signed XDR", async () => {
      const signTransaction = vi.fn(async () => "SIGNED_XDR_BASE64");
      mockHappyPath();

      await submitContractTransaction({ ...BASE_TX, signTransaction });

      expect(calls.map((call) => call.url)).toEqual([
        `${BACKEND_URL}/api/jobs/build-tx`,
        `${BACKEND_URL}/api/jobs/submit`,
      ]);

      const [buildTxCall, submitCall] = calls;
      expect(buildTxCall.init?.method).toBe("POST");
      expect(buildTxCall.init?.headers).toEqual({
        "Content-Type": "application/json",
      });
      expect(bodyOf(buildTxCall)).toEqual({
        contractId: CONTRACT_ID,
        method: BASE_TX.method,
        args: BASE_TX.args,
        sourceAddress: BASE_TX.sourceAddress,
      });
      expect(bodyOf(submitCall)).toEqual({ signedXdr: "SIGNED_XDR_BASE64" });
      expect(signTransaction).toHaveBeenCalledWith(buildTxSuccess.xdr);
    });

    it("still reads a pre-envelope flat hash for an un-migrated backend", async () => {
      mockHappyPath(buildTxSuccess, submitSuccessLegacyFlatHash);

      const txHash = await submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => "SIGNED_XDR_BASE64",
      });

      expect(txHash).toBe(submitSuccessLegacyFlatHash.hash);
    });

    it("throws instead of reporting success when the hash is missing", async () => {
      mockHappyPath(buildTxSuccess, { success: true, data: { status: "SUCCESS" } });

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow(/did not return a transaction hash/i);
    });
  });

  describe("build-tx failures", () => {
    it("surfaces the sendError body message", async () => {
      mockFetchOnce(() => jsonResponse(buildTxError, 500));

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow(buildTxError.error);
    });

    it("expands a ValidationError body into message plus field details", async () => {
      mockFetchOnce(() => jsonResponse(buildTxValidationError, 400));

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow(
        "Invalid request parameters: contractId must be a valid Stellar contract address (C...)"
      );
    });

    it("never reaches the wallet when the build fails", async () => {
      const signTransaction = vi.fn(async () => "SIGNED_XDR_BASE64");
      const onPhase = vi.fn();
      mockFetchOnce(() => jsonResponse(buildTxError, 500));

      await expect(
        submitContractTransaction({ ...BASE_TX, signTransaction, onPhase })
      ).rejects.toThrow();

      expect(signTransaction).not.toHaveBeenCalled();
      expect(calls).toHaveLength(1);
      expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual(["building"]);
    });

    it("falls back to a readable message when the body is not JSON", async () => {
      mockFetchOnce(() => htmlResponse(502));

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow("We could not prepare your transaction. Please try again.");
    });

    it("rejects a 200 build-tx response that carries no XDR", async () => {
      mockFetchOnce(() => jsonResponse({ success: true }));

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow("We could not prepare your transaction. Please try again.");
    });
  });

  describe("signing failures", () => {
    it("raises WalletRejectedError when the wallet returns no XDR", async () => {
      mockHappyPath();

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "",
        })
      ).rejects.toBeInstanceOf(WalletRejectedError);
      expect(calls).toHaveLength(1);
    });

    it("propagates the wallet context's signature timeout (#628)", async () => {
      mockHappyPath();

      const promise = submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => {
          throw new WalletSignatureTimeoutError(60_000);
        },
      });

      await expect(promise).rejects.toBeInstanceOf(WalletSignatureTimeoutError);
      expect(calls).toHaveLength(1);
    });

    it("propagates a wallet error untouched", async () => {
      mockHappyPath();

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => {
            throw new Error("xBull SDK request timed out");
          },
        })
      ).rejects.toThrow("xBull SDK request timed out");
      expect(calls).toHaveLength(1);
    });
  });

  describe("submit failures", () => {
    it("surfaces the classified sendError message", async () => {
      mockFetchOnce((url) =>
        url.endsWith("/api/jobs/build-tx")
          ? jsonResponse(buildTxSuccess)
          : jsonResponse(submitError, 400)
      );

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow(submitError.error);
    });

    it("expands a submit ValidationError body", async () => {
      mockFetchOnce((url) =>
        url.endsWith("/api/jobs/build-tx")
          ? jsonResponse(buildTxSuccess)
          : jsonResponse(submitValidationError, 400)
      );

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow("Invalid request parameters: signedXdr must be a string");
    });

    it("falls back to a readable message when the submit body is not JSON", async () => {
      mockFetchOnce((url) =>
        url.endsWith("/api/jobs/build-tx") ? jsonResponse(buildTxSuccess) : htmlResponse(504)
      );

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
        })
      ).rejects.toThrow("Your transaction could not be submitted. Please try again.");
    });

    it("does not mark the action successful after a submit error", async () => {
      const onPhase = vi.fn();
      mockFetchOnce((url) =>
        url.endsWith("/api/jobs/build-tx")
          ? jsonResponse(buildTxSuccess)
          : jsonResponse(submitError, 500)
      );

      await expect(
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
          onPhase,
        })
      ).rejects.toThrow();

      expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual([
        "building",
        "signing",
        "submitting",
      ]);
    });
  });
});

describe("extractSubmitTxHash", () => {
  it.each([
    ["the current sendSuccess envelope", submitSuccess, submitSuccess.data.hash],
    ["a flat txHash", { success: true, txHash: "abc" }, "abc"],
    ["a nested transactionHash", { data: { transactionHash: "def" } }, "def"],
    ["an empty body", {}, ""],
    ["a non-object body", "nope", ""],
  ])("handles %s", (_label, body, expected) => {
    expect(extractSubmitTxHash(body)).toBe(expected);
  });
});

describe("extractBackendErrorMessage", () => {
  it("prefers the message field of a sendError body", () => {
    expect(
      extractBackendErrorMessage({ success: false, error: "Transaction failed" }, "fallback")
    ).toBe("Transaction failed");
  });

  it("uses the fallback for an empty body", () => {
    expect(extractBackendErrorMessage({}, "fallback")).toBe("fallback");
    expect(extractBackendErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("de-duplicates a detail that also appears in fields", () => {
    const message = extractBackendErrorMessage(submitValidationError, "fallback");
    expect(message).toBe("Invalid request parameters: signedXdr must be a string");
  });
});
