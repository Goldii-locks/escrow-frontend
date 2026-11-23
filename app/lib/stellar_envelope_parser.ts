/**
 * Stellar SDK-backed envelope parser.
 *
 * Kept out of `wallet_state_context` so the SDK is not part of the globally
 * mounted wallet provider's first-load bundle (#850). Only the signature
 * timeout alert (loaded on demand) imports this module.
 */
import { TransactionBuilder } from "@stellar/stellar-sdk";

export interface WalletMultiSigEnvelopeParsed {
  signatures: number;
  sourceAccount: string | null;
}

const LOG_PREFIX = "[wallet_state_context]";

/** Pulls the source account off a parsed envelope, handling Transaction and FeeBump shapes. */
function extractSourceAccount(env: unknown): string | null {
  if (!env || typeof env !== "object") return null;
  const record = env as Record<string, unknown>;
  const source = record["source"];
  if (source) {
    const stringified = stringifyStellarAccount(source);
    if (stringified) return stringified;
  }
  const feeSource = record["feeSource"] ?? record["feeAccount"];
  if (feeSource) {
    const stringified = stringifyStellarAccount(feeSource);
    if (stringified) return stringified;
  }
  return null;
}

function stringifyStellarAccount(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const accountId = candidate["accountId"];
  if (typeof accountId === "function") {
    try {
      const result = (accountId as () => unknown).call(value);
      if (typeof result === "string" && result.length > 0) return result;
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} stellar accountId() extraction failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return null;
}

export function createStellarEnvelopeParser(
  networkPassphrase: string
): (baseXdr: string) => WalletMultiSigEnvelopeParsed {
  if (
    typeof networkPassphrase !== "string" ||
    networkPassphrase.trim().length === 0
  ) {
    throw new Error(
      `${LOG_PREFIX} createStellarEnvelopeParser requires a non-empty network passphrase.`
    );
  }
  const passphrase = networkPassphrase;
  return (baseXdr: string): WalletMultiSigEnvelopeParsed => {
    const env = TransactionBuilder.fromXDR(baseXdr, passphrase);
    if (!Array.isArray(env?.signatures)) {
      throw new Error(
        `${LOG_PREFIX} createStellarEnvelopeParser: TransactionBuilder.fromXDR returned a shape without a signatures array.`
      );
    }
    return {
      signatures: env.signatures.length,
      sourceAccount: extractSourceAccount(env),
    };
  };
}
