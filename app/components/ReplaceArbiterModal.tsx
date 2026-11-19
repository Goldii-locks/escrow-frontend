"use client";

/**
 * ReplaceArbiterModal — Two-signature flow for `replace_arbiter` (#897).
 *
 * This modal handles both roles:
 *   - Party A (client or freelancer) proposes the replacement and shares a link.
 *   - Party B (the other party) reviews the proposal, signs the auth entry,
 *     and either party assembles and submits before the entry expires.
 *
 * The `mode` prop switches between the two screens. The URL-fragment sharing
 * mechanism is handled by the parent page; this component exposes callbacks
 * so the parent can copy the link, read the fragment, and pass a decoded
 * proposal back in.
 */

import { useCallback, useState } from "react";
import {
  buildProposal,
  describeProposal,
  signAuthEntry,
  assembleAndSubmit,
  encodeProposalToFragment,
  DUAL_SIG_METHODS,
  type DualSigProposal,
  type SignedAuthEntry,
  DualSigError,
} from "@/app/lib/dual_sig_proposal";
import ButtonSpinner from "./ButtonSpinner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Party A's "propose" mode — builds the proposal and shows the shareable link. */
export interface ReplaceArbiterProposeProps {
  mode: "propose";
  /** Whether the modal is visible. */
  isOpen: boolean;
  onClose: () => void;
  /** Contract address of the escrow. */
  contractId: string;
  /** Public key of the initiating party (client or freelancer). */
  partyA: string;
  /** Public key of the counterparty who must co-sign. */
  partyB: string;
  /** New arbiter address being proposed. */
  newArbiter: string;
  /** Party A's wallet sign function (from WalletContext). */
  signTransaction: (xdr: string) => Promise<string>;
}

/** Party B's "review" mode — shows the summary, signs the auth entry, and submits. */
export interface ReplaceArbiterReviewProps {
  mode: "review";
  /** Whether the modal is visible. */
  isOpen: boolean;
  onClose: () => void;
  /** Decoded proposal to review. */
  proposal: DualSigProposal;
  /** Current Soroban ledger sequence (from an RPC call). `0` = unknown. */
  currentLedger: number;
  /** Party B's auth-entry signing function (wallet kit's `signAuthEntry`). */
  signAuthEntryFn: (entryXdr: string, opts: { address: string }) => Promise<string>;
  /** Party A's (or B's) transaction signing function for final submission. */
  signTransaction: (xdr: string) => Promise<string>;
  /** Called with the transaction hash on successful submission. */
  onSuccess?: (txHash: string) => void;
}

export type ReplaceArbiterModalProps =
  | ReplaceArbiterProposeProps
  | ReplaceArbiterReviewProps;

// ---------------------------------------------------------------------------
// Shared layout constants
// ---------------------------------------------------------------------------

const BACKDROP =
  "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4";

const PANEL =
  "w-full sm:max-w-lg rounded-t-xl sm:rounded-xl border border-border-subtle " +
  "bg-surface-card p-6 sm:p-8 shadow-lg";

const TITLE = "text-lg font-semibold text-text-primary mb-1";
const BODY = "text-sm text-text-secondary mb-4";
const LABEL = "block text-xs font-medium text-text-muted mb-1";
const VALUE =
  "w-full rounded-lg border border-border-subtle bg-surface-field px-3 py-2 " +
  "font-mono text-xs text-text-primary break-all";
const ERROR_BOX =
  "w-full rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-soft mb-3";
const SUCCESS_BOX =
  "w-full rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-soft mb-3";
const ACTIONS = "flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-5";
const BTN_CANCEL =
  "min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field " +
  "text-text-primary hover:bg-surface-card/50 text-sm font-medium transition " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg " +
  "bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Propose screen (party A)
// ---------------------------------------------------------------------------

