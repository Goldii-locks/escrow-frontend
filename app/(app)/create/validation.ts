/**
 * Pure validators for the create-job wizard (#621). Nothing here touches
 * React or the network, so every rule can be unit tested on its own; the
 * useCreateJobForm hook only wires the results into state.
 */
import { validateMilestoneAmount } from "@/app/lib/milestone_amount_validation";
import type { TokenValidationResult } from "@/app/lib/token_validation";
import { StrKey } from "@stellar/stellar-sdk";

export const STELLAR_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
export const TOKEN_CONTRACT_PATTERN = /^C[A-Z2-7]{55}$/;

export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 365;

export type Milestone = { amount: string };

/**
 * Error for the freelancer field, or "" when it's empty or valid. Accepts
 * both Ed25519 account keys (G…) and contract addresses (C…) so that smart
 * wallets, multisig contracts, and passkey wallets can receive payment as the
 * freelancer — the escrow contract treats the field as a Soroban Address and
 * require_auth works for contract accounts (#834). Uses the StrKey checksum
 * (#579), so a mistyped character is caught before signing.
 */
export function validateAccountAddress(value: string): string {
  return value && !(StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value))
    ? "Invalid Stellar public key or contract address format"
    : "";
}

/** Error for the arbiter field: an account (G…) or a contract (C…) address. */
export function validateArbiterAddress(value: string): string {
  return value && !(StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value))
    ? "Invalid Stellar public key or contract address format"
    : "";
}

export interface PartyAddressInput {
  client: string;
  freelancer: string;
  arbiter: string;
  adminAddress?: string | null;
}

export interface PartyAddressErrors {
  clientError: string;
  freelancerError: string;
  arbiterError: string;
}

/** Returns role-specific errors for party addresses that must be distinct. */
export function validatePartyAddressCollisions({
  client,
  freelancer,
  arbiter,
  adminAddress,
}: PartyAddressInput): PartyAddressErrors {
  let clientError = "";
  let freelancerError = "";
  let arbiterError = "";

  if (client && freelancer && client === freelancer) {
    freelancerError = "The freelancer can't be your own address.";
  }
  if (client && arbiter && client === arbiter) {
    arbiterError = "The arbiter can't be your own address.";
  }
  if (freelancer && arbiter && freelancer === arbiter) {
    arbiterError = "The arbiter can't use the freelancer's address.";
  }

  if (adminAddress) {
    if (client && client === adminAddress) {
      clientError = "The client can't be the platform admin address.";
    }
    if (freelancer && freelancer === adminAddress) {
      freelancerError = "The freelancer can't be the platform admin address.";
    }
    if (arbiter && arbiter === adminAddress) {
      arbiterError = "The arbiter can't be the platform admin address.";
    }
  }

  return { clientError, freelancerError, arbiterError };
}

/** Error for the token field, or "" when it's empty or valid. */
export function validateTokenAddress(value: string): string {
  return value && !StrKey.isValidContract(value) ? "Invalid Soroban contract ID format" : "";
}

/** Error for the response deadline (whole days), or null when valid. */
export function validateDeadline(value: string): string | null {
  if (value.trim() === "") return "Response deadline is required";
  const num = Number(value);
  if (!Number.isInteger(num)) return "Must be a whole number of days";
  if (num < MIN_DEADLINE_DAYS) return "Must be at least 1 day";
  if (num > MAX_DEADLINE_DAYS) return "Must be at most 365 days";
  return null;
}

/** Drops blank entries from a free-text list (accepted assets, requirements). */
export function nonBlank(values: string[]): string[] {
  return values.filter((value) => value.trim().length > 0);
}

export interface MilestoneSummary {
  /** Well-formed milestone rows, in order. */
  milestones: Milestone[];
  hasNoMilestones: boolean;
  /** At least one row is still blank. */
  hasPartialMilestones: boolean;
  /** At least one non-blank row fails the amount rules. */
  hasInvalidMilestones: boolean;
}

export function summarizeMilestones(rows: (Milestone | null | undefined)[]): MilestoneSummary {
  const milestones = rows.filter((m): m is Milestone => !!m && typeof m.amount === "string");
  return {
    milestones,
    hasNoMilestones: milestones.length === 0,
    hasPartialMilestones: milestones.some((m) => m.amount.trim().length === 0),
    hasInvalidMilestones: milestones.some((m) => {
      const trimmed = m.amount.trim();
      return trimmed.length > 0 && validateMilestoneAmount(trimmed) !== null;
    }),
  };
}

