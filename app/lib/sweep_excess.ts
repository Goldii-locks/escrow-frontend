/**
 * sweep_excess — recover tokens sent to an escrow by mistake (#898).
 *
 * The contract's `sweep_excess(caller, token)` (escrow-contract #760) pays the
 * client whatever the escrow holds of `token` beyond what it still owes: for
 * the job's own token that is `balance - outstanding obligations`
 * (unreleased milestone amounts, accrued yield and failed-transfer credits);
 * for any other token it is the whole balance. Nothing to sweep reverts with
 * `NothingToSweep` (42).
 *
 * The surplus is previewed by simulating that same call read-only, so the
 * amount shown is exactly what the contract would pay, with no obligations
 * maths duplicated here.
 */

import { Address, StrKey } from "@stellar/stellar-sdk";
import { ContractReadError, simulateContractRead } from "@/app/lib/contract_read";
import type { ContractArg } from "@/app/lib/transactions";

/** Contract error code for `NothingToSweep`. */
export const NOTHING_TO_SWEEP_ERROR_CODE = 42;

export const NOTHING_TO_SWEEP_MESSAGE =
  "There's nothing to recover: this escrow holds no tokens beyond what it still owes.";

export type SweepPreview =
  | { status: "available"; amount: bigint }
  | { status: "nothing" }
  | { status: "error"; message: string };

/** Whether `value` is a Soroban contract address (`C…`), as tokens are. */
export function isValidTokenContractAddress(value: string): boolean {
  return StrKey.isValidContract(value.trim());
}

/** Validates the "other token" address field; returns an error or null. */
export function validateSweepTokenInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a token contract address.";
  if (!isValidTokenContractAddress(trimmed)) {
    return "Enter a valid token contract address (starts with C, 56 characters).";
  }
  return null;
}

/** Interprets the simulated return value of `sweep_excess`. */
export function interpretSweepPreview(value: unknown): SweepPreview {
  let amount: bigint | null = null;
  if (typeof value === "bigint") amount = value;
  else if (typeof value === "number" && Number.isInteger(value)) amount = BigInt(value);
  else if (typeof value === "string" && /^-?\d+$/.test(value)) amount = BigInt(value);

  if (amount === null)
    return { status: "error", message: "Unexpected response from the contract." };
  return amount > BigInt(0) ? { status: "available", amount } : { status: "nothing" };
}

/**
 * Previews what `sweep_excess(caller, token)` would recover. Never signs or
 * submits anything.
 */
export async function previewSweepExcess(
  contractId: string,
  caller: string,
  token: string
): Promise<SweepPreview> {
  try {
    const value = await simulateContractRead(contractId, "sweep_excess", [
      Address.fromString(caller).toScVal(),
      Address.fromString(token.trim()).toScVal(),
    ]);
    return interpretSweepPreview(value);
  } catch (err) {
    if (err instanceof ContractReadError && err.contractErrorCode === NOTHING_TO_SWEEP_ERROR_CODE) {
      return { status: "nothing" };
    }
    console.error("Failed to preview sweep_excess", err);
    return {
      status: "error",
      message: "We couldn't check this escrow's balance. Please try again.",
    };
  }
}

/** `sweep_excess(caller, token)` arguments for the build-tx call. */
export function buildSweepExcessArgs(caller: string, token: string): ContractArg[] {
  return [
    { type: "address", value: caller },
    { type: "address", value: token.trim() },
  ];
}