function ProposeScreen({
  contractId,
  partyA,
  partyB,
  newArbiter,
  signTransaction,
  onClose,
}: Omit<ReplaceArbiterProposeProps, "mode" | "isOpen">) {
  const [phase, setPhase] = useState<"idle" | "building" | "done" | "error">("idle");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DualSigProposal | null>(null);
  const [signedEntry, setSignedEntry] = useState<SignedAuthEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleBuildProposal = useCallback(async () => {
    setPhase("building");
    setError(null);
    try {
      const built = await buildProposal({
        contractId,
        method: "replace_arbiter",
        args: [
          { type: "address", value: newArbiter },
        ],
        partyA,
        partyB,
      });
      setProposal(built);
      const fragment = encodeProposalToFragment(built);
      const url = `${window.location.origin}${window.location.pathname}#dual-sig=${fragment}`;
      setShareLink(url);
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof DualSigError || err instanceof Error
          ? err.message
          : "Could not build the proposal."
      );
      setPhase("error");
    }
  }, [contractId, partyA, partyB, newArbiter]);

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be blocked; fall back to no-op.
    }
  }, [shareLink]);

  // Party A can also self-submit when they already have both signatures
  // (e.g. a 1-of-2 escrow where party A is both initiator and final submitter).
  // For now party A only proposes; submission happens on the review screen.

  return (
    <>
      <h2 data-testid="replace-arbiter-modal-title" className={TITLE}>
        Replace Arbiter
      </h2>
      <p className={BODY}>
        Replacing an arbiter requires both the client and the freelancer to
        authorise the change in the same transaction. Create a proposal and share
        the link with the other party.
      </p>

      <dl className="mb-4 space-y-2 text-sm">
        <div>
          <dt className={LABEL}>New arbiter</dt>
          <dd>
            <span
              data-testid="replace-arbiter-new-arbiter"
              className={VALUE}
            >
              {newArbiter}
            </span>
          </dd>
        </div>
        <div>
          <dt className={LABEL}>Counterparty (must co-sign)</dt>
          <dd className="font-mono text-xs text-text-primary">{shortenAddress(partyB)}</dd>
        </div>
      </dl>

      {error && (
        <p data-testid="replace-arbiter-error" className={ERROR_BOX} role="alert">
          {error}
        </p>
      )}

      {shareLink && (
        <div className="mb-4">
          <dt className={LABEL}>Shareable link (send to counterparty)</dt>
          <div className="flex gap-2 items-start mt-1">
            <input
              readOnly
              data-testid="replace-arbiter-share-link"
              value={shareLink}
              className={`${VALUE} flex-1`}
              aria-label="Shareable proposal link"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              data-testid="replace-arbiter-copy-link"
              className={`${BTN_PRIMARY} shrink-0`}
              aria-label="Copy link to clipboard"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            The link encodes the proposal. The counterparty opens it, reviews,
            and signs. The entry expires after approximately 1 hour.
          </p>
        </div>
      )}

      {txHash && (
        <p data-testid="replace-arbiter-tx-hash" className={SUCCESS_BOX}>
          Submitted ✓ — tx hash:{" "}
          <span className="font-mono break-all">{txHash}</span>
        </p>
      )}

      <div className={ACTIONS}>
        <button
          type="button"
          onClick={onClose}
          disabled={phase === "building"}
          data-testid="replace-arbiter-cancel"
          className={BTN_CANCEL}
        >
          {phase === "done" ? "Close" : "Cancel"}
        </button>
        {phase !== "done" && (
          <button
            type="button"
            onClick={handleBuildProposal}
            disabled={phase === "building"}
            data-testid="replace-arbiter-build"
            className={BTN_PRIMARY}
          >
            {phase === "building" && <ButtonSpinner className="h-4 w-4" />}
            {phase === "building" ? "Building…" : "Create Proposal"}
          </button>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Review screen (party B)
// ---------------------------------------------------------------------------

function ReviewScreen({
  proposal,
  currentLedger,
  signAuthEntryFn,
  signTransaction,
  onClose,
  onSuccess,
}: Omit<ReplaceArbiterReviewProps, "mode" | "isOpen">) {
  const [phase, setPhase] = useState<"idle" | "signing" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const summary = describeProposal(proposal, currentLedger);

  const handleSignAndSubmit = useCallback(async () => {
    setPhase("signing");
    setError(null);
    try {
      const signed = await signAuthEntry(proposal, currentLedger, signAuthEntryFn);
      setPhase("submitting");
      const hash = await assembleAndSubmit({
        proposal,
        signedAuthEntry: signed,
        signTransaction,
      });
      setTxHash(hash);
      setPhase("done");
      onSuccess?.(hash);
    } catch (err) {
      setError(
        err instanceof DualSigError || err instanceof Error
          ? err.message
          : "An error occurred."
      );
      setPhase("error");
    }
  }, [proposal, currentLedger, signAuthEntryFn, signTransaction, onSuccess]);

  const actionLabel = DUAL_SIG_METHODS[proposal.method] ?? proposal.method;

  return (
    <>
      <h2 data-testid="replace-arbiter-modal-title" className={TITLE}>
        Review: {actionLabel}
      </h2>
      <p className={BODY}>
        Review the proposal below. Signing authorises your share of the
        transaction. The other party will assemble and submit before the entry
        expires.
      </p>

      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between border-b border-border-subtle pb-1">
          <dt className="text-text-muted">Action</dt>
          <dd data-testid="review-action-label" className="text-text-primary font-medium">
            {actionLabel}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border-subtle pb-1">
          <dt className="text-text-muted">Contract</dt>
          <dd className="font-mono text-xs text-text-primary break-all">
            {shortenAddress(summary.contractId)}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border-subtle pb-1">
          <dt className="text-text-muted">Proposed by</dt>
          <dd
            data-testid="review-initiator"
            className="font-mono text-xs text-text-primary"
          >
            {shortenAddress(summary.initiator)}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border-subtle pb-1">
          <dt className="text-text-muted">Your address (co-signer)</dt>
          <dd
            data-testid="review-counterparty"
            className="font-mono text-xs text-text-primary"
          >
            {shortenAddress(summary.counterparty)}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border-subtle pb-1">
          <dt className="text-text-muted">Expires at ledger</dt>
          <dd data-testid="review-expiry-ledger" className="font-mono text-xs text-text-primary">
            {summary.expirationLedger}
          </dd>
        </div>
        <div className="flex justify-between pb-1">
          <dt className="text-text-muted">Approx. expiry time</dt>
          <dd
            data-testid="review-expiry-time"
            className={`text-xs font-medium ${summary.isExpired ? "text-danger-soft" : "text-text-secondary"}`}
          >
            {summary.isExpired ? "Expired" : summary.expiresApproximately}
          </dd>
        </div>
      </dl>

      {summary.isExpired && (
        <p data-testid="replace-arbiter-expired" className={ERROR_BOX} role="alert">
          This proposal has expired (ledger {summary.expirationLedger} has
          passed). Ask the initiator to create a new one.
        </p>
      )}

      {error && (
        <p data-testid="replace-arbiter-error" className={ERROR_BOX} role="alert">
          {error}
        </p>
      )}

      {txHash && (
        <p data-testid="replace-arbiter-tx-hash" className={SUCCESS_BOX}>
          Submitted ✓ — tx hash:{" "}
          <span className="font-mono break-all">{txHash}</span>
        </p>
      )}

      <div className={ACTIONS}>
        <button
          type="button"
          onClick={onClose}
          disabled={phase === "signing" || phase === "submitting"}
          data-testid="replace-arbiter-cancel"
          className={BTN_CANCEL}
        >
          {phase === "done" ? "Close" : "Cancel"}
        </button>
        {phase !== "done" && (
          <button
            type="button"
            onClick={handleSignAndSubmit}
            disabled={
              summary.isExpired ||
              phase === "signing" ||
              phase === "submitting"
            }
            data-testid="replace-arbiter-sign-submit"
            className={BTN_PRIMARY}
          >
            {(phase === "signing" || phase === "submitting") && (
              <ButtonSpinner className="h-4 w-4" />
            )}
            {phase === "signing"
              ? "Signing…"
              : phase === "submitting"
                ? "Submitting…"
                : "Sign & Submit"}
          </button>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

export default function ReplaceArbiterModal(props: ReplaceArbiterModalProps) {
  if (!props.isOpen) return null;

  return (
    <div
      data-testid="replace-arbiter-modal"
      role="dialog"
      aria-modal="true"
      aria-label={props.mode === "propose" ? "Replace Arbiter" : "Review Replace Arbiter"}
      className={BACKDROP}
    >
      <div data-testid="replace-arbiter-modal-panel" className={PANEL}>
        {props.mode === "propose" ? (
          <ProposeScreen {...props} />
        ) : (
          <ReviewScreen {...props} />
        )}
      </div>
    </div>
  );
}
