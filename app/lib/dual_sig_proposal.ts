/**
 * dual_sig_proposal — Pure helpers for the two-signature flow (#897).
 *
 * Several Soroban contract entry points (`replace_arbiter`, `emergency_pause`,
 * `rotate_freelancer`, etc.) require both the client's and the freelancer's
 * authorisation in the same transaction. Soroban supports this: party B signs
 * their `SorobanAuthorizationEntry` separately, and party A submits.
 *
 * This module models the "proposal" as a plain serialisable value so it can be
 * shared via URL fragment or the backend's draft API without depending on any
 * wallet or React context.
 *
 * Flow
 * ────
 * 1. Party A calls `buildProposal` → receives `DualSigProposal` with the
 *    unsigned XDR and the auth-entry XDR that party B must sign.
 * 2. The UI encodes the proposal as a URL fragment or stores it via the draft
 *    API and gives party B a shareable link.
 * 3. Party B opens the link, calls `describeProposal` to get a human-readable
 *    summary, signs with their wallet (`signAuthEntry`), and returns a
 *    `SignedAuthEntry`.
 * 4. Party A (or B) calls `assembleAndSubmit` with the base XDR and the signed
 *    auth entry to assemble and broadcast the transaction before the entry
 *    expires.
 *
 * Only `replace_arbiter` is wired up for now (the most urgent case); the
 * generic shape is designed so other methods can be added with one line each.
 */

import { BACKEND_URL } from "@/app/lib/config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Methods that require a co-signature from the counterparty. The map value is
 * the human-readable label used in the review UI.
 */
export const DUAL_SIG_METHODS: Readonly<Record<string, string>> = {
  replace_arbiter: "Replace arbiter",
  emergency_pause: "Emergency pause",
  emergency_unpause_parties: "Emergency unpause",
  rotate_freelancer: "Rotate freelancer",
  add_milestone: "Add milestone",
  reduce_milestone: "Reduce milestone",
  extend_milestone_deadline: "Extend milestone deadline",
};

/** Ledger closes approximately every 5 seconds on Stellar. */
export const LEDGERS_PER_SECOND = 0.2;

/** Auth entries expire after this many ledgers by default (≈ 1 hour). */
export const DEFAULT_AUTH_EXPIRY_LEDGERS = 720;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Who proposed the action and who must co-sign it.
 * Party A is the initiator (builds the transaction); party B is the
 * counterparty whose auth entry must be provided before submission.
 */
export interface DualSigParties {
  /** Stellar public key of the initiator (builds and ultimately submits). */
  partyA: string;
  /**
   * Stellar public key of the counterparty who must sign the auth entry.
   * This is the second signer Soroban requires inside the same transaction.
   */
  partyB: string;
}

/**
 * Serialisable proposal created by party A and shared with party B.
 *
 * The `authEntryXdr` is the `SorobanAuthorizationEntry` XDR that party B must
 * sign. The `transactionXdr` is the unsigned envelope; party A assembles the
 * final transaction from it once both signatures exist.
 */
export interface DualSigProposal {
  /** Contract address the action targets. */
  contractId: string;
  /** Entry-point method name, e.g. `"replace_arbiter"`. */
  method: string;
  /** Unsigned transaction envelope XDR. */
  transactionXdr: string;
  /**
   * The `SorobanAuthorizationEntry` XDR that party B must sign with
   * `signAuthEntry`. Absent when the backend did not return one.
   */
  authEntryXdr?: string;
  /** Stellar ledger sequence number after which the auth entry is invalid. */
  expirationLedger: number;
  /** Unix timestamp (ms) when the proposal was created. */
  createdAt: number;
  parties: DualSigParties;
}

/** Party B's signed auth entry, returned from `signAuthEntry`. */
export interface SignedAuthEntry {
  /** The signed `SorobanAuthorizationEntry` XDR. */
  signedAuthEntryXdr: string;
  /** Public key of the signer. */
  signerAddress: string;
}

