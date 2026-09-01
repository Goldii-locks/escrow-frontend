"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkFreighterAvailability,
  FREIGHTER_INSTALL_URL,
  isFreighterUserRejected,
} from "@/app/lib/freighter_connector";
import {
  isWalletRejectedError,
} from "@/app/lib/errors";
import { useToast } from "@/app/context/ToastContext";
import {
  checkSimulationFeeWarning,
  type LedgerSimulationResult,
} from "@/app/lib/ledger_usb_bridge";
import {
  SUPPORTED_WALLETS,
  type SupportedWalletId,
} from "@/app/context/WalletContext";
import {
  checkNetworkMismatch,
  buildWalletSelectorMismatchMessage,
  subscribeToModalWalletLoading,
  withModalWalletLoader,
  walletSelectorStore,
  type WalletCachedKey,
} from "@/app/lib/wallet_selector_modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletSelectorModalStatus =
  | "idle"
  | "connecting"
  | "signing"
  | "rejected"
  | "error"
  | "unavailable";

export type WalletSelectorWalletId = SupportedWalletId;

export interface WalletSelectorModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;
  /** Called when the user requests the modal be closed. */
  onClose: () => void;
  /** Called when a wallet is successfully connected. */
  onConnect?: (walletId: SupportedWalletId) => void;
  /** Called when the user disconnects the active wallet. */
  onDisconnect?: () => void;
  /** The currently connected wallet address (null when disconnected). */
  activeAddress?: string | null;
  /** The currently selected wallet provider ID. */
  selectedWalletId?: SupportedWalletId;
  /** The wallet's current network passphrase (for mismatch detection). */
  walletNetwork?: string | null;
  /** The expected app network passphrase. */
  appNetwork?: string;
  /** Whether a connect/disconnect operation is currently in progress. */
  isLoading?: boolean;
  /** Current wallet provider error message (null when no error). */
  errorMessage?: string | null;
  /** Optional detector override for Freighter availability (useful in tests). */
  freighterDetector?: () => boolean;
  /** Optional detector override for window globals (useful in tests). */
  windowDetector?: () => boolean;
  /**
   * Fee simulation for the transaction about to be signed. When it reports a
   * failure or an unusually high fee, the modal surfaces a warning banner so
   * the cost is visible before the wallet prompt opens.
   */
  simulationResult?: LedgerSimulationResult | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detects if any supported browser wallet extension is installed.
 * Accepts optional detector overrides for test environments.
 */
export function detectAnyWalletExtension(
  detector?: () => boolean
): boolean {
  if (detector) {
    return detector();
  }
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as Record<string, unknown>;
  return !!(w["freighterApi"] || w["freighter"]);
}

/**
 * Catches and normalises wallet interaction errors. Returns a structured
 * result so the caller can decide how to surface the error to the user.
 */
