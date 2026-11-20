"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { ActionState } from "@/app/hooks/useActionStates";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { formatBaseUnits } from "@/app/lib/amounts";
import {
  NOTHING_TO_SWEEP_MESSAGE,
  previewSweepExcess,
  validateSweepTokenInput,
  type SweepPreview,
} from "@/app/lib/sweep_excess";
import { validateTokenContract } from "@/app/lib/token_validation";

export interface RecoverExcessFundsProps {
  /** The escrow contract (the job id). */
  contractId: string;
  /** The connected client's address; the caller and the recipient. */
  clientAddress: string;
  /** The job's settlement token, checked automatically. */
  jobToken?: string | null;
  jobTokenSymbol?: string;
  jobTokenDecimals?: number;
  /** Submits `sweep_excess(client, token)`; resolves to the tx hash or null. */
  onSweep: (token: string) => Promise<string | null>;
  /** Transaction state for a sweep of `token`. */
  getSweepState: (token: string) => ActionState;
  /** Whether a sweep of `token` is in flight. */
  isSweepPending: (token: string) => boolean;
}

interface TokenTarget {
  address: string;
  symbol: string;
  decimals: number;
}

type CheckState = { status: "idle" } | { status: "checking" } | SweepPreview;

const btn =
  "inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Client-only "Recover excess funds" panel (#898). Checks what
 * `sweep_excess` would pay for the job's token and offers the action only
 * when the surplus is positive; a second form checks any other token.
 * The amount is confirmed before anything is signed.
 */