/** Human-readable summary shown to party B on the review screen. */
export interface ProposalSummary {
  actionLabel: string;
  contractId: string;
  initiator: string;
  counterparty: string;
  expirationLedger: number;
  /** Approximate UTC ISO string derived from the expiration ledger. */
  expiresApproximately: string;
  /** True when the entry has already expired (should not be signed). */
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DualSigError extends Error {
  constructor(
    public readonly code:
      | "build_failed"
      | "expired"
      | "unsupported_method"
      | "missing_auth_entry"
      | "sign_failed"
      | "assemble_failed"
      | "submit_failed",
    message: string
  ) {
    super(message);
    this.name = "DualSigError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

/** Encodes a proposal as a URL-safe base64 fragment so party B can open it directly. */
export function encodeProposalToFragment(proposal: DualSigProposal): string {
  const json = JSON.stringify(proposal);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json).toString("base64url");
  }
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decodes a proposal from a URL fragment produced by `encodeProposalToFragment`. */
export function decodeProposalFromFragment(fragment: string): DualSigProposal {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(fragment, "base64url").toString("utf8");
    } else {
      const padded = fragment.replace(/-/g, "+").replace(/_/g, "/");
      const pad = (4 - (padded.length % 4)) % 4;
      json = atob(padded + "=".repeat(pad));
    }
    return JSON.parse(json) as DualSigProposal;
  } catch (err) {
    throw new DualSigError(
      "build_failed",
      err instanceof Error
        ? `Could not decode proposal: ${err.message}`
        : "Could not decode proposal."
    );
  }
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Asks the backend to build a transaction for a dual-signature method.
 *
 * The backend's `/api/jobs/build-tx` endpoint returns both the unsigned
 * transaction XDR and, for methods that require a co-signature, the
 * `SorobanAuthorizationEntry` XDR that party B must sign.
 *
 * @throws `DualSigError("unsupported_method")` for unknown methods.
 * @throws `DualSigError("build_failed")` on network or shape errors.
 */
export async function buildProposal({
  contractId,
  method,
  args,
  partyA,
  partyB,
  expirationLedger = 0,
}: {
  contractId: string;
  method: string;
  args: Array<{ type: string; value: unknown }>;
  partyA: string;
  partyB: string;
  /** Explicit expiry ledger; `0` lets the backend choose the default. */
  expirationLedger?: number;
}): Promise<DualSigProposal> {
  if (!DUAL_SIG_METHODS[method]) {
    throw new DualSigError(
      "unsupported_method",
      `"${method}" is not a supported dual-signature method.`
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId,
        method,
        args,
        sourceAddress: partyA,
        dualSig: {
          counterparty: partyB,
          expirationLedger: expirationLedger || DEFAULT_AUTH_EXPIRY_LEDGERS,
        },
      }),
    });
  } catch (err) {
    throw new DualSigError(
      "build_failed",
      err instanceof Error ? `Network error: ${err.message}` : "Network error building proposal."
    );
  }

  if (!res.ok) {
    let message = "Could not build the transaction proposal.";
    try {
      const body: unknown = await res.json();
      message = firstString(isRecord(body) ? body.error ?? body.message : null) ?? message;
    } catch {
      // ignore parse failure
    }
    throw new DualSigError("build_failed", message);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new DualSigError("build_failed", "Could not parse build-tx response.");
  }

  const data = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(data)) {
    throw new DualSigError("build_failed", "Unexpected build-tx response shape.");
  }

  const transactionXdr = firstString(data.xdr, data.transactionXdr);
  if (!transactionXdr) {
    throw new DualSigError("build_failed", "Backend did not return a transaction XDR.");
  }

  // The auth-entry XDR is in `data.authEntryXdr` or `data.authEntry`.
  const authEntryXdr = firstString(data.authEntryXdr, data.authEntry) ?? undefined;

  const expiryFromBackend =
    typeof data.expirationLedger === "number" ? data.expirationLedger : expirationLedger;

  return {
    contractId,
    method,
    transactionXdr,
    authEntryXdr,
    expirationLedger: expiryFromBackend || DEFAULT_AUTH_EXPIRY_LEDGERS,
    createdAt: Date.now(),
    parties: { partyA, partyB },
  };
}