export function handleWalletError(err: unknown): {
  isRejection: boolean;
  message: string;
  error: unknown;
} {
  if (isFreighterUserRejected(err) || isWalletRejectedError(err)) {
    const originalMessage =
      err instanceof Error ? err.message : "user rejected transaction";
    console.warn(
      "[wallet_selector_modal] signature rejected by user:",
      originalMessage
    );
    return {
      isRejection: true,
      message:
        "Signature cancelled — you rejected the request in your wallet.",
      error: err,
    };
  }

  const message =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  return {
    isRejection: false,
    message,
    error: err,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WalletSelectorModal({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  activeAddress = null,
  selectedWalletId = "freighter",
  walletNetwork = null,
  appNetwork = "Test SDF Network ; September 2015",
  isLoading = false,
  errorMessage = null,
  freighterDetector,
  simulationResult = null,
  className = "",
}: WalletSelectorModalProps) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<WalletSelectorModalStatus>("idle");
  const [modalLoading, setModalLoading] = useState(false);

  // Subscribe to loading-state changes from the loader wrapper
  useEffect(() => {
    return subscribeToModalWalletLoading((loading) => {
      setModalLoading(loading);
    });
  }, []);

  const effectiveLoading = isLoading || modalLoading || status === "connecting" || status === "signing";

  // Network mismatch detection
  const networkMismatch = checkNetworkMismatch(
    walletNetwork ?? "",
    appNetwork,
  );

  const mismatchMessage = buildWalletSelectorMismatchMessage(
    selectedWalletId,
    walletNetwork ?? "",
    appNetwork,
  );

  // Wallet availability — computed synchronously during render when the
  // modal opens.  `checkFreighterAvailability` is a pure sync call, so
  // there is no need for an effect (and it avoids the
  // react-hooks/set-state-in-effect lint rule).
  const availability = isOpen
    ? checkFreighterAvailability(freighterDetector)
    : null;

  // Gas estimation warning — derived from the simulation the caller passes in.
  // checkSimulationFeeWarning is a pure sync call, like the availability check
  // above, so it needs no effect.
  const gasWarning = simulationResult
    ? checkSimulationFeeWarning(simulationResult)
    : null;

  // Persistent caching: persist the cached key when the wallet connects
  useEffect(() => {
    if (activeAddress) {
      const cachedKey: WalletCachedKey = {
        walletId: selectedWalletId,
        address: activeAddress,
        networkPassphrase: walletNetwork ?? "",
        connectedAt: Date.now(),
      };
      walletSelectorStore.setCachedKey(cachedKey);
    }
  }, [activeAddress, selectedWalletId, walletNetwork]);

  const handleConnect = useCallback(
    async (walletId: SupportedWalletId) => {
      void withModalWalletLoader(async () => {
        setStatus("connecting");

        try {
          onConnect?.(walletId);
          setStatus("idle");
        } catch (err) {
          const result = handleWalletError(err);

          if (result.isRejection) {
            setStatus("rejected");
            showToast(result.message, "warning");
          } else {
            setStatus("error");
            showToast(
              "Failed to connect wallet. Please try again.",
              "error"
            );
          }
        }
      });
    },
    [onConnect, showToast]
  );

  const handleDisconnect = useCallback(() => {
    void withModalWalletLoader(async () => {
      onDisconnect?.();
    });
    onClose();
  }, [onDisconnect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="wallet-selector-modal"
      role="dialog"
      aria-label="Select Wallet"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-surface-page/80 ${className}`}
    >
      <div
        data-testid="wallet-selector-modal-content"
        className="bg-surface-card border border-border-subtle text-text-primary rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Select Wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="wallet-selector-modal-close"
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Network mismatch warning bar */}
        {networkMismatch.mismatched && mismatchMessage && (
          <div
            data-testid="wallet-selector-network-warning"
            className="bg-warning-soft/10 border border-warning-soft/40 rounded-lg px-4 py-3 mb-4 text-warning-soft text-sm"
            role="alert"
          >
            {mismatchMessage}
          </div>
        )}

        {/* Gas estimation warning */}
        {gasWarning?.hasWarning && (
          <div
            data-testid="wallet-selector-gas-warning"
            role="alert"
            className="bg-warning-soft/10 border border-warning-soft/40 rounded-lg px-4 py-3 mb-4 text-warning-soft text-sm"
          >
            {gasWarning.warningMessage}
          </div>
        )}

        {/* Wallet availability warning */}
        {availability && !availability.available && (
          <div
            data-testid="wallet-selector-availability-warning"
            role="alert"
            className="bg-warning-soft/10 border border-warning-soft/40 rounded-lg px-4 py-3 mb-4 text-warning-soft text-sm"
          >
            <p data-testid="wallet-selector-setup-instruction">
              {availability.setupInstruction}
            </p>
            <a
              href={FREIGHTER_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="wallet-selector-install-link"
              className="underline font-medium hover:opacity-80"
            >
              Install Freighter
            </a>
          </div>
        )}

        {/* Error message from props */}
        {errorMessage && (
          <div
            data-testid="wallet-selector-error-message"
            className="bg-danger/20 border border-danger/40 rounded-lg px-4 py-3 mb-4 text-danger-soft text-sm text-center"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {/* Rejection warning */}
        {status === "rejected" && (
          <div
            data-testid="wallet-selector-rejection-warning"
            role="alert"
            className="bg-warning-soft/10 border border-warning-soft/40 rounded-lg px-4 py-3 mb-4 text-sm text-warning-soft"
          >
            Signature cancelled — you rejected the request in your wallet.
          </div>
        )}

        {/* Error warning */}
        {status === "error" && (
          <div
            data-testid="wallet-selector-error-warning"
            role="alert"
            className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 mb-4 text-sm text-danger-soft"
          >
            Failed to connect wallet. Please try again.
          </div>
        )}

        {/* Loading spinner overlay */}
        {effectiveLoading && (
          <div
            data-testid="wallet-selector-spinner"
            className="absolute inset-0 z-10 flex items-center justify-center bg-surface-page/60 rounded-lg"
          >
            <div className="flex flex-col items-center space-y-2">
              <svg
                className="h-8 w-8 text-accent-soft animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-text-secondary">
                Wallet operation in progress…
              </span>
            </div>
          </div>
        )}

        {/* Active wallet info */}
        {activeAddress && (
          <div
            data-testid="wallet-selector-active-info"
            className="mb-4 p-3 border border-border-subtle rounded-lg bg-surface-field"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success-soft animate-pulse" />
                <span className="text-sm text-text-secondary font-mono">
                  {activeAddress.slice(0, 4)}...{activeAddress.slice(-4)}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={effectiveLoading}
                className="text-sm text-danger-soft hover:text-danger-soft-hover transition-colors disabled:opacity-50"
                data-testid="wallet-selector-disconnect-btn"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Wallet list */}
        <div className="space-y-2" data-testid="wallet-selector-list">
          {SUPPORTED_WALLETS.map((wallet) => {
            const isSelected = wallet.id === selectedWalletId;
            const isConnected =
              activeAddress !== null && wallet.id === selectedWalletId;

            return (
              <button
                key={wallet.id}
                type="button"
                data-testid={`wallet-selector-option-${wallet.id}`}
                onClick={() => handleConnect(wallet.id)}
                disabled={effectiveLoading}
                data-selected={isSelected}
                data-connected={isConnected}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-accent-soft bg-accent/10 text-text-primary"
                    : "border-border-subtle hover:border-accent-soft/60 hover:bg-surface-field text-text-primary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {wallet.label}
                  </span>
                  {isConnected && (
                    <span
                      data-testid="wallet-selector-connected-badge"
                      className="text-xs text-success-soft"
                    >
                      Connected
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
