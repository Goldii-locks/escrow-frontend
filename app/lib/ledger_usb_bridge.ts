/**
 * Ledger USB bridge — hardware wallet transport helpers:
 * WebUSB/WebHID transport availability detection, signature timeouts,
 * rejection handling, and network mismatch checks.
 */

import {
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { ToastType } from "@/app/context/ToastContext";

export const DEFAULT_SIGNATURE_TIMEOUT_MS = 60_000;

/** Official Ledger setup/support URL surfaced when the browser transport is unsupported. */
export const LEDGER_SETUP_URL = "https://support.ledger.com/article/4404389482525-connect-my-ledger-to-ledger-live";

/** Supported browsers list shown in setup instructions. */
export const LEDGER_SUPPORTED_BROWSERS = "Chrome, Edge, Brave, or Opera";

/** Fallback copy shown when WebUSB/WebHID transport is not available in the user's browser. */
export const LEDGER_SETUP_INSTRUCTION =
  "Your browser does not support connecting to Ledger hardware wallets. Ledger USB connections require WebUSB or WebHID support. Please switch to a supported browser (" +
  LEDGER_SUPPORTED_BROWSERS +
  ") and ensure your Ledger is connected via USB cable (not Bluetooth).";

export type LedgerTransportStatus = "available" | "unavailable" | "error";

export interface LedgerAvailabilityState {
  available: boolean;
  status: LedgerTransportStatus;
  /** Which transport API was detected (if any), for debug/context. */
  transportType: "webusb" | "webhid" | "both" | "none";
  /** User-facing setup instructions when the transport is missing. */
  setupInstruction: string | null;
  warningMessage: string | null;
}

export type LedgerNetwork = "mainnet" | "testnet";

export interface LedgerSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

export interface LedgerSignResult {
  signedXdr: string;
}

export type LedgerToastHandler = (message: string, type: ToastType) => void;

export type LedgerTxPhase =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

export interface LedgerTxTrackEntry {
  txId: string;
  phase: LedgerTxPhase;
  message: string;
  timestamp: number;
  stack?: string;
}

export interface LedgerConsoleWarningBlock {
  title: string;
  body: string;
  stack: string;
  txId?: string;
  phase?: LedgerTxPhase;
}

const WARN_PREFIX = "[ledger_usb_bridge]";

/**
 * Detects whether the current browser environment supports the required
 * transport APIs for Ledger hardware wallet connections (WebUSB or WebHID).
 * Accepts an optional detector override for tests / non-browser runtimes.
 *
 * Note: this only checks API availability, not whether a device is actually
 * plugged in. "Available transport ≠ device connected".
 */
export function detectLedgerTransport(
  detector?: () => { hasWebUsb: boolean; hasWebHid: boolean }
): { hasWebUsb: boolean; hasWebHid: boolean } {
  if (detector) {
    return detector();
  }
  if (typeof navigator === "undefined") {
    return { hasWebUsb: false, hasWebHid: false };
  }
  const nav = navigator as unknown as Record<string, unknown>;
  return {
    hasWebUsb: typeof nav["usb"] !== "undefined",
    hasWebHid: typeof nav["hid"] !== "undefined",
  };
}

/**
 * Normalizes the raw transport detection result into a single transport type
 * label used for debug/context in the availability state.
 */
export function classifyTransportType(
  hasWebUsb: boolean,
  hasWebHid: boolean
): LedgerAvailabilityState["transportType"] {
  if (hasWebUsb && hasWebHid) return "both";
  if (hasWebUsb) return "webusb";
  if (hasWebHid) return "webhid";
  return "none";
}

/**
 * Checks Ledger transport availability (WebUSB / WebHID browser support) and
 * returns fallback setup instructions when neither transport is available or
 * the check itself throws.
 *
 * Distinguishes three outcomes:
 *   - "available"   → at least one transport API present; safe to attempt connect
 *   - "unavailable" → no transport APIs; browser cannot talk to Ledger
 *   - "error"       → the detector itself threw unexpectedly
 */
export function checkLedgerAvailability(
  detector?: () => { hasWebUsb: boolean; hasWebHid: boolean }
): LedgerAvailabilityState {
  try {
    const { hasWebUsb, hasWebHid } = detectLedgerTransport(detector);
    const available = hasWebUsb || hasWebHid;
    const transportType = classifyTransportType(hasWebUsb, hasWebHid);

    if (available) {
      return {
        available: true,
        status: "available",
        transportType,
        setupInstruction: null,
        warningMessage: null,
      };
    }
    return {
      available: false,
      status: "unavailable",
      transportType,
      setupInstruction: LEDGER_SETUP_INSTRUCTION,
      warningMessage: LEDGER_SETUP_INSTRUCTION,
    };
  } catch (err) {
    console.warn(
      `${WARN_PREFIX} ledger transport availability check failed:`,
      err instanceof Error ? err.message : err
    );
    return {
      available: false,
      status: "error",
      transportType: "none",
      setupInstruction: LEDGER_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify Ledger transport support. ${LEDGER_SETUP_INSTRUCTION}`,
    };
  }
}

/**
 * Runs a Ledger transport availability check and surfaces a warning toast
 * when the required browser APIs are missing or the check errors.
 */
export function warnOnMissingLedgerTransport(
  showToast: LedgerToastHandler,
  detector?: () => { hasWebUsb: boolean; hasWebHid: boolean }
): LedgerAvailabilityState {
  const state = checkLedgerAvailability(detector);
  if (!state.available && state.warningMessage) {
    showToast(state.warningMessage, "warning");
  }
  return state;
}

/** Captures a normalized stack string from an error or the current call site. */
export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(
    typeof err === "string" ? err : "Ledger USB bridge trace"
  );
  return synthetic.stack ?? "Error: Ledger USB bridge trace";
}

/** Builds a multi-line console warning block for transaction debug tracking. */
export function formatConsoleWarningBlock(
  block: LedgerConsoleWarningBlock
): string {
  const lines = [
    `${WARN_PREFIX} ╔══════════════════════════════════════╗`,
    `${WARN_PREFIX} ║ ${block.title.padEnd(36).slice(0, 36)} ║`,
    `${WARN_PREFIX} ╚══════════════════════════════════════╝`,
    `${WARN_PREFIX} ${block.body}`,
  ];

  if (block.txId) {
    lines.push(`${WARN_PREFIX} txId: ${block.txId}`);
  }
  if (block.phase) {
    lines.push(`${WARN_PREFIX} phase: ${block.phase}`);
  }

  lines.push(`${WARN_PREFIX} --- stack trace ---`);
  for (const frame of block.stack.split("\n")) {
    lines.push(`${WARN_PREFIX} ${frame}`);
  }
  lines.push(`${WARN_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

/** Logs a formatted warning block (including stack) to the console. */
export function logLedgerWarning(
  title: string,
  body: string,
  options?: { err?: unknown; txId?: string; phase?: LedgerTxPhase }
): string {
  const stack = formatStackTrace(options?.err);
  const formatted = formatConsoleWarningBlock({
    title,
    body,
    stack,
    txId: options?.txId,
    phase: options?.phase,
  });
  console.warn(formatted);
  return formatted;
}

export class LedgerTransactionTracker {
  private entries: LedgerTxTrackEntry[] = [];

  track(
    txId: string,
    phase: LedgerTxPhase,
    message: string,
    err?: unknown
  ): LedgerTxTrackEntry {
    const entry: LedgerTxTrackEntry = {
      txId,
      phase,
      message,
      timestamp: Date.now(),
      stack: formatStackTrace(err),
    };
    this.entries.push(entry);

    logLedgerWarning(`TX ${phase.toUpperCase()}`, message, {
      err,
      txId,
      phase,
    });

    return entry;
  }

  getHistory(txId?: string): LedgerTxTrackEntry[] {
    if (!txId) return [...this.entries];
    return this.entries.filter((e) => e.txId === txId);
  }

  clear(): void {
    this.entries = [];
  }
}

export const ledgerTracker = new LedgerTransactionTracker();

export class LedgerSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Ledger signature timed out after ${timeoutMs}ms`);
    this.name = "LedgerSignatureTimeoutError";
  }
}

export class LedgerUserRejectedError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "LedgerUserRejectedError";
  }
}

export class LedgerNetworkMismatchError extends Error {
  constructor(
    public readonly walletNetwork: LedgerNetwork,
    public readonly appNetwork: LedgerNetwork
  ) {
    super(
      `Network mismatch: wallet is on ${walletNetwork}, app expects ${appNetwork}`
    );
    this.name = "LedgerNetworkMismatchError";
  }
}

export function isUserRejectedError(err: unknown): boolean {
  if (err instanceof LedgerUserRejectedError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user")
  );
}

/** Zeroes and drops a sensitive buffer so it cannot be retained after abort. */
export function clearSensitiveMemory(
  request: LedgerSignRequest
): LedgerSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

import {
  endLedgerOperation,
  startLedgerOperation,
} from "./ledger_loader";

export {
  isLedgerLoading,
  subscribeToLedgerLoading,
  startLedgerOperation,
  endLedgerOperation,
  resetLedgerOperations,
} from "./ledger_loader";

/**
 * Executes an async ledger operation wrapped in the loading overlay lifecycle.
 * Uses a try/finally pattern to ensure the loader is hidden even on errors.
 */
export async function withLedgerLoader<T>(fn: () => Promise<T>): Promise<T> {
  startLedgerOperation();
  try {
    return await fn();
  } finally {
    endLedgerOperation();
  }
}

/**
 * Mock/Placeholder for connect operation wrapped in the loader lifecycle.
 */
export async function connectLedgerDevice(delayMs = 50): Promise<void> {
  return withLedgerLoader(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });
}

/**
 * Mock/Placeholder for app open operation wrapped in the loader lifecycle.
 */
export async function openLedgerApp(delayMs = 50): Promise<void> {
  return withLedgerLoader(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });
}

/**
 * Mock/Placeholder for getting public address wrapped in the loader lifecycle.
 */
export async function getLedgerAddress(delayMs = 50): Promise<string> {
  return withLedgerLoader(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return "G...";
  });
}

/**
 * Races a signature operation against a timeout clock. On timeout the
 * operation is considered aborted and any sensitive payload memory is cleared.
 */
export async function signWithTimeout(
  request: LedgerSignRequest,
  signFn: (xdr: string) => Promise<LedgerSignResult>,
  timeoutMs: number = DEFAULT_SIGNATURE_TIMEOUT_MS
): Promise<LedgerSignResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearSensitiveMemory(request);
      reject(new LedgerSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await withLedgerLoader(() =>
      Promise.race([signFn(request.xdr), timeoutPromise])
    );
    clearSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof LedgerSignatureTimeoutError) {
      clearSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Catches wallet "user rejected transaction" exceptions and surfaces a clean
 * warning toast instead of a raw error dump.
 */
export async function signCatchingRejection(
  signFn: () => Promise<LedgerSignResult>,
  showToast: LedgerToastHandler
): Promise<LedgerSignResult | null> {
  return withLedgerLoader(async () => {
    try {
      return await signFn();
    } catch (err) {
      if (isUserRejectedError(err)) {
        logLedgerWarning(
          "SIGNATURE REJECTED",
          err instanceof Error ? err.message : String(err),
          { err, phase: "signing" }
        );
        showToast(
          "Transaction cancelled — you rejected the signature on your Ledger.",
          "warning"
        );
        return null;
      }
      throw err;
    }
  });
}

export interface NetworkMismatchState {
  mismatched: boolean;
  walletNetwork: LedgerNetwork;
  appNetwork: LedgerNetwork;
  warningMessage: string | null;
}

export function checkNetworkMatch(
  walletNetwork: LedgerNetwork,
  appNetwork: LedgerNetwork
): NetworkMismatchState {
  const mismatched = walletNetwork !== appNetwork;
  return {
    mismatched,
    walletNetwork,
    appNetwork,
    warningMessage: mismatched
      ? `Network mismatch: your Ledger is on ${capitalize(walletNetwork)} but this app uses ${capitalize(appNetwork)}. Switch networks to continue.`
      : null,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface LedgerMultiSigPart {
  signerPublicKey: string;
  signedXdr: string;
}

export interface LedgerTransactionStructure {
  sourceAccount: string;
  fee: string;
  operationCount: number;
  signatureCount: number;
}

export interface LedgerMultiSigAssemblyPlan {
  baseXdr: string;
  structure: LedgerTransactionStructure;
  pendingSigners: string[];
}

function readLedgerTransaction(
  transactionXdr: string,
  networkPassphrase: string
): Transaction {
  const envelope = TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase
  );
  if (envelope instanceof FeeBumpTransaction) {
    return envelope.innerTransaction;
  }
  return envelope as Transaction;
}

/** Parses a transaction envelope without mutating signing state. */
export function parseLedgerTransactionStructure(
  transactionXdr: string,
  networkPassphrase: string
): LedgerTransactionStructure {
  const tx = readLedgerTransaction(transactionXdr, networkPassphrase);
  return {
    sourceAccount: tx.source,
    fee: tx.fee,
    operationCount: tx.operations.length,
    signatureCount: tx.signatures.length,
  };
}

/** Validates that each partial signature envelope parses for the same network. */
export function validateMultiSigParts(
  parts: LedgerMultiSigPart[],
  networkPassphrase: string
): LedgerTransactionStructure[] {
  return parts.map((part) =>
    parseLedgerTransactionStructure(part.signedXdr, networkPassphrase)
  );
}

/**
 * Builds an assembly plan for co-signers that still need to sign the base XDR.
 */
export function createMultiSigAssemblyPlan(
  baseXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): LedgerMultiSigAssemblyPlan {
  const structure = parseLedgerTransactionStructure(
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
 */
export function assembleMultiSigTransaction(
  baseXdr: string,
  parts: LedgerMultiSigPart[],
  networkPassphrase: string
): string {
  validateMultiSigParts(parts, networkPassphrase);
  const merged = readLedgerTransaction(baseXdr, networkPassphrase);

  for (const part of parts) {
    const signed = readLedgerTransaction(part.signedXdr, networkPassphrase);
    for (const signature of signed.signatures) {
      const alreadyPresent = merged.signatures.some((existing) =>
        existing.signature().equals(signature.signature())
      );
      if (!alreadyPresent) {
        merged.signatures.push(signature);
      }
    }
  }

  return merged.toXDR();
}

/**
 * Splits a partially signed transaction into discrete signer parts for Ledger
 * co-signing workflows.
 */
export function splitMultiSigTransactionParts(
  signedXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): LedgerMultiSigPart[] {
  parseLedgerTransactionStructure(signedXdr, networkPassphrase);
  return signerPublicKeys.map((signerPublicKey) => ({
    signerPublicKey,
    signedXdr,
  }));
}

import {
  checkSimulationFeeWarning,
  type LedgerGasWarningState,
  type LedgerSimulationResult,
} from "./simulation_fee_warning";

export {
  checkSimulationFeeWarning,
  HIGH_FEE_THRESHOLD_STROOPS,
  type LedgerGasWarningState,
  type LedgerSimulationResult,
} from "./simulation_fee_warning";

/**
 * Inspects a simulation result and, when a warning applies, emits a
 * formatted console warning block via ledger_usb_bridge debug machinery.
 */
export function warnOnSimulationFee(
  result: LedgerSimulationResult,
  options?: { txId?: string }
): LedgerGasWarningState {
  const state = checkSimulationFeeWarning(result);

  if (state.hasWarning && state.warningMessage) {
    const title = state.simulationError ? "SIMULATION ERROR" : "HIGH FEE WARNING";
    logLedgerWarning(title, state.warningMessage, {
      err: new Error(state.warningMessage),
      txId: options?.txId,
      phase: "building",
    });
  }

  return state;
}

export {
  ledgerActiveAddresses,
  LedgerActiveAddressStore,
  LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION,
  LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY,
  type LedgerActiveAddress,
} from "./ledger_active_addresses";


export interface MultiSigTxPayload {
  signatures: Array<{ publicKey: string; signature?: string }>;
  threshold: number;
  rawTransaction: string;
}

export function parseMultiSigTxPayload(payload: unknown): MultiSigTxPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: must be an object");
  }
  const tx = payload as Partial<MultiSigTxPayload>;
  if (!Array.isArray(tx.signatures)) {
    throw new Error("Invalid payload: missing signatures array");
  }
  if (typeof tx.threshold !== "number" || tx.threshold <= 0) {
    throw new Error("Invalid payload: threshold must be a positive number");
  }
  if (typeof tx.rawTransaction !== "string" || tx.rawTransaction.trim() === "") {
    throw new Error("Invalid payload: rawTransaction must be a non-empty string");
  }
  return {
    signatures: tx.signatures,
    threshold: tx.threshold,
    rawTransaction: tx.rawTransaction,
  };
}

/**
 * Reports whether a multi-sig payload has gathered enough signatures to meet
 * its threshold. Distinct from `assembleMultiSigTransaction` above, which
 * merges co-signer envelopes into a single signed XDR.
 */
export function evaluateMultiSigAssembly(tx: MultiSigTxPayload): { isReady: boolean; validSignaturesCount: number } {
  const validSignaturesCount = tx.signatures.filter((s) => Boolean(s.signature)).length;
  return {
    isReady: validSignaturesCount >= tx.threshold,
    validSignaturesCount,
  };
}

/**
 * Runs a network match check and, on mismatch, emits a formatted console
 * warning block (with stack) for Ledger transaction debug tracking.
 */
export function warnOnLedgerNetworkMismatch(
  walletNetwork: LedgerNetwork,
  appNetwork: LedgerNetwork
): NetworkMismatchState {
  const state = checkNetworkMatch(walletNetwork, appNetwork);
  if (state.mismatched && state.warningMessage) {
    logLedgerWarning("NETWORK MISMATCH", state.warningMessage, {
      err: new LedgerNetworkMismatchError(walletNetwork, appNetwork),
    });
  }
  return state;
}
