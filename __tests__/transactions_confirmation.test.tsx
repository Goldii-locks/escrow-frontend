import { render, screen } from "@testing-library/react";
import { xdr } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import buildTxSuccess from "@/__tests__/fixtures/backend/build-tx-success.json";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { getAddStatusBadge, getTokenStatusBadge } from "@/app/lib/admin_whitelist_panel";
import { ERROR_MESSAGES } from "@/app/lib/errors";
import {
  decodeTxFailureMessage,
  extractSubmitTxStatus,
  getPhaseLabel,
  isTxPending,
  runContractAction,
  submitContractTransaction,
  TxConfirmationTimeoutError,
  type TxConfirmationRpc,
  type TxPhase,
} from "@/app/lib/transactions";

const SOURCE_ADDRESS = "GADMIN7XQ7ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ2ZQ";
const TX_HASH = "5f6d3b2c1a0e9d8c7b6a5948372615049382716f5e4d3c2b1a09f8e7d6c5b4a3";

const BASE_TX = {
  method: "release_milestone",
  args: [{ type: "u32", value: 0 }],
  sourceAddress: SOURCE_ADDRESS,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function mockBuildAndSubmit(submitBody: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/jobs/build-tx")) {
        return jsonResponse(buildTxSuccess);
      }
      return jsonResponse(submitBody);
    })
  );
}

/** Builds a real base64 Soroban DiagnosticEvent carrying `Error(Contract, #code)`. */
function buildContractErrorDiagnosticEventBase64(contractErrorCode: number): string {
  const errScVal = xdr.ScVal.scvError(xdr.ScError.sceContract(contractErrorCode));
  const diagEvent = new xdr.DiagnosticEvent({
    inSuccessfulContractCall: false,
    event: new xdr.ContractEvent({
      ext: xdr.ExtensionPoint.v0(),
      contractId: null,
      type: xdr.ContractEventType.diagnostic,
      body: xdr.ContractEventBody.v0(
        new xdr.ContractEventV0({
          topics: [errScVal],
          data: xdr.ScVal.scvVoid(),
        })
      ),
    }),
  });
  return diagEvent.toXDR("base64");
}

/** Builds a real base64 `xdr.TransactionResult` with outer code `txBadAuth`. */
function buildBadAuthTxResultBase64(): string {
  const txResult = new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txBadAuth(),
    ext: xdr.TransactionResultExt.v0(),
  });
  return txResult.toXDR("base64");
}

