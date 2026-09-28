"use client";

import { useCallback, useMemo } from "react";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  AlbedoTransactionAssemblyError,
  assembleAlbedoMultiSigTransaction,
  createAlbedoMultiSigAssemblyPlan,
  findMissingAlbedoSigners,
  parseAlbedoTransactionStructure,
  splitAlbedoMultiSigTransactionParts,
  validateAlbedoMultiSigParts,
  type AlbedoMultiSigAssemblyPlan,
  type AlbedoMultiSigPart,
} from "@/app/lib/albedo_connector";

/**
 * React hook helpers for assembling multi-signature Albedo transactions.
 * Bound to a network passphrase so callers do not re-thread it everywhere.
 *
 * Provides a full transaction lifecycle:
 *   parseStructure → prepare → sign → assemble → validate
 *
 * The signing step is intentionally separated so callers can collect
 * signatures from multiple wallets before assembling the final XDR.
 */
export function useAlbedoMultiSigAssembly(networkPassphrase: string) {
  const parseStructure = useCallback(
    (transactionXdr: string) =>
      parseAlbedoTransactionStructure(transactionXdr, networkPassphrase),
    [networkPassphrase]
  );

  /**
   * Deserializes a transaction XDR into a Transaction object that can be
   * further modified (e.g. adding signatures) before re-serializing.
   */
  const prepareTransaction = useCallback(
    (transactionXdr: string) => {
      if (!transactionXdr || transactionXdr.trim().length === 0) {
        throw new AlbedoTransactionAssemblyError("missing transaction XDR");
      }
      try {
        const tx = TransactionBuilder.fromXDR(
          transactionXdr.trim(),
          networkPassphrase
        );
        return tx;
      } catch (err) {
        if (err instanceof AlbedoTransactionAssemblyError) throw err;
        throw new AlbedoTransactionAssemblyError(
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
        throw new AlbedoTransactionAssemblyError(
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
   * signatures independently.
   */
  const signTransaction = useCallback(
    async (
      transactionXdr: string,
      signFn: (xdr: string) => Promise<string>
    ): Promise<string> => {
      const trimmed = transactionXdr.trim();
      parseStructure(trimmed);
      return signFn(trimmed);
    },
    [parseStructure]
  );

  const assemble = useCallback(
    (baseXdr: string, parts: AlbedoMultiSigPart[]) =>
      assembleAlbedoMultiSigTransaction(baseXdr, parts, networkPassphrase),
    [networkPassphrase]
  );

  const planAssembly = useCallback(
    (baseXdr: string, signerPublicKeys: string[]) =>
      createAlbedoMultiSigAssemblyPlan(
        baseXdr,
        signerPublicKeys,
        networkPassphrase
      ),
    [networkPassphrase]
  );

  const splitParts = useCallback(
    (signedXdr: string, signerPublicKeys: string[]) =>
      splitAlbedoMultiSigTransactionParts(
        signedXdr,
        signerPublicKeys,
        networkPassphrase
      ),
    [networkPassphrase]
  );

  const validateParts = useCallback(
    (parts: AlbedoMultiSigPart[]) =>
      validateAlbedoMultiSigParts(parts, networkPassphrase),
    [networkPassphrase]
  );

  const missingSigners = useCallback(
    (plan: AlbedoMultiSigAssemblyPlan, collectedSignerPublicKeys: string[]) =>
      findMissingAlbedoSigners(plan, collectedSignerPublicKeys),
    []
  );

  return useMemo(
    () => ({
      parseStructure,
      prepareTransaction,
      serializeTransaction,
      signTransaction,
      assemble,
      planAssembly,
      splitParts,
      validateParts,
      missingSigners,
    }),
    [
      parseStructure,
      prepareTransaction,
      serializeTransaction,
      signTransaction,
      assemble,
      planAssembly,
      splitParts,
      validateParts,
      missingSigners,
    ]
  );
}
