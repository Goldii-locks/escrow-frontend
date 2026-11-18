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
  encodeContractArgs,
  type CreateEscrowArgs,
  type EscrowSettings,
  type FundingMode,
} from "@goldii-locks/milestone-escrow-bindings";

const SECONDS_PER_DAY = BigInt(24 * 60 * 60);

export interface CreateJobParams {
  /** Connected wallet; signs the transaction and becomes the client. */
  client: string;
  freelancer: string;
  arbiter: string;
  token: string;
  /** Whole days, as entered. */
  autoReleaseDays: string;
  milestones: Milestone[];
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

/**
 * `create_escrow` arguments as a typed object, in contract order. The shape
 * comes from the generated bindings, so a signature change in the contract
 * surfaces here as a TypeScript error (#907).
 */
export function buildCreateEscrowCall(params: CreateJobParams, salt: string): CreateEscrowArgs {
  const autoReleaseSeconds = BigInt(params.autoReleaseDays) * SECONDS_PER_DAY;
  const amounts = toMilestoneAmounts(params.milestones);
  // EscrowSettings: upfront funding, the standard dispute timeout, and no
  // arbiter fee.
  const settings: EscrowSettings = {
    funding_mode: "Upfront" satisfies FundingMode,
    dispute_timeout_seconds: DISPUTE_TIMEOUT_SECONDS,
    arbiter_fee_bps: 0,
  };
  return {
    client: params.client,
    freelancer: params.freelancer,
    arbiter: params.arbiter,
    token: params.token,
    auto_release_seconds: autoReleaseSeconds,
    milestone_amounts: amounts.map((value) => BigInt(value)),
    milestone_spec_hashes: amounts.map(() => EMPTY_SPEC_HASH),
    settings,
    salt,
  };
}

/**
 * `create_escrow` arguments in the `{ type, value }` encoding build-tx
 * expects, derived from the typed call so the two can't drift apart.
 */
export function buildCreateEscrowArgs(params: CreateJobParams, salt: string): ContractArg[] {
  return encodeContractArgs("create_escrow", buildCreateEscrowCall(params, salt));
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
  return submitContractTransaction({
    contractId: FACTORY_CONTRACT_ID,
    method: "create_escrow",
    args: buildCreateEscrowArgs(params, randomSaltHex()),
    sourceAddress: params.client,
    signTransaction,
    onPhase,
    setSimulationResult,
  });
}
