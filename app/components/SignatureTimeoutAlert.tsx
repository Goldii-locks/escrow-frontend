"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import {
  createStellarEnvelopeParser,
  logWalletWarning,
  parseMultiSigEnvelope,
  type WalletMultiSigSigner,
} from "@/app/lib/wallet_state_context";
import { useAlbedoMultiSigAssembly } from "@/app/hooks/useAlbedoMultiSigAssembly";
import { useLedgerMultiSigAssembly } from "@/app/hooks/useLedgerMultiSigAssembly";
import { withWalletLoader } from "@/app/lib/wallet_state_context";
import ButtonSpinner from "./ButtonSpinner";

export interface SignatureTimeoutAlertProps {
  error?: unknown;
  isOpen?: boolean;
  transactionId?: string;
  transactionXdr?: string;
  signers?: WalletMultiSigSigner[];
  onRetry?: () => Promise<void> | void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Displays a recoverable wallet-signature timeout and the diagnostics needed
 * to continue a multisig flow without hiding a network mismatch.
 */
export default function SignatureTimeoutAlert({
  error,
  isOpen = false,
  transactionId,
  transactionXdr,
  signers = [],
  onRetry,
  onDismiss,
  className = "",
}: SignatureTimeoutAlertProps) {
  const {
    networkMismatchMessage,
    selectedWalletId,
    assembleMultiSigTransaction,
    signatureTimeoutError,
    signatureTimeoutXdr,
    clearSignatureTimeout,
  } = useWallet();
  const albedoAssembly = useAlbedoMultiSigAssembly(NETWORK_PASSPHRASE);
  const ledgerAssembly = useLedgerMultiSigAssembly(NETWORK_PASSPHRASE);
  const [isRetrying, setIsRetrying] = useState(false);

  const activeError = error ?? signatureTimeoutError;
  const activeTransactionXdr = transactionXdr ?? signatureTimeoutXdr ?? undefined;
  const hasTimeout =
    isOpen ||
    (activeError instanceof Error &&
      activeError.name === "WalletSignatureTimeoutError");

  useEffect(() => {
    if (!hasTimeout && !networkMismatchMessage) return;

    logWalletWarning("SIGNATURE TIMEOUT ALERT", "Wallet signature requires attention", {
      err: activeError,
      txId: transactionId,
      phase: "error",
    });
  }, [activeError, hasTimeout, networkMismatchMessage, transactionId]);

  const parseMessage = useMemo(() => {
    if (!activeTransactionXdr) return null;

    try {
      parseMultiSigEnvelope(activeTransactionXdr, {
        parseEnvelopeXdr: createStellarEnvelopeParser(NETWORK_PASSPHRASE),
      });
      return null;
    } catch (parseError) {
      return parseError instanceof Error ? parseError.message : String(parseError);
    }
  }, [activeTransactionXdr]);

  if (!hasTimeout && !networkMismatchMessage) return null;

  async function retry() {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await withWalletLoader(async () => {
        await onRetry();
      });
    } catch (retryError) {
      logWalletWarning("SIGNATURE RETRY FAILED", "Wallet signature retry failed", {
        err: retryError,
        txId: transactionId,
        phase: "error",
      });
    } finally {
      setIsRetrying(false);
    }
  }

  async function assemble() {
    if (!activeTransactionXdr || signers.length === 0) return;
    try {
      const assembly =
        selectedWalletId === "albedo" ? albedoAssembly : ledgerAssembly;
      assembly.parseStructure(activeTransactionXdr);
      const splits = signers.map((signer) => ({
        baseXdr: activeTransactionXdr,
        signer,
        signedXdr: activeTransactionXdr,
      }));
      await assembleMultiSigTransaction(splits);
    } catch (assemblyError) {
      logWalletWarning("MULTISIG ASSEMBLY FAILED", "Could not validate transaction signatures", {
        err: assemblyError,
        txId: transactionId,
        phase: "error",
      });
    }
  }

  return (
    <section
      role="alert"
      data-testid="signature-timeout-alert"
      className={`border border-warning-soft/40 bg-warning-soft/10 px-4 py-3 text-sm text-text-primary ${className}`}
    >
      {networkMismatchMessage && (
        <p data-testid="signature-timeout-network-warning" className="mb-2 font-medium text-warning-soft">
          {networkMismatchMessage}
        </p>
      )}
      {hasTimeout && (
        <>
          <h2 className="font-semibold">Signature request timed out</h2>
          <p className="mt-1 text-text-muted">
            The wallet did not return a signature. Check the selected wallet and try again.
          </p>
          {parseMessage && (
            <p data-testid="signature-timeout-transaction-error" className="mt-2 text-danger-soft">
              Transaction structure could not be parsed: {parseMessage}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button type="button" onClick={retry} disabled={isRetrying} data-testid="signature-timeout-retry">
                {isRetrying ? <ButtonSpinner className="h-4 w-4" /> : "Retry signature"}
              </button>
            )}
            {activeTransactionXdr && signers.length > 0 && (
              <button type="button" onClick={assemble} data-testid="signature-timeout-assemble">
                Validate multisig
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={() => {
                  clearSignatureTimeout();
                  onDismiss?.();
                }}
                data-testid="signature-timeout-dismiss"
              >
                Dismiss
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
