/**
 * albedo_connector — multi-signature transaction assembly helpers for Albedo.
 *
 * Splits / merges transaction envelopes so multi-sig wallets can prepare XDR,
 * collect co-signatures via Albedo's secure popup signing flow, and assemble
 * a final envelope without exposing private keys in this module.
 */

import {
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const LOG_PREFIX = "[albedo_connector]";

export interface AlbedoMultiSigPart {
  signerPublicKey: string;
  signedXdr: string;
}

export interface AlbedoTransactionStructure {
  sourceAccount: string;
  fee: string;
  operationCount: number;
  signatureCount: number;
}

export interface AlbedoMultiSigAssemblyPlan {
  baseXdr: string;
  structure: AlbedoTransactionStructure;
  pendingSigners: string[];
}

export class AlbedoTransactionAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlbedoTransactionAssemblyError";
  }
}

function readAlbedoTransaction(
  transactionXdr: string,
  networkPassphrase: string
): Transaction {
  if (!transactionXdr || typeof transactionXdr !== "string") {
    throw new AlbedoTransactionAssemblyError("Missing transaction XDR");
  }
  if (!networkPassphrase) {
    throw new AlbedoTransactionAssemblyError("Missing network passphrase");
  }

  try {
    const envelope = TransactionBuilder.fromXDR(
      transactionXdr,
      networkPassphrase
    );
    if (envelope instanceof FeeBumpTransaction) {
      return envelope.innerTransaction;
    }
    return envelope as Transaction;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${LOG_PREFIX} failed to parse transaction XDR:`, message);
    throw new AlbedoTransactionAssemblyError(
      `Invalid transaction structure: ${message}`
    );
  }
}

/** Parses a transaction envelope without mutating signing state. */
export function parseAlbedoTransactionStructure(
  transactionXdr: string,
  networkPassphrase: string
): AlbedoTransactionStructure {
  const tx = readAlbedoTransaction(transactionXdr, networkPassphrase);
  return {
    sourceAccount: tx.source,
    fee: tx.fee,
    operationCount: tx.operations.length,
    signatureCount: tx.signatures.length,
  };
}

/** Validates that each partial signature envelope parses for the same network. */
export function validateAlbedoMultiSigParts(
  parts: AlbedoMultiSigPart[],
  networkPassphrase: string
): AlbedoTransactionStructure[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new AlbedoTransactionAssemblyError(
      "At least one multi-signature part is required"
    );
  }

  return parts.map((part, index) => {
    if (!part?.signerPublicKey) {
      throw new AlbedoTransactionAssemblyError(
        `Missing signer public key at part index ${index}`
      );
    }
    if (!part.signedXdr) {
      throw new AlbedoTransactionAssemblyError(
        `Missing signed XDR for signer ${part.signerPublicKey}`
      );
    }
    return parseAlbedoTransactionStructure(part.signedXdr, networkPassphrase);
  });
}

/**
 * Builds an assembly plan for co-signers that still need to sign the base XDR
 * via Albedo (or another wallet) without bypassing secure signing.
 */
export function createAlbedoMultiSigAssemblyPlan(
  baseXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): AlbedoMultiSigAssemblyPlan {
  if (!Array.isArray(signerPublicKeys) || signerPublicKeys.length === 0) {
    throw new AlbedoTransactionAssemblyError(
      "At least one signer public key is required"
    );
  }

  const structure = parseAlbedoTransactionStructure(
    baseXdr,
    networkPassphrase
  );

  return {
    baseXdr,
    structure,
    pendingSigners: [...signerPublicKeys],
  };
}

/**
 * Merges co-signer envelopes into a single multi-signature transaction XDR.
 * Existing single-signature envelopes remain valid (merge of one part works).
 */
export function assembleAlbedoMultiSigTransaction(
  baseXdr: string,
  parts: AlbedoMultiSigPart[],
  networkPassphrase: string
): string {
  validateAlbedoMultiSigParts(parts, networkPassphrase);
  const merged = readAlbedoTransaction(baseXdr, networkPassphrase);

  for (const part of parts) {
    const signed = readAlbedoTransaction(part.signedXdr, networkPassphrase);
    for (const signature of signed.signatures) {
      const alreadyPresent = merged.signatures.some((existing) =>
        existing.signature().equals(signature.signature())
      );
      if (!alreadyPresent) {
        merged.signatures.push(signature);
      }
    }
  }

  if (merged.signatures.length === 0) {
    throw new AlbedoTransactionAssemblyError(
      "Assembled transaction is missing signatures"
    );
  }

  return merged.toXDR();
}

/**
 * Splits a (partially) signed transaction into discrete signer parts for
 * Albedo co-signing workflows while preserving the shared XDR payload.
 */
export function splitAlbedoMultiSigTransactionParts(
  signedXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): AlbedoMultiSigPart[] {
  parseAlbedoTransactionStructure(signedXdr, networkPassphrase);

  if (!Array.isArray(signerPublicKeys) || signerPublicKeys.length === 0) {
    throw new AlbedoTransactionAssemblyError(
      "At least one signer public key is required to split parts"
    );
  }

  return signerPublicKeys.map((signerPublicKey) => ({
    signerPublicKey,
    signedXdr,
  }));
}

/**
 * Marks which pending signers from a plan are still missing after assembly.
 */
export function findMissingAlbedoSigners(
  plan: AlbedoMultiSigAssemblyPlan,
  collectedSignerPublicKeys: string[]
): string[] {
  const collected = new Set(collectedSignerPublicKeys);
  return plan.pendingSigners.filter((signer) => !collected.has(signer));
}