describe("transaction network confirmation (#570)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("polls getTransaction on PENDING -> NOT_FOUND -> SUCCESS and emits confirming before success", async () => {
    mockBuildAndSubmit({
      success: true,
      data: { status: "PENDING", hash: TX_HASH },
    });

    const getTransaction = vi
      .fn<TxConfirmationRpc["getTransaction"]>()
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "SUCCESS" });

    const phases: TxPhase[] = [];
    let currentError: string | null = null;
    let finalHash: string | null = null;

    const resultHash = await runContractAction(
      "milestone-0",
      (onPhase) =>
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
          onPhase,
          rpcServer: { getTransaction },
          pollIntervalMs: 5,
          confirmationTimeoutMs: 1_000,
        }),
      {
        isPending: () => false,
        setPhase: (_key, phase) => {
          phases.push(phase);
        },
        setError: (_key, error) => {
          currentError = error;
        },
        setTxHash: (_key, hash) => {
          finalHash = hash;
        },
      }
    );

    expect(resultHash).toBe(TX_HASH);
    expect(finalHash).toBe(TX_HASH);
    expect(currentError).toBeNull();
    expect(getTransaction).toHaveBeenCalledTimes(3);
    expect(getTransaction).toHaveBeenCalledWith(TX_HASH);
    expect(phases).toEqual([
      "building",
      "building",
      "signing",
      "submitting",
      "confirming",
      "success",
    ]);
  });

  it("maps PENDING -> FAILED with a Soroban contract revert XDR to an error phase with decoded message", async () => {
    mockBuildAndSubmit({
      success: true,
      data: { status: "PENDING", hash: TX_HASH },
    });

    const diagXdr = buildContractErrorDiagnosticEventBase64(5);
    const getTransaction = vi
      .fn<TxConfirmationRpc["getTransaction"]>()
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({
        status: "FAILED",
        diagnosticEventsXdr: [diagXdr],
      } as unknown as { status: string });

    const phases: TxPhase[] = [];
    let recordedError: string | null = null;
    let recordedHash: string | null = null;

    const result = await runContractAction(
      "milestone-0",
      (onPhase) =>
        submitContractTransaction({
          ...BASE_TX,
          signTransaction: async () => "SIGNED_XDR_BASE64",
          onPhase,
          rpcServer: { getTransaction },
          pollIntervalMs: 5,
          confirmationTimeoutMs: 1_000,
        }),
      {
        isPending: () => false,
        setPhase: (_key, phase) => {
          phases.push(phase);
        },
        setError: (_key, error) => {
          recordedError = error;
        },
        setTxHash: (_key, hash) => {
          recordedHash = hash;
        },
      }
    );

    expect(result).toBeNull();
    expect(recordedHash).toBeNull();
    expect(phases).toContain("confirming");
    expect(phases[phases.length - 1]).toBe("error");
    expect(recordedError).toBe(ERROR_MESSAGES[5]);
  });

  it("surfaces the decoded TransactionResult code when PENDING -> FAILED has resultXdr", async () => {
    mockBuildAndSubmit({
      success: true,
      data: { status: "PENDING", hash: TX_HASH },
    });

    const badAuthXdr = buildBadAuthTxResultBase64();
    const getTransaction = vi.fn<TxConfirmationRpc["getTransaction"]>().mockResolvedValueOnce({
      status: "FAILED",
      resultXdr: badAuthXdr,
    } as unknown as { status: string });

    await expect(
      submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => "SIGNED_XDR_BASE64",
        rpcServer: { getTransaction },
        pollIntervalMs: 5,
        confirmationTimeoutMs: 1_000,
      })
    ).rejects.toThrow("Transaction failed on-chain (txBadAuth).");
  });

  it("rejects immediately without polling when submit returns status ERROR", async () => {
    const badAuthXdr = buildBadAuthTxResultBase64();
    mockBuildAndSubmit({
      success: true,
      data: {
        status: "ERROR",
        hash: TX_HASH,
        errorResultXdr: badAuthXdr,
      },
    });

    const getTransaction = vi.fn<TxConfirmationRpc["getTransaction"]>();
    const phases: TxPhase[] = [];

    await expect(
      submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => "SIGNED_XDR_BASE64",
        onPhase: (phase) => phases.push(phase),
        rpcServer: { getTransaction },
      })
    ).rejects.toThrow("Transaction failed on-chain (txBadAuth).");

    expect(getTransaction).not.toHaveBeenCalled();
    expect(phases).toEqual(["building", "signing", "submitting"]);
  });

  it("rejects immediately without polling when submit returns TRY_AGAIN_LATER", async () => {
    mockBuildAndSubmit({
      success: true,
      data: { status: "TRY_AGAIN_LATER", hash: TX_HASH },
    });

    const getTransaction = vi.fn<TxConfirmationRpc["getTransaction"]>();
    const phases: TxPhase[] = [];

    await expect(
      submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => "SIGNED_XDR_BASE64",
        onPhase: (phase) => phases.push(phase),
        rpcServer: { getTransaction },
      })
    ).rejects.toThrow(/TRY_AGAIN_LATER/i);

    expect(getTransaction).not.toHaveBeenCalled();
    expect(phases).not.toContain("confirming");
  });

  it("rejects with TxConfirmationTimeoutError when getTransaction stays NOT_FOUND past the timeout", async () => {
    mockBuildAndSubmit({
      success: true,
      data: { status: "PENDING", hash: TX_HASH },
    });

    const getTransaction = vi
      .fn<TxConfirmationRpc["getTransaction"]>()
      .mockResolvedValue({ status: "NOT_FOUND" });

    await expect(
      submitContractTransaction({
        ...BASE_TX,
        signTransaction: async () => "SIGNED_XDR_BASE64",
        rpcServer: { getTransaction },
        pollIntervalMs: 10,
        confirmationTimeoutMs: 35,
      })
    ).rejects.toBeInstanceOf(TxConfirmationTimeoutError);

    expect(getTransaction).toHaveBeenCalled();
  });

  it("renders 'Confirming…' in the UI and treats confirming as pending across status helpers", () => {
    expect(getPhaseLabel("confirming")).toBe("Confirming…");
    expect(isTxPending("confirming")).toBe(true);
    expect(getTokenStatusBadge({ phase: "confirming", error: null }).status).toBe("removing");
    expect(getAddStatusBadge("confirming")?.status).toBe("adding");

    render(<TxStatusBanner state={{ phase: "confirming", error: null, txHash: null }} />);

    const statusText = screen.getByText("Confirming…");
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveAttribute("aria-live", "polite");
  });

  it("extractSubmitTxStatus and decodeTxFailureMessage handle envelope and fallback shapes", async () => {
    expect(extractSubmitTxStatus({ success: true, data: { status: "pending" } })).toBe("PENDING");
    expect(extractSubmitTxStatus({ status: "ERROR" })).toBe("ERROR");
    expect(extractSubmitTxStatus({})).toBeNull();

    await expect(decodeTxFailureMessage({ contractErrorCode: 8 }, "fallback")).resolves.toBe(
      "Contract execution reverted (error code 8)"
    );
    await expect(
      decodeTxFailureMessage({ resultCode: "txInsufficientFee" }, "fallback")
    ).resolves.toBe("Transaction failed on-chain (txInsufficientFee).");
  });
});
