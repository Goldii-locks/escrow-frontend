"use client";

import { useCallback, useMemo, useState } from "react";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  parseFreighterMultiSigEnvelope,
  createFreighterMultiSigSplit,
  signFreighterMultiSigSplit,
  assembleFreighterMultiSigTransaction,
  type FreighterMultiSigSignFn,
  type FreighterMultiSigSplit,
} from "@/app/lib/freighter_connector";
import {
  WalletMultiSigStructureError,
  createStellarEnvelopeParser,
  type WalletMultiSigAssemblyOptions,
  type WalletMultiSigAssemblyResult,
  type WalletMultiSigEnvelopeShape,
  type WalletMultiSigSigner,
} from "@/app/lib/wallet_state_context";

/**
 * React hook helpers for assembling multi-signature Freighter transactions.
 * Bound to a network passphrase so callers do not re-thread it everywhere.
 *
 * Provides a full transaction lifecycle:
 *   parseStructure → prepare → sign → assemble → validate
 *
 * The signing step is intentionally separated so callers can collect
 * signatures from multiple wallets before assembling the final XDR.
 */
export function useFreighterMultiSigAssembly(networkPassphrase: string) {
  const [pendingOps, setPendingOps] = useState(0);

  /**
   * Runs an async operation while tracking loading state. When any
   * operation is in flight, `isLoading` becomes true, allowing
   * transaction_signer_component to display a spinner overlay.
   */
  const withLoading = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setPendingOps((count) => count + 1);
      try {
        return await operation();
      } finally {
        setPendingOps((count) => count - 1);
      }
    },
    []
  );

  const parseStructure = useCallback(
    (transactionXdr: string): WalletMultiSigEnvelopeShape => {
      const envelopeParser = createStellarEnvelopeParser(networkPassphrase);
      return parseFreighterMultiSigEnvelope(transactionXdr, {
        parseEnvelopeXdr: envelopeParser,
        sourceAccount: null,
      });
    },
    [networkPassphrase]
  );

  /**
   * Deserializes a transaction XDR into a Transaction object that can be
   * further modified (e.g. adding signatures) before re-serializing.
   */
  const prepareTransaction = useCallback(
    (transactionXdr: string) => {
      if (!transactionXdr || transactionXdr.trim().length === 0) {
        throw new WalletMultiSigStructureError(
          "empty_xdr",
          "missing transaction XDR"
        );
      }
      try {
        const tx = TransactionBuilder.fromXDR(
          transactionXdr.trim(),
          networkPassphrase
        );
        return tx;
      } catch (err) {
        if (err instanceof WalletMultiSigStructureError) throw err;
        throw new WalletMultiSigStructureError(
          "envelope_parse_failure",
          err instanceof Error ? err.message : "invalid transaction XDR"
        );
      }
    },
    [networkPassphrase]
  );

  /**
   * Re-serializes a Transaction object back to XDR string.
   * Useful after modifying a transaction (e.g. adding signatures).
   */
  const serializeTransaction = useCallback(
    (transaction: ReturnType<typeof TransactionBuilder.fromXDR>) => {
      try {
        return transaction.toXDR();
      } catch (err) {
        throw new WalletMultiSigStructureError(
          "envelope_parse_failure",
          err instanceof Error
            ? err.message
            : "failed to serialize transaction"
        );
      }
    },
    []
  );

  /**
   * Signs a transaction XDR using the provided signing function and returns
   * the signed XDR. Separated from assembly so callers can collect
   * signatures independently. Triggers loading state during execution.
   */
  const signTransaction = useCallback(
    async (
      transactionXdr: string,
      signFn: (xdr: string) => Promise<string>
    ): Promise<string> => {
      const trimmed = transactionXdr.trim();
      parseStructure(trimmed);
      return withLoading(() => signFn(trimmed));
    },
    [parseStructure, withLoading]
  );

  /**
   * Creates a per-signer split from a base XDR envelope, ready to be
   * handed to Freighter for signing.
   */
  const createSplit = useCallback(
    (baseXdr: string, signer: WalletMultiSigSigner): FreighterMultiSigSplit => {
      return createFreighterMultiSigSplit(baseXdr, signer);
    },
    []
  );

  /**
   * Signs a split through Freighter using the provided signing function.
   * Triggers loading state during execution.
   */
  const signSplit = useCallback(
    async (
      split: FreighterMultiSigSplit,
      signFn: FreighterMultiSigSignFn,
      timeoutMs?: number
    ): Promise<FreighterMultiSigSplit> => {
      return withLoading(() => signFreighterMultiSigSplit(split, signFn, timeoutMs));
    },
    [withLoading]
  );

  /**
   * Validates a collection of signed splits as a coherent assembly:
   * every split's XDR is parsed, duplicate signers are rejected, and
   * the unique signer count is checked against the required minimum.
   */
  const assemble = useCallback(
    (
      splits: FreighterMultiSigSplit[],
      options?: WalletMultiSigAssemblyOptions
    ): WalletMultiSigAssemblyResult => {
      return assembleFreighterMultiSigTransaction(splits, options);
    },
    []
  );

  const isLoading = pendingOps > 0;

  return useMemo(
    () => ({
      isLoading,
      parseStructure,
      prepareTransaction,
      serializeTransaction,
      signTransaction,
      createSplit,
      signSplit,
      assemble,
    }),
    [
      isLoading,
      parseStructure,
      prepareTransaction,
      serializeTransaction,
      signTransaction,
      createSplit,
      signSplit,
      assemble,
    ]
  );
}
