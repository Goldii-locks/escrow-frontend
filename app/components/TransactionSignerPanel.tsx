"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useWalletMultiSigAssembly,
  WalletMultiSigParseError,
  type MultiSigTransactionStructure,
} from "@/app/hooks/useWalletMultiSigAssembly";
import { type SupportedWalletId } from "@/app/context/WalletContext";
import ButtonSpinner from "@/app/components/ButtonSpinner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// ---------------------------------------------------------------------------
// Internal state type
// ---------------------------------------------------------------------------

type SignerState =
  | "idle"        // XDR parsed, ready to sign
  | "signing"     // sign call in-flight
  | "success"     // signed XDR returned
  | "error"       // signing threw
  | "parse-error"; // XDR failed to parse on mount

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TransactionSignerPanelProps {
  /** Raw base-64 XDR string to be reviewed and signed. */
  xdr: string;
  /** Active wallet — passed to useWalletMultiSigAssembly for routing. */
  selectedWalletId: SupportedWalletId;
  /**
   * Network passphrase used for XDR parsing and signing.
   * Defaults to Stellar Testnet.
   */
  networkPassphrase?: string;
  /**
   * The sign function from WalletContext (or any compatible async fn).
   * Receives the raw XDR and must return the signed XDR string.
   */
  signTransaction: (xdr: string) => Promise<string>;
  /** Called with the signed XDR after a successful sign. */
  onSigned: (signedXdr: string) => void;
  /** Called when the user clicks Cancel (before or after a failure). */
  onRejected?: () => void;
  /**
   * Called on signing failure in addition to the inline error display.
   * Useful for parent-level toasts or logging.
   */
  onError?: (error: string) => void;
  /** Optional label shown above the transaction preview. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Sub-component: structure preview
// ---------------------------------------------------------------------------

function StructurePreview({
  structure,
}: {
  structure: MultiSigTransactionStructure;
}) {
  return (
    <dl
      data-testid="tx-signer-structure-preview"
      className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs"
    >
      <dt className="font-medium text-gray-400">Source</dt>
      <dd
        className="font-mono text-gray-200 truncate"
        title={structure.sourceAccount}
      >
        {structure.sourceAccount
          ? `${structure.sourceAccount.slice(0, 6)}…${structure.sourceAccount.slice(-4)}`
          : "—"}
      </dd>

      {structure.fee ? (
        <>
          <dt className="font-medium text-gray-400">Fee</dt>
          <dd className="text-gray-200">{structure.fee} stroops</dd>
        </>
      ) : null}

      <dt className="font-medium text-gray-400">Operations</dt>
      <dd className="text-gray-200">{structure.operationCount}</dd>

      <dt className="font-medium text-gray-400">Existing signatures</dt>
      <dd className="text-gray-200">{structure.signatureCount}</dd>
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * TransactionSignerPanel
 *
 * A wallet-agnostic sign-transaction interface. On mount it parses the
 * supplied XDR, shows a human-readable structure preview (source account,
 * fee, operation count, existing signature count), then lets the user
 * confirm or cancel before the wallet extension is invoked.
 *
 * Signing is fully delegated to `useWalletMultiSigAssembly.signTransaction`
 * so no XDR parsing or signing logic lives here.
 *
 * States: idle → signing → success | error | parse-error
 */
export default function TransactionSignerPanel({
  xdr,
  selectedWalletId,
  networkPassphrase = TESTNET_PASSPHRASE,
  signTransaction,
  onSigned,
  onRejected,
  onError,
  label,
}: TransactionSignerPanelProps) {
  const hook = useWalletMultiSigAssembly(networkPassphrase, selectedWalletId);

  const [signingState, setSigningState] = useState<SignerState>("idle");
  const [signingError, setSigningError] = useState<string | null>(null);

  // Parsing is a pure function of the XDR and the wallet/network in play, so
  // it is derived during render rather than written to state from an effect --
  // the latter is what `react-hooks/set-state-in-effect` flags as a source of
  // cascading renders.
  const parsed = useMemo<{
    structure: MultiSigTransactionStructure | null;
    error: string | null;
  }>(() => {
    try {
      return { structure: hook.parseStructure(xdr), error: null };
    } catch (err) {
      const message =
        err instanceof WalletMultiSigParseError || err instanceof Error
          ? err.message
          : "Failed to parse transaction XDR.";
      return { structure: null, error: message };
    }
    // `selectedWalletId` and `networkPassphrase` reach this through `hook`,
    // which is rebuilt when either changes.
  }, [xdr, hook]);

  const structure = parsed.structure;
  const parseErrorMessage = parsed.error;

  // A parse failure outranks whatever the signing lifecycle last recorded.
  const state: SignerState = parseErrorMessage ? "parse-error" : signingState;

  const handleSign = useCallback(async () => {
    setSigningState("signing");
    setSigningError(null);
    try {
      const signedXdr = await hook.signTransaction(xdr, signTransaction);
      setSigningState("success");
      onSigned(signedXdr);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Signing failed.";
      setSigningError(message);
      setSigningState("error");
      onError?.(message);
    }
  }, [hook, xdr, signTransaction, onSigned, onError]);

  const handleCancel = useCallback(() => {
    setSigningState("idle");
    setSigningError(null);
    onRejected?.();
  }, [onRejected]);

  const handleRetry = useCallback(() => {
    setSigningState("idle");
    setSigningError(null);
  }, []);

  const isBusy = state === "signing";

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded";

  // ── Parse error ─────────────────────────────────────────────────────────────
  if (state === "parse-error") {
    return (
      <div
        data-testid="tx-signer-panel"
        data-state="parse-error"
        className="flex flex-col gap-4 bg-gray-900 border border-gray-700 rounded-xl p-5"
      >
        {label && (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {label}
          </p>
        )}
        <p
          role="alert"
          data-testid="tx-signer-parse-error"
          className="text-sm text-red-400"
        >
          {parseErrorMessage ?? "Invalid transaction XDR."}
        </p>
        {onRejected && (
          <button
            type="button"
            data-testid="tx-signer-cancel-btn"
            onClick={handleCancel}
            className={`self-start bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div
        data-testid="tx-signer-panel"
        data-state="success"
        className="flex flex-col gap-3 bg-gray-900 border border-gray-700 rounded-xl p-5"
      >
        {label && (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {label}
          </p>
        )}
        <p
          data-testid="tx-signer-success-message"
          className="text-sm text-green-400 font-medium"
        >
          Transaction signed successfully.
        </p>
      </div>
    );
  }

  // ── Idle / signing / error ───────────────────────────────────────────────────
  return (
    <div
      data-testid="tx-signer-panel"
      data-state={state}
      className="flex flex-col gap-4 bg-gray-900 border border-gray-700 rounded-xl p-5"
    >
      {/* Optional label */}
      {label && (
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </p>
      )}

      {/* Transaction structure preview */}
      {structure && <StructurePreview structure={structure} />}

      {/* Signing error */}
      {state === "error" && signingError && (
        <p
          role="alert"
          data-testid="tx-signer-error"
          className="text-sm text-red-400"
        >
          {signingError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {/* Sign / Retry button */}
        {state === "error" ? (
          <button
            type="button"
            data-testid="tx-signer-retry-btn"
            onClick={handleRetry}
            className={`bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
          >
            Retry
          </button>
        ) : (
          <button
            type="button"
            data-testid="tx-signer-sign-btn"
            onClick={handleSign}
            disabled={isBusy}
            className={`bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
          >
            {isBusy ? (
              <span className="flex items-center gap-2">
                <ButtonSpinner className="h-3.5 w-3.5" />
                Signing…
              </span>
            ) : (
              "Sign transaction"
            )}
          </button>
        )}

        {/* Cancel button */}
        <button
          type="button"
          data-testid="tx-signer-cancel-btn"
          onClick={handleCancel}
          disabled={isBusy}
          className={`bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
