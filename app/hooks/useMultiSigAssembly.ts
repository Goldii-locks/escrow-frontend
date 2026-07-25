"use client";

/**
 * useMultiSigAssembly
 *
 * React hook for the network_sync_checker multi-signature transaction helper.
 * Manages the assembly of a multi-sig Stellar transaction across multiple
 * wallet signers.
 *
 * Issue #159 – Integrate multi-signature transaction helper hooks in
 *              network_sync_checker.
 */

import { useCallback, useState } from "react";
import {
  type MultiSigAssembly,
  createMultiSigAssembly,
  addSignerToAssembly,
  isAssemblyComplete,
  getFinalSignedXdr,
  getAssemblySummary,
  validateAssemblyNetwork,
  InsufficientSignaturesError,
  DuplicateSignerError,
  NetworkPassphraseMismatchError,
} from "@/app/lib/network_sync_checker_multisig";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";

export interface MultiSigAssemblyState {
  assembly: MultiSigAssembly | null;
  error: string | null;
}

export interface UseMultiSigAssemblyReturn {
  /** Current assembly state. */
  state: MultiSigAssemblyState;
  /** Start a new multi-sig assembly for the given XDR envelope. */
  startAssembly: (baseXdr: string, requiredSigners: number) => void;
  /**
   * Add the current wallet's signature to the active assembly.
   * Returns the updated assembly or null on error.
   */
  addSignature: (signerAddress: string, signedXdr: string) => MultiSigAssembly | null;
  /** True when enough signatures have been collected to submit. */
  isComplete: boolean;
  /**
   * Retrieve the final signed XDR ready for submission.
   * Returns null and sets error if assembly is incomplete or null.
   */
  getFinalXdr: () => string | null;
  /** Summary of current assembly progress. */
  summary: ReturnType<typeof getAssemblySummary> | null;
  /** Reset the assembly state back to null. */
  reset: () => void;
}

const DEFAULT_STATE: MultiSigAssemblyState = {
  assembly: null,
  error: null,
};

export function useMultiSigAssembly(): UseMultiSigAssemblyReturn {
  const [state, setState] = useState<MultiSigAssemblyState>(DEFAULT_STATE);

  const startAssembly = useCallback(
    (baseXdr: string, requiredSigners: number) => {
      try {
        const assembly = createMultiSigAssembly(
          baseXdr,
          requiredSigners,
          NETWORK_PASSPHRASE
        );
        setState({ assembly, error: null });
      } catch (err) {
        setState({
          assembly: null,
          error: err instanceof Error ? err.message : "Failed to start assembly.",
        });
      }
    },
    []
  );

  const addSignature = useCallback(
    (signerAddress: string, signedXdr: string): MultiSigAssembly | null => {
      if (!state.assembly) {
        setState((prev) => ({
          ...prev,
          error: "No active assembly. Call startAssembly first.",
        }));
        return null;
      }

      try {
        const updated = addSignerToAssembly(state.assembly, signerAddress, signedXdr);
        setState({ assembly: updated, error: null });
        return updated;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to add signature.",
        }));
        return null;
      }
    },
    [state.assembly]
  );

  const getFinalXdr = useCallback((): string | null => {
    if (!state.assembly) {
      setState((prev) => ({
        ...prev,
        error: "No active assembly.",
      }));
      return null;
    }

    try {
      validateAssemblyNetwork(state.assembly);
      return getFinalSignedXdr(state.assembly);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to retrieve final XDR.",
      }));
      return null;
    }
  }, [state.assembly]);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const isComplete = state.assembly ? isAssemblyComplete(state.assembly) : false;
  const summary = state.assembly ? getAssemblySummary(state.assembly) : null;

  return {
    state,
    startAssembly,
    addSignature,
    isComplete,
    getFinalXdr,
    summary,
    reset,
  };
}

// Re-export error types so consumers can do typed catches without a separate import.
export { InsufficientSignaturesError, DuplicateSignerError, NetworkPassphraseMismatchError };