/**
 * Produces a human-readable summary of a proposal for the review screen.
 *
 * `currentLedger` is the current ledger sequence number, used to determine
 * whether the entry has expired and to calculate the approximate expiry time.
 * Pass `0` when the current ledger is unknown — `isExpired` will then always
 * be `false` so the UI does not block signing on stale data.
 */
export function describeProposal(
  proposal: DualSigProposal,
  currentLedger: number
): ProposalSummary {
  const actionLabel = DUAL_SIG_METHODS[proposal.method] ?? proposal.method;

  const isExpired =
    currentLedger > 0 && proposal.expirationLedger > 0
      ? currentLedger >= proposal.expirationLedger
      : false;

  // Approximate wall-clock expiry from creation time + ledger delta.
  let expiresApproximately = "unknown";
  if (proposal.expirationLedger > 0 && proposal.createdAt > 0) {
    const ledgersUntilExpiry =
      currentLedger > 0
        ? proposal.expirationLedger - currentLedger
        : proposal.expirationLedger;
    const msUntilExpiry = (ledgersUntilExpiry / LEDGERS_PER_SECOND) * 1000;
    const expiryMs = Date.now() + msUntilExpiry;
    expiresApproximately = new Date(expiryMs).toUTCString();
  }

  return {
    actionLabel,
    contractId: proposal.contractId,
    initiator: proposal.parties.partyA,
    counterparty: proposal.parties.partyB,
    expirationLedger: proposal.expirationLedger,
    expiresApproximately,
    isExpired,
  };
}

/**
 * Checks whether a proposal is still valid (not yet expired).
 *
 * When `currentLedger` is `0` or unknown, liveness is assumed — the backend
 * will reject an expired entry at submit time regardless.
 */
export function isProposalLive(proposal: DualSigProposal, currentLedger: number): boolean {
  if (currentLedger <= 0 || proposal.expirationLedger <= 0) return true;
  return currentLedger < proposal.expirationLedger;
}

/**
 * Party B signs the `SorobanAuthorizationEntry` from the proposal.
 *
 * `signAuthEntry` is the wallet-kit's signing function for auth entries
 * (distinct from `signTransaction`). It is passed in rather than imported so
 * this pure module stays decoupled from the wallet context.
 *
 * @throws `DualSigError("expired")` when the entry has already expired.
 * @throws `DualSigError("missing_auth_entry")` when no auth entry is present.
 * @throws `DualSigError("sign_failed")` on wallet errors.
 */
export async function signAuthEntry(
  proposal: DualSigProposal,
  currentLedger: number,
  walletSignAuthEntry: (entryXdr: string, opts: { address: string }) => Promise<string>
): Promise<SignedAuthEntry> {
  if (!isProposalLive(proposal, currentLedger)) {
    throw new DualSigError(
      "expired",
      `This proposal expired at ledger ${proposal.expirationLedger}. Ask party A to create a new one.`
    );
  }

  if (!proposal.authEntryXdr) {
    throw new DualSigError(
      "missing_auth_entry",
      "This proposal does not contain an auth entry to sign."
    );
  }

  let signedAuthEntryXdr: string;
  try {
    signedAuthEntryXdr = await walletSignAuthEntry(proposal.authEntryXdr, {
      address: proposal.parties.partyB,
    });
  } catch (err) {
    throw new DualSigError(
      "sign_failed",
      err instanceof Error
        ? `Wallet rejected auth-entry signing: ${err.message}`
        : "Wallet rejected auth-entry signing."
    );
  }

  if (!signedAuthEntryXdr || signedAuthEntryXdr.trim().length === 0) {
    throw new DualSigError("sign_failed", "Wallet returned an empty signed auth entry.");
  }

  return {
    signedAuthEntryXdr: signedAuthEntryXdr.trim(),
    signerAddress: proposal.parties.partyB,
  };
}

