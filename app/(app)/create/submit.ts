/**
 * The one place the create flow builds `initialize` contract arguments
 * (#621). Inputs are expected to have passed checkSubmission already.
 */
import { submitContractTransaction, type ContractArg, type TxPhase } from "@/app/lib/transactions";
import { validateMilestoneAmount } from "@/app/lib/milestone_amount_validation";
import type { Milestone } from "./validation";

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

/** Milestone amounts (stroops) as i128 strings; throws on any invalid row. */
export function toMilestoneAmounts(milestones: Milestone[]): string[] {
  return milestones.map((m) => {
    const trimmed = m.amount.trim();
    if (trimmed === "" || validateMilestoneAmount(trimmed) !== null) {
      throw new Error("Invalid milestone amount");
    }
    return BigInt(trimmed).toString();
  });
}

export function buildInitializeArgs(params: CreateJobParams): ContractArg[] {
  const autoReleaseSeconds = BigInt(params.autoReleaseDays) * SECONDS_PER_DAY;
  return [
    { type: "address", value: params.client },
    { type: "address", value: params.client },
    { type: "address", value: params.freelancer },
    { type: "address", value: params.arbiter },
    { type: "address", value: params.token },
    { type: "u64", value: autoReleaseSeconds.toString() },
    {
      type: "vec",
      value: toMilestoneAmounts(params.milestones).map((value) => ({ type: "i128", value })),
    },
  ];
}

/** Builds, signs and submits `initialize`; resolves with the transaction hash. */
export function submitCreateJob(
  params: CreateJobParams,
  {
    signTransaction,
    onPhase,
  }: {
    signTransaction: (xdr: string) => Promise<string>;
    onPhase: (phase: TxPhase) => void;
  }
): Promise<string> {
  return submitContractTransaction({
    method: "initialize",
    args: buildInitializeArgs(params),
    sourceAddress: params.client,
    signTransaction,
    onPhase,
  });
}
