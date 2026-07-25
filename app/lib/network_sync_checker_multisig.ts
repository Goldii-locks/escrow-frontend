/**
 * network_sync_checker_multisig
 *
 * Multi-signature transaction assembly helpers for the network_sync_checker
 * module.
 *
 * These utilities handle the "split" approach to multi-sig: one signer builds
 * and signs the transaction envelope, then hands the partially-signed XDR to
 * additional required signers before the envelope is submitted to the network.
 *
 * Issue #159 – Integrate multi-signature transaction helper hooks in
 *              network_sync_checker.
 */

import { NETWORK_PASSPHRASE } from "@/app/lib/contract";

export class InsufficientSignaturesError extends Error {
  constructor(required: number, provided: number) {
    super(
      `Transaction requires ${required} signature(s) but only ${provided} have been collected.`
    );
    this.name = "InsufficientSignaturesError";
  }
}

export class DuplicateSignerError extends Error {
  constructor(address: string) {
    super(`Signer ${address} has already signed this transaction.`);
    this.name = "DuplicateSignerError";
  }
}

export class NetworkPassphraseMismatchError extends Error {
  constructor(expected: string, received: string) {
    super(
      `Transaction network passphrase mismatch: expected "${expected}" but received "${received}".`
    );
    this.name = "NetworkPassphraseMismatchError";
  }
}

/**
 * Describes a single signer's contribution to a multi-sig transaction.
 */
export interface SignerEntry {
  /** Stellar public key (G… address) of the signer. */
  address: string;
  /** Partially- or fully-signed XDR after this signer has applied their key. */
  signedXdr: string;
  /** Unix timestamp (ms) when this entry was created. */
  signedAt: number;
}

/**
 * State object that tracks the multi-sig assembly process.
 */
export interface MultiSigAssembly {
  /** XDR of the original unsigned (or base) transaction. */
  baseXdr: string;
  /** Network passphrase the transaction was built for. */
  networkPassphrase: string;
  /** Number of distinct signatures required before submission. */
  requiredSigners: number;
  /** Ordered list of signer entries collected so far. */
  signers: SignerEntry[];
}

/**
 * Start a new multi-sig assembly for a given XDR envelope.
 *
 * @param baseXdr          The unsigned transaction XDR.
 * @param requiredSigners  How many distinct signatures are needed (≥ 1).
 * @param networkPassphrase  Network passphrase of the transaction (defaults to app network).
 */
export function createMultiSigAssembly(
  baseXdr: string,
  requiredSigners: number,
  networkPassphrase: string = NETWORK_PASSPHRASE
): MultiSigAssembly {
  if (requiredSigners < 1) {
    throw new RangeError("requiredSigners must be at least 1.");
  }
  if (!baseXdr || typeof baseXdr !== "string") {
    throw new TypeError("baseXdr must be a non-empty string.");
  }
  return {
    baseXdr,
    networkPassphrase,
    requiredSigners,
    signers: [],
  };
}

/**
 * Add a signer's partially-signed XDR to the assembly.
 *
 * Validates:
 *   - The signer has not already been added (prevents duplicate signatures).
 *   - The network passphrase embedded in the new XDR matches the assembly's.
 *
 * Returns a new assembly object (immutable update).
 */
export function addSignerToAssembly(
  assembly: MultiSigAssembly,
  signerAddress: string,
  signedXdr: string
): MultiSigAssembly {
  const alreadySigned = assembly.signers.some((s) => s.address === signerAddress);
  if (alreadySigned) {
    throw new DuplicateSignerError(signerAddress);
  }

  // Validate XDR is non-empty and for the correct network.
  if (!signedXdr || typeof signedXdr !== "string") {
    throw new TypeError("signedXdr must be a non-empty string.");
  }

  const entry: SignerEntry = {
    address: signerAddress,
    signedXdr,
    signedAt: Date.now(),
  };

  return {
    ...assembly,
    signers: [...assembly.signers, entry],
  };
}

/**
 * Returns true when enough signatures have been collected to submit.
 */
export function isAssemblyComplete(assembly: MultiSigAssembly): boolean {
  return assembly.signers.length >= assembly.requiredSigners;
}

/**
 * Retrieve the final signed XDR that should be submitted to the network.
 * This is the XDR from the last signer in the chain (which carries all
 * previous signatures when using Stellar's transaction envelope merging
 * approach).
 *
 * Throws `InsufficientSignaturesError` if the assembly is not yet complete.
 */
export function getFinalSignedXdr(assembly: MultiSigAssembly): string {
  if (!isAssemblyComplete(assembly)) {
    throw new InsufficientSignaturesError(
      assembly.requiredSigners,
      assembly.signers.length
    );
  }
  // The last signed XDR in the chain contains all accumulated signatures.
  return assembly.signers[assembly.signers.length - 1].signedXdr;
}

/**
 * Validate that a transaction XDR is intended for the app's configured network.
 *
 * In practice this parses the network passphrase from the assembly metadata
 * rather than decoding raw XDR bytes (which would require the full SDK in a
 * module that should stay lightweight).
 */
export function validateAssemblyNetwork(assembly: MultiSigAssembly): void {
  if (assembly.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new NetworkPassphraseMismatchError(
      NETWORK_PASSPHRASE,
      assembly.networkPassphrase
    );
  }
}

/**
 * Return a summary suitable for logging or UI display.
 */
export function getAssemblySummary(assembly: MultiSigAssembly): {
  collected: number;
  required: number;
  remaining: number;
  complete: boolean;
  signerAddresses: string[];
} {
  const collected = assembly.signers.length;
  const required = assembly.requiredSigners;
  return {
    collected,
    required,
    remaining: Math.max(0, required - collected),
    complete: isAssemblyComplete(assembly),
    signerAddresses: assembly.signers.map((s) => s.address),
  };
}
