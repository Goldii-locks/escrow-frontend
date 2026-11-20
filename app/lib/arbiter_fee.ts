/**
 * arbiter_fee — what each side receives when the arbiter resolves a dispute
 * (#900).
 *
 * Mirrors the escrow contract (`escrow-contract` #738):
 *
 * ```rust
 * fn arbiter_fee_for(env, remaining, available) -> Result<i128, Error> {
 *     let fee = remaining * arbiter_fee_bps / BPS_SCALE; // rounded down
 *     Ok(fee.min(available))
 * }
 * ```
 *
 * `resolve_dispute` pays the fee to the arbiter first and the winning party
 * receives `remaining - fee`, where `remaining = amount - released_amount`.
 */

import { simulateContractRead } from "@/app/lib/contract_read";

/** Basis-point scale used by the contract (`BPS_SCALE`). */
export const ARBITER_FEE_BPS_SCALE = 10_000;

/** Highest fee the contract accepts (`MAX_ARBITER_FEE_BPS`, 10%). */
export const MAX_ARBITER_FEE_BPS = 1_000;

function toBigInt(value: string | bigint | null | undefined): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return null;
  return BigInt(value.trim());
}

/** Whether `bps` is a fee the contract could have stored. */
export function isValidArbiterFeeBps(bps: unknown): bps is number {
  return typeof bps === "number" && Number.isInteger(bps) && bps >= 0 && bps <= MAX_ARBITER_FEE_BPS;
}

/**
 * The arbiter fee on a disputed `remaining` balance, rounded down like the
 * contract. When `available` is given the fee is capped to it, as on-chain.
 */
export function arbiterFeeFor(remaining: bigint, feeBps: number, available?: bigint): bigint {
  if (!isValidArbiterFeeBps(feeBps)) {
    throw new RangeError(`Arbiter fee must be 0–${MAX_ARBITER_FEE_BPS} bps (got ${feeBps})`);
  }
  if (feeBps === 0 || remaining <= BigInt(0)) return BigInt(0);
  // BigInt division truncates toward zero, which is floor for a positive
  // remaining — the same as the contract's i128 division.
  const fee = (remaining * BigInt(feeBps)) / BigInt(ARBITER_FEE_BPS_SCALE);
  return available !== undefined && available < fee ? available : fee;
}

export interface ArbiterResolutionBreakdown {
  /** `amount - released_amount`: what is still in escrow for the milestone. */
  remaining: bigint;
  /** Arbiter fee, or null when the fee rate is unknown. */
  fee: bigint | null;
  /** What the chosen side receives (`remaining - fee`), or null when unknown. */
  payout: bigint | null;
  /** The fee rate used, or null when unknown. */
  feeBps: number | null;
}

/**
 * Remaining amount, arbiter fee and payout for a disputed milestone.
 * Returns null when the amounts can't be parsed. An unknown fee rate (null)
 * still yields the remaining amount, with `fee` and `payout` left null so the
 * UI says "unknown" instead of guessing.
 */
export function getArbiterResolutionBreakdown(input: {
  amount: string;
  releasedAmount?: string | null;
  feeBps: number | null | undefined;
}): ArbiterResolutionBreakdown | null {
  const amount = toBigInt(input.amount);
  const released = toBigInt(input.releasedAmount ?? "0");
  if (amount === null || released === null) return null;

  const remaining = amount - released;
  if (!isValidArbiterFeeBps(input.feeBps)) {
    return { remaining, fee: null, payout: null, feeBps: null };
  }

  const fee = arbiterFeeFor(remaining, input.feeBps);
  return { remaining, fee, payout: remaining - fee, feeBps: input.feeBps };
}

/** Formats a bps rate as a percentage, e.g. 250 → "2.5%". */
export function formatFeeBps(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/**
 * Reads the escrow's arbiter fee rate with the contract's read-only
 * `get_arbiter_fee_bps` view. Returns null when it can't be read.
 */
export async function fetchArbiterFeeBps(contractId: string): Promise<number | null> {
  try {
    const value = await simulateContractRead(contractId, "get_arbiter_fee_bps");
    const bps = typeof value === "bigint" ? Number(value) : value;
    return isValidArbiterFeeBps(bps) ? bps : null;
  } catch (err) {
    console.error("Failed to read the arbiter fee", err);
    return null;
  }
}
