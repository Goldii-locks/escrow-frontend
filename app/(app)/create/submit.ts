/**
 * The one place the create flow builds escrow-creation contract arguments
 * (#621). Inputs are expected to have passed checkSubmission already.
 *
 * Escrows are created through escrow-factory's `create_escrow`, which deploys
 * a new escrow contract and runs its constructor in the same call; the
 * escrow contract itself has no `initialize` in release builds.
 */
import {
  FACTORY_CONTRACT_ID,
  submitContractTransaction,
  type ContractArg,
  type TxPhase,
} from "@/app/lib/transactions";
import { validateMilestoneAmount } from "@/app/lib/milestone_amount_validation";
import { parseDecimalToBaseUnits } from "@/app/lib/amounts";
import type { Milestone } from "./validation";
import type { WalletSimulationResult } from "@/app/lib/wallet_session";

import {
  FACTORY_CONTRACT_ID,
  submitContractTransaction,
  type ContractArg,
  type TxPhase,
} from "@/app/lib/transactions";
import { validateMilestoneAmount } from "@/app/lib/milestone_amount_validation";
import { parseDecimalToBaseUnits } from "@/app/lib/amounts";
import type { Milestone } from "./validation";
import type { WalletSimulationResult } from "@/app/lib/wallet_session";
import { hashSpec } from "@/app/lib/spec_hash";

const SECONDS_PER_DAY = BigInt(24 * 60 * 60);

/** The contract's default dispute timeout: 30 days for the arbiter to rule. */
const DEFAULT_DISPUTE_TIMEOUT_SECONDS = BigInt(30) * SECONDS_PER_DAY;

export interface CreateJobParams {
  /** Connected wallet; signs the transaction and becomes the client. */
  client: string;
  freelancer: string;
  arbiter: string;
  token: string;
  /** Whole days, as entered. */
  autoReleaseDays: string;
  milestones: Milestone[];
  /** How the client funds the escrow. */
  fundingMode: "Upfront" | "PerMilestone";
  /** Dispute timeout in whole days (contract bounds enforced by the form). */
  disputeTimeoutDays: string;
  /** Arbiter fee as basis points (0–1000). */
  arbiterFeeBps: string;
}

/**
 * Milestone amounts as i128 base-unit strings; throws on any invalid row.
 * Inputs are decimal token amounts (#574), converted at 7 decimals.
 */
export function toMilestoneAmounts(milestones: Milestone[]): string[] {
  return milestones.map((m) => {
    const trimmed = m.amount.trim();
    if (trimmed === "" || validateMilestoneAmount(trimmed) !== null) {
      throw new Error("Invalid milestone amount");
    }
    return parseDecimalToBaseUnits(trimmed, 7).toString();
  });
}

/** The contract's DISPUTE_TIMEOUT_SECONDS: 30 days for the arbiter to rule. */
const DISPUTE_TIMEOUT_SECONDS = BigInt(30) * SECONDS_PER_DAY;

/**
 * No milestone spec is committed yet: the form only collects amounts, so
 * each milestone's 32-byte `spec_hash` is all zeroes.
 */
const EMPTY_SPEC_HASH = "00".repeat(32);

/** 32 random bytes, hex: `create_escrow` derives the escrow address from it. */
export function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `create_escrow` arguments, in contract order. */
export async function buildCreateEscrowArgs(params: CreateJobParams, salt: string): Promise<ContractArg[]> {
  const autoReleaseSeconds = BigInt(params.autoReleaseDays) * SECONDS_PER_DAY;
  const amounts = toMilestoneAmounts(params.milestones);
  const disputeTimeoutSeconds =
    BigInt(params.disputeTimeoutDays) * SECONDS_PER_DAY || DEFAULT_DISPUTE_TIMEOUT_SECONDS;
  const arbiterFeeBps = Number(params.arbiterFeeBps) || 0;

  const specHashes = await Promise.all(
    params.milestones.map((m) => hashSpec({ title: m.title, description: m.description }))
  );

  return [
    { type: "address", value: params.client },
    { type: "address", value: params.freelancer },
    { type: "address", value: params.arbiter },
    { type: "address", value: params.token },
    { type: "u64", value: autoReleaseSeconds.toString() },
    { type: "vec", value: amounts.map((value) => ({ type: "i128", value })) },
    { type: "vec", value: specHashes.map((value) => ({ type: "bytes", value })) },
    {
      // EscrowSettings: funding mode, dispute timeout, and arbiter fee.
      type: "struct",
      value: {
        funding_mode: { type: "enum", value: params.fundingMode },
        dispute_timeout_seconds: { type: "u64", value: disputeTimeoutSeconds.toString() },
        arbiter_fee_bps: { type: "u32", value: arbiterFeeBps },
      },
    },
    { type: "bytes", value: salt },
  ];
}

/** Message shown when the deployment has no escrow factory configured. */
export const FACTORY_NOT_CONFIGURED =
  "Creating escrows isn't available yet: no escrow factory is configured for this deployment.";

/**
 * Builds, signs and submits `create_escrow` on the factory; resolves with the
 * transaction hash.
 */
export function submitCreateJob(
  params: CreateJobParams,
  {
    signTransaction,
    onPhase,
    setSimulationResult,
  }: {
    signTransaction: (xdr: string) => Promise<string>;
    onPhase: (phase: TxPhase) => void;
    /** Receives the build-tx simulation so the fee warning can show (#631). */
    setSimulationResult?: (result: WalletSimulationResult | null) => void;
  }
): Promise<string> {
  if (!FACTORY_CONTRACT_ID) return Promise.reject(new Error(FACTORY_NOT_CONFIGURED));
  const args = await buildCreateEscrowArgs(params, randomSaltHex());
  return submitContractTransaction({
    contractId: FACTORY_CONTRACT_ID,
    method: "create_escrow",
    args,
    sourceAddress: params.client,
    signTransaction,
    onPhase,
    setSimulationResult,
  });
}