export default function RecoverExcessFunds({
  contractId,
  clientAddress,
  jobToken,
  jobTokenSymbol,
  jobTokenDecimals,
  onSweep,
  getSweepState,
  isSweepPending,
}: RecoverExcessFundsProps) {
  const inputId = useId();
  const [jobCheck, setJobCheck] = useState<CheckState>({ status: "idle" });
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherInput, setOtherInput] = useState("");
  const [otherInputError, setOtherInputError] = useState<string | null>(null);
  const [otherTarget, setOtherTarget] = useState<TokenTarget | null>(null);
  const [otherCheck, setOtherCheck] = useState<CheckState>({ status: "idle" });
  /** The token whose sweep is waiting for confirmation. */
  const [confirming, setConfirming] = useState<"job" | "other" | null>(null);

  const checkJobToken = useCallback(async () => {
    if (!jobToken) return;
    setJobCheck({ status: "checking" });
    setJobCheck(await previewSweepExcess(contractId, clientAddress, jobToken));
  }, [contractId, clientAddress, jobToken]);

  useEffect(() => {
    let active = true;
    if (!jobToken) return;
    void previewSweepExcess(contractId, clientAddress, jobToken).then((result) => {
      if (active) setJobCheck(result);
    });
    return () => {
      active = false;
    };
  }, [contractId, clientAddress, jobToken]);

  async function handleCheckOther() {
    const error = validateSweepTokenInput(otherInput);
    setOtherInputError(error);
    if (error) return;

    const address = otherInput.trim();
    setConfirming(null);
    setOtherCheck({ status: "checking" });
    const [preview, token] = await Promise.all([
      previewSweepExcess(contractId, clientAddress, address),
      validateTokenContract(address),
    ]);
    setOtherTarget({
      address,
      symbol: token.valid && token.symbol ? token.symbol : "units",
      // Unknown decimals → show raw base units rather than guess a scale.
      decimals: token.valid && typeof token.decimals === "number" ? token.decimals : 0,
    });
    setOtherCheck(preview);
  }

  async function handleConfirm(kind: "job" | "other") {
    const token = kind === "job" ? jobToken : otherTarget?.address;
    if (!token) return;
    setConfirming(null);
    const txHash = await onSweep(token);
    if (txHash !== null) {
      if (kind === "job") await checkJobToken();
      else setOtherCheck(await previewSweepExcess(contractId, clientAddress, token));
    }
  }

  const jobTarget: TokenTarget | null = jobToken
    ? {
        address: jobToken,
        symbol: jobTokenSymbol ?? `${jobToken.slice(0, 4)}…${jobToken.slice(-4)}`,
        decimals: jobTokenDecimals ?? 0,
      }
    : null;
  const jobState = jobToken ? getSweepState(jobToken) : null;
  const otherState = otherTarget ? getSweepState(otherTarget.address) : null;
  const showJobPanel =
    jobTarget !== null &&
    (jobCheck.status === "available" || (jobState && jobState.phase !== "idle"));

  function renderSweepRow(kind: "job" | "other", target: TokenTarget, check: CheckState) {
    const pending = isSweepPending(target.address);
    if (check.status !== "available") return null;
    const amountText = `${formatBaseUnits(check.amount.toString(), { decimals: target.decimals })} ${target.symbol}`;

    if (confirming === kind) {
      return (
        <div
          data-testid={`sweep-confirm-${kind}`}
          role="group"
          aria-label="Confirm recovery"
          className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-field p-3 text-xs"
        >
          <p className="text-text-secondary">
            Recover <span className="font-mono text-text-primary">{amountText}</span> to your
            wallet? Only tokens the escrow doesn&apos;t owe anyone are sent.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={`${btn} border border-border-subtle bg-surface-card text-text-primary focus-visible:ring-accent-soft`}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid={`sweep-confirm-${kind}-button`}
              onClick={() => void handleConfirm(kind)}
              className={`${btn} bg-success text-surface-page hover:bg-success/80 focus-visible:ring-success-soft`}
            >
              Confirm recovery
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Recoverable:{" "}
          <span data-testid={`sweep-amount-${kind}`} className="font-mono text-text-primary">
            {amountText}
          </span>
        </p>
        <button
          type="button"
          data-testid={`sweep-button-${kind}`}
          onClick={() => setConfirming(kind)}
          disabled={pending}
          className={`${btn} bg-accent-soft text-text-primary hover:bg-accent-soft/80 focus-visible:ring-accent-soft`}
        >
          {pending && <ButtonSpinner />}
          {pending ? "Recovering…" : "Recover excess funds"}
        </button>
      </div>
    );
  }

  return (
    <section
      data-testid="recover-excess-funds"
      aria-label="Recover excess funds"
      className="space-y-2"
    >
      {showJobPanel && jobTarget && (
        <div className="rounded-lg border border-border-subtle bg-surface-card p-3 space-y-2">
          <p className="text-sm font-semibold text-text-primary">Recover excess funds</p>
          <p className="text-xs text-text-muted">
            This escrow holds more {jobTarget.symbol} than it owes (for example an extra deposit).
            You can send the surplus back to your wallet.
          </p>
          {renderSweepRow("job", jobTarget, jobCheck)}
          {jobState && jobState.phase !== "idle" && (
            <TxStatusBanner state={jobState} successMessage="Excess funds recovered." />
          )}
        </div>
      )}

      <div className="text-xs">
        <button
          type="button"
          data-testid="sweep-other-toggle"
          onClick={() => setOtherOpen((open) => !open)}
          aria-expanded={otherOpen}
          className="text-text-muted underline-offset-2 hover:underline hover:text-text-secondary"
        >
          {otherOpen ? "Hide token recovery" : "Sent a different token to this escrow by mistake?"}
        </button>
      </div>

      {otherOpen && (
        <div
          data-testid="sweep-other-panel"
          className="rounded-lg border border-border-subtle bg-surface-card p-3 space-y-2"
        >
          <label htmlFor={inputId} className="block text-xs text-text-muted">
            Token contract address
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type="text"
              data-testid="sweep-other-input"
              value={otherInput}
              onChange={(e) => {
                setOtherInput(e.target.value);
                setOtherInputError(null);
                setOtherCheck({ status: "idle" });
                setConfirming(null);
              }}
              placeholder="C…"
              spellCheck={false}
              aria-invalid={!!otherInputError}
              aria-describedby={otherInputError ? `${inputId}-error` : undefined}
              className="min-w-0 flex-1 font-mono text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
            <button
              type="button"
              data-testid="sweep-other-check"
              onClick={() => void handleCheckOther()}
              disabled={otherCheck.status === "checking"}
              className={`${btn} border border-border-subtle bg-surface-field text-text-primary focus-visible:ring-accent-soft`}
            >
              {otherCheck.status === "checking" && <ButtonSpinner />}
              Check balance
            </button>
          </div>
          {otherInputError && (
            <p id={`${inputId}-error`} role="alert" className="text-xs text-danger-soft">
              {otherInputError}
            </p>
          )}
          {otherCheck.status === "nothing" && (
            <p role="status" data-testid="sweep-other-nothing" className="text-xs text-text-muted">
              {NOTHING_TO_SWEEP_MESSAGE}
            </p>
          )}
          {otherCheck.status === "error" && (
            <p role="alert" className="text-xs text-danger-soft">
              {otherCheck.message}
            </p>
          )}
          {otherTarget && renderSweepRow("other", otherTarget, otherCheck)}
          {otherState && otherState.phase !== "idle" && (
            <TxStatusBanner state={otherState} successMessage="Tokens recovered." />
          )}
        </div>
      )}
    </section>
  );
}
