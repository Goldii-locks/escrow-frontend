"use client";

import { useCallback, useMemo } from "react";
import {
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
 */
export function useAlbedoMultiSigAssembly(networkPassphrase: string) {
  const parseStructure = useCallback(
    (transactionXdr: string) =>
      parseAlbedoTransactionStructure(transactionXdr, networkPassphrase),
    [networkPassphrase]
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
      assemble,
      planAssembly,
      splitParts,
      validateParts,
      missingSigners,
    }),
    [
      parseStructure,
      assemble,
      planAssembly,
      splitParts,
      validateParts,
      missingSigners,
    ]
  );
}
