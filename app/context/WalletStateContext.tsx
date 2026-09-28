"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

// ----------------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------------

export type WalletAvailabilityStatus =
  | "checking"
  | "available"
  | "unavailable"
  | "error";

export interface WalletStateContextValue {
  /** Current availability status of the Freighter extension. */
  availabilityStatus: WalletAvailabilityStatus;
  /** True while the availability check is in progress. */
  isChecking: boolean;
  /** True when the Freighter extension is confirmed to be installed. */
  isAvailable: boolean;
  /**
   * Human-readable setup instruction shown to the user when the wallet
   * extension is not detected. Null when no instruction is needed.
   */
  setupInstruction: string | null;
  /** Re-runs the availability check (e.g., after the user installs the extension). */
  recheckAvailability: () => void;
  /** True while a transaction signing operation is in progress. */
  isTransactionSigning: boolean;
  /** Sets the transaction signing state to true (e.g., when a signing call starts). */
  startTransactionSigning: () => void;
  /** Sets the transaction signing state to false (e.g., when a signing call ends). */
  endTransactionSigning: () => void;
}

// ----------------------------------------------------------------------------------
// Setup instruction copy
// ----------------------------------------------------------------------------------

export const FREIGHTER_INSTALL_URL =
  "https://www.freighter.app/";

export const FREIGHTER_SETUP_INSTRUCTION =
  "Freighter wallet extension not found. " +
  "Install Freighter from freighter.app and refresh this page to continue.";

// ----------------------------------------------------------------------------------
// Availability detection
// ----------------------------------------------------------------------------------

/**
 * Detects whether the Freighter browser extension is installed by inspecting
 * `window.freighterApi`. Works in SSR-safe environments by checking for a
 * `window` global first.
 */
export function detectFreighterExtension(): boolean {
  if (typeof window === "undefined") return false;
  // Freighter injects `window.freighterApi` when its extension is active.
  return !!(
    (window as unknown as Record<string, unknown>)["freighterApi"]
  );
}

// ----------------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------------

const defaultValue: WalletStateContextValue = {
  availabilityStatus: "checking",
  isChecking: true,
  isAvailable: false,
  setupInstruction: null,
  recheckAvailability: () => {},
  isTransactionSigning: false,
  startTransactionSigning: () => {},
  endTransactionSigning: () => {},
};

const WalletStateContext =
  createContext<WalletStateContextValue>(defaultValue);

// ----------------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------------

export function WalletStateProvider({ children }: { children: ReactNode }) {
  const [availabilityStatus, setAvailabilityStatus] =
    useState<WalletAvailabilityStatus>("checking");

  const [checkTrigger, setCheckTrigger] = useState(0);

  const [isTransactionSigning, setIsTransactionSigning] = useState(false);

  useEffect(() => {
    // Setting checking state synchronously is acceptable here because we're
    // displaying a loading/transition state while the async detection runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailabilityStatus("checking");

    // Small timeout allows the extension to inject `window.freighterApi`
    // before we inspect it (extension scripts may load asynchronously).
    const timer = setTimeout(() => {
      try {
        const found = detectFreighterExtension();
        setAvailabilityStatus(found ? "available" : "unavailable");
      } catch {
        setAvailabilityStatus("error");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [checkTrigger]);

  const recheckAvailability = useCallback(() => {
    setCheckTrigger((n) => n + 1);
  }, []);

  const startTransactionSigning = useCallback(() => {
    setIsTransactionSigning(true);
  }, []);

  const endTransactionSigning = useCallback(() => {
    setIsTransactionSigning(false);
  }, []);

  const isChecking = availabilityStatus === "checking";
  const isAvailable = availabilityStatus === "available";

  const setupInstruction =
    availabilityStatus === "unavailable" || availabilityStatus === "error"
      ? FREIGHTER_SETUP_INSTRUCTION
      : null;

  return (
    <WalletStateContext.Provider
      value={{
        availabilityStatus,
        isChecking,
        isAvailable,
        setupInstruction,
        recheckAvailability,
        isTransactionSigning,
        startTransactionSigning,
        endTransactionSigning,
      }}
    >
      {children}
    </WalletStateContext.Provider>
  );
}

export function useWalletState(): WalletStateContextValue {
  return useContext(WalletStateContext);
}