/**
 * Assembles the final transaction with both signatures and submits it.
 *
 * Party A (or party B) calls this after `signAuthEntry` returns. The backend's
 * `/api/jobs/submit-dual-sig` endpoint takes the base transaction XDR and the
 * signed auth entry, splices the entry into the transaction's auth list, has
 * party A sign the outer transaction, and broadcasts it.
 *
 * Returns the submitted transaction hash.
 *
 * @throws `DualSigError("assemble_failed")` on backend shape errors.
 * @throws `DualSigError("submit_failed")` on broadcast errors.
 */
export async function assembleAndSubmit({
  proposal,
  signedAuthEntry,
  signTransaction,
}: {
  proposal: DualSigProposal;
  signedAuthEntry: SignedAuthEntry;
  /**
   * Party A's transaction signing function (from the wallet context). The
   * assembled XDR is handed to this for the outer envelope signature.
   */
  signTransaction: (xdr: string) => Promise<string>;
}): Promise<string> {
  // Step 1: ask the backend to splice the signed auth entry into the
  // transaction and return an assembled (but unsigned) XDR.
  let assembleRes: Response;
  try {
    assembleRes = await fetch(`${BACKEND_URL}/api/jobs/assemble-dual-sig`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionXdr: proposal.transactionXdr,
        signedAuthEntryXdr: signedAuthEntry.signedAuthEntryXdr,
        contractId: proposal.contractId,
        method: proposal.method,
      }),
    });
  } catch (err) {
    throw new DualSigError(
      "assemble_failed",
      err instanceof Error ? `Network error: ${err.message}` : "Network error assembling transaction."
    );
  }

  if (!assembleRes.ok) {
    let message = "Could not assemble the transaction.";
    try {
      const body: unknown = await assembleRes.json();
      message = firstString(isRecord(body) ? body.error ?? body.message : null) ?? message;
    } catch {
      // ignore
    }
    throw new DualSigError("assemble_failed", message);
  }

  let assembleBody: unknown;
  try {
    assembleBody = await assembleRes.json();
  } catch {
    throw new DualSigError("assemble_failed", "Could not parse assemble response.");
  }

  const assembleData =
    isRecord(assembleBody) && isRecord(assembleBody.data) ? assembleBody.data : assembleBody;
  if (!isRecord(assembleData)) {
    throw new DualSigError("assemble_failed", "Unexpected assemble response shape.");
  }

  const assembledXdr = firstString(assembleData.xdr, assembleData.assembledXdr);
  if (!assembledXdr) {
    throw new DualSigError("assemble_failed", "Backend did not return an assembled XDR.");
  }

  // Step 2: party A signs the assembled outer transaction envelope.
  let signedXdr: string;
  try {
    signedXdr = await signTransaction(assembledXdr);
  } catch (err) {
    // Re-throw wallet errors untouched so the caller can distinguish a
    // wallet rejection from a network error.
    throw err;
  }

  if (!signedXdr || signedXdr.trim().length === 0) {
    throw new DualSigError("submit_failed", "Party A returned an empty signed transaction.");
  }

  // Step 3: submit the fully-signed transaction.
  let submitRes: Response;
  try {
    submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr: signedXdr.trim() }),
    });
  } catch (err) {
    throw new DualSigError(
      "submit_failed",
      err instanceof Error ? `Network error: ${err.message}` : "Network error submitting transaction."
    );
  }

  if (!submitRes.ok) {
    let message = "Transaction could not be submitted.";
    try {
      const body: unknown = await submitRes.json();
      message = firstString(isRecord(body) ? body.error ?? body.message : null) ?? message;
    } catch {
      // ignore
    }
    throw new DualSigError("submit_failed", message);
  }

  let submitBody: unknown;
  try {
    submitBody = await submitRes.json();
  } catch {
    throw new DualSigError("submit_failed", "Could not parse submit response.");
  }

  const submitData =
    isRecord(submitBody) && isRecord(submitBody.data) ? submitBody.data : submitBody;
  if (!isRecord(submitData)) {
    throw new DualSigError("submit_failed", "Unexpected submit response shape.");
  }

  const txHash = firstString(
    submitData.hash,
    submitData.txHash,
    submitData.transactionHash
  );
  if (!txHash) {
    throw new DualSigError(
      "submit_failed",
      "Transaction was submitted but no hash was returned."
    );
  }

  return txHash;
}