/** Where the entered token stands relative to the whitelist and SEP-41 check. */
export interface TokenStatus {
  token: string;
  /** The token is on a successfully loaded, non-empty whitelist. */
  whitelisted: boolean;
  /** SEP-41 validation for a non-whitelisted token is still running. */
  validating: boolean;
  validation: TokenValidationResult | null;
  /** The user ticked "I confirm this is the correct token contract". */
  confirmed: boolean;
}

/**
 * A well-formed token that isn't whitelisted blocks submission.
 *
 * When a factory is configured the factory's allowed-token list is
 * authoritative: any unlisted token is an unconditional hard block because
 * `create_escrow` will return `TokenNotAllowed` (#833).
 *
 * Without a factory the original SEP-41 confirmation path applies (#668):
 * the token must have passed validation and the user must have confirmed it.
 */
export function hasTokenIssue(
  { token, whitelisted, validating, validation, confirmed }: TokenStatus,
  factoryConfigured = false
): boolean {
  if (!token || !TOKEN_CONTRACT_PATTERN.test(token) || whitelisted) return false;
  // With a factory, any token not on the factory's list is blocked outright.
  if (factoryConfigured) return true;
  if (validating) return true;
  if (validation && !validation.valid) return true;
  return !!validation?.valid && !confirmed;
}

export interface SubmissionInput {
  client: string;
  freelancer: string;
  arbiter: string;
  adminAddress?: string | null;
  autoReleaseDays: string;
  milestones: MilestoneSummary;
  token: Omit<TokenStatus, "whitelisted"> & {
    /** The token appears in the whitelist at all (regardless of load state). */
    listed: boolean;
  };
  /** True when new escrows must go through the factory's allowed-token list (#833). */
  factoryConfigured: boolean;
}

export type SubmissionCheck =
  | { ok: true }
  | {
      ok: false;
      /** Form-level message for the error alert. */
      message: string;
      deadlineError?: string;
      clientError?: string;
      freelancerError?: string;
      arbiterError?: string;
    };

/**
 * The checks run when Create Job is pressed, in the order the user sees
 * them. Returns the first failure, with any field errors to show.
 */
export function checkSubmission(input: SubmissionInput): SubmissionCheck {
  const deadlineError = validateDeadline(input.autoReleaseDays);
  if (deadlineError) {
    return {
      ok: false,
      message: "Please fix the response deadline before creating a job.",
      deadlineError,
    };
  }

  const { hasNoMilestones, hasPartialMilestones, hasInvalidMilestones } = input.milestones;
  if (hasNoMilestones) {
    return { ok: false, message: "Add at least one milestone amount before creating a job." };
  }
  if (hasPartialMilestones) {
    return { ok: false, message: "Complete each milestone amount before creating a job." };
  }
  if (hasInvalidMilestones) {
    return { ok: false, message: "Milestone amounts must contain only numeric characters." };
  }

  const { token } = input;
  if (!token.token) {
    return { ok: false, message: "Select an accepted token before creating a job." };
  }
  if (!token.listed) {
    if (input.factoryConfigured) {
      // The factory will reject this token; block outright (#833).
      return {
        ok: false,
        message: "This token isn't accepted for new escrows.",
      };
    }
    if (token.validating) {
      return { ok: false, message: "Token validation is still in progress. Please wait." };
    }
    if (!token.validation?.valid) {
      return { ok: false, message: "The entered token is not a valid SEP-41 token contract." };
    }
    if (!token.confirmed) {
      return { ok: false, message: "Confirm the non-whitelisted token before creating a job." };
    }
  }

  const { freelancer, arbiter } = input;
  if (
    validateAccountAddress(freelancer) ||
    validateArbiterAddress(arbiter) ||
    !freelancer ||
    !arbiter
  ) {
    return {
      ok: false,
      message: "Please fix the address fields before creating a job.",
      freelancerError: freelancer ? validateAccountAddress(freelancer) : "This field is required.",
      arbiterError: arbiter ? validateArbiterAddress(arbiter) : "This field is required.",
    };
  }

  const partyErrors = validatePartyAddressCollisions(input);
  if (partyErrors.clientError || partyErrors.freelancerError || partyErrors.arbiterError) {
    return {
      ok: false,
      message:
        partyErrors.clientError ||
        partyErrors.freelancerError ||
        partyErrors.arbiterError ||
        "Each party must use a different address.",
      ...partyErrors,
    };
  }

  return { ok: true };
}
