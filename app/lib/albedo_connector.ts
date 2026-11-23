/**
 * albedo_connector — formatted console warnings/errors and transaction
 * lifecycle tracking for Albedo popup wallet debugging, plus wallet
 * availability checks, network mismatch warnings, signature timeout
 * bounds, and graceful handling of user signature rejections.
 *
 * Never logs private keys, seeds, credentials, or full sensitive payloads.
 */

import type { ToastType } from "@/app/context/ToastContext";
import {
  FeeBumpTransaction,
  type Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export type AlbedoTxPhase =
  | "idle"
  | "building"
  | "simulating"
  | "assembling"
  | "popup"
  | "signing"
  | "signed"
  | "submitting"
  | "confirming"
  | "success"
  | "error"
  | "cancelled";

export interface AlbedoTxTrackEntry {
  txId: string;
  phase: AlbedoTxPhase;
  message: string;
  timestamp: number;
  network?: string;
  operationType?: string;
  txHash?: string;
  stack?: string;
}

export interface AlbedoConsoleBlock {
  title: string;
  body: string;
  stack: string;
  txId?: string;
  phase?: AlbedoTxPhase;
  network?: string;
  operationType?: string;
  txHash?: string;
}

export interface AlbedoLogContext {
  err?: unknown;
  txId?: string;
  phase?: AlbedoTxPhase;
  network?: string;
  operationType?: string;
  txHash?: string;
}

const WARN_PREFIX = "[albedo_connector]";

const SENSITIVE_KEY_PATTERN =
  /(secret|private[_-]?key|seed|mnemonic|password|credential|auth[_-]?token)/i;

/** Captures a normalized stack string from an error or the current call site. */
export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(
    typeof err === "string" ? err : "Albedo connector trace"
  );
  return synthetic.stack ?? "Error: Albedo connector trace";
}

/** Redacts accidental sensitive substrings from log bodies. */
export function sanitizeAlbedoLogText(text: string): string {
  return text
    .replace(/S[A-Z2-7]{55}/g, "[REDACTED_SECRET]")
    .replace(
      /(secret|privateKey|seed|mnemonic|password|token)\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]"
    );
}

function assertNoSensitiveFields(context?: AlbedoLogContext): void {
  if (!context) return;
  for (const key of Object.keys(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      throw new Error(
        `${WARN_PREFIX} refused to log sensitive field "${key}"`
      );
    }
  }
}

/** Builds a multi-line console block for transaction debug tracking. */
export function formatConsoleWarningBlock(block: AlbedoConsoleBlock): string {
  const title = sanitizeAlbedoLogText(block.title);
  const body = sanitizeAlbedoLogText(block.body);
  const stack = sanitizeAlbedoLogText(block.stack);

  const lines = [
    `${WARN_PREFIX} ╔══════════════════════════════════════╗`,
    `${WARN_PREFIX} ║ ${title.padEnd(36).slice(0, 36)} ║`,
    `${WARN_PREFIX} ╚══════════════════════════════════════╝`,
    `${WARN_PREFIX} ${body}`,
  ];

  if (block.txId) {
    lines.push(`${WARN_PREFIX} txId: ${sanitizeAlbedoLogText(block.txId)}`);
  }
  if (block.txHash) {
    lines.push(
      `${WARN_PREFIX} txHash: ${sanitizeAlbedoLogText(block.txHash)}`
    );
  }
  if (block.phase) {
    lines.push(`${WARN_PREFIX} phase: ${block.phase}`);
  }
  if (block.network) {
    lines.push(
      `${WARN_PREFIX} network: ${sanitizeAlbedoLogText(block.network)}`
    );
  }
  if (block.operationType) {
    lines.push(
      `${WARN_PREFIX} operation: ${sanitizeAlbedoLogText(block.operationType)}`
    );
  }

  lines.push(`${WARN_PREFIX} --- stack trace ---`);
  for (const frame of stack.split("\n")) {
    lines.push(`${WARN_PREFIX} ${frame}`);
  }
  lines.push(`${WARN_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

function buildBlock(
  title: string,
  body: string,
  options?: AlbedoLogContext
): { formatted: string; stack: string } {
  assertNoSensitiveFields(options);
  const stack = formatStackTrace(options?.err);
  const formatted = formatConsoleWarningBlock({
    title,
    body,
    stack,
    txId: options?.txId,
    phase: options?.phase,
    network: options?.network,
    operationType: options?.operationType,
    txHash: options?.txHash,
  });
  return { formatted, stack };
}

/** Logs a formatted warning block (including stack) via console.warn. */
export function logAlbedoWarning(
  title: string,
  body: string,
  options?: AlbedoLogContext
): string {
  const { formatted } = buildBlock(title, body, options);
  console.warn(formatted);
  return formatted;
}

/**
 * Logs a formatted error block via console.error while preserving the original
 * error object (and its stack) as a secondary argument when available.
 */
export function logAlbedoError(
  title: string,
  body: string,
  options?: AlbedoLogContext
): string {
  const { formatted } = buildBlock(title, body, options);
  if (options?.err instanceof Error) {
    console.error(formatted, options.err);
  } else if (options?.err !== undefined) {
    console.error(formatted, options.err);
  } else {
    console.error(formatted);
  }
  return formatted;
}

export class AlbedoTransactionTracker {
  private entries: AlbedoTxTrackEntry[] = [];

  track(
    txId: string,
    phase: AlbedoTxPhase,
    message: string,
    options?: Omit<AlbedoLogContext, "txId" | "phase"> & { err?: unknown }
  ): AlbedoTxTrackEntry {
    const stack = formatStackTrace(options?.err);
    const entry: AlbedoTxTrackEntry = {
      txId,
      phase,
      message: sanitizeAlbedoLogText(message),
      timestamp: Date.now(),
      network: options?.network,
      operationType: options?.operationType,
      txHash: options?.txHash,
      stack,
    };
    this.entries.push(entry);

    const title = `TX ${phase.toUpperCase()}`;
    const logOptions: AlbedoLogContext = {
      err: options?.err,
      txId,
      phase,
      network: options?.network,
      operationType: options?.operationType,
      txHash: options?.txHash,
    };

    if (phase === "error") {
      logAlbedoError(title, message, logOptions);
    } else {
      logAlbedoWarning(title, message, logOptions);
    }

    return entry;
  }

  getHistory(txId?: string): AlbedoTxTrackEntry[] {
    if (!txId) return [...this.entries];
    return this.entries.filter((e) => e.txId === txId);
  }

  clear(): void {
    this.entries = [];
  }
}

export const albedoTracker = new AlbedoTransactionTracker();

/**
 * Convenience helpers for common Albedo transaction lifecycle stages.
 * Avoids duplicate noisy logs by going through the shared tracker.
 */
export function trackAlbedoLifecycle(
  txId: string,
  phase: AlbedoTxPhase,
  message: string,
  options?: Omit<AlbedoLogContext, "txId" | "phase">
): AlbedoTxTrackEntry {
  return albedoTracker.track(txId, phase, message, options);
}

// ---------------------------------------------------------------------------
// Wallet availability checks (#123)
// ---------------------------------------------------------------------------

/** Install URL surfaced when no Albedo wallet is detected. */
export const ALBEDO_INSTALL_URL = "https://albedo.link/";

/** Fallback copy shown when the Albedo wallet is missing. */
export const ALBEDO_SETUP_INSTRUCTION =
  "Albedo wallet not detected. Install Albedo and refresh this page to continue.";

export type AlbedoAvailabilityStatus = "available" | "unavailable" | "error";

export interface AlbedoAvailabilityState {
  available: boolean;
  status: AlbedoAvailabilityStatus;
  /** User-facing setup instructions when the wallet is missing. */
  setupInstruction: string | null;
  warningMessage: string | null;
}

export type AlbedoToastHandler = (message: string, type: ToastType) => void;

/**
 * Detects whether the Albedo wallet is present. Accepts an optional detector
 * override for tests / non-browser runtimes.
 */
export function detectAlbedoExtension(detector?: () => boolean): boolean {
  if (detector) {
    return detector();
  }
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as Record<string, unknown>;
  return !!(w["albedo"] || w["albedoApi"]);
}

/**
 * Checks Albedo availability and returns fallback setup instructions when
 * the wallet is missing or the check itself throws.
 */
export function checkAlbedoAvailability(
  detector?: () => boolean
): AlbedoAvailabilityState {
  try {
    const available = detectAlbedoExtension(detector);
    if (available) {
      return {
        available: true,
        status: "available",
        setupInstruction: null,
        warningMessage: null,
      };
    }
    return {
      available: false,
      status: "unavailable",
      setupInstruction: ALBEDO_SETUP_INSTRUCTION,
      warningMessage: ALBEDO_SETUP_INSTRUCTION,
    };
  } catch (err) {
    logAlbedoWarning("WALLET UNAVAILABLE", "wallet availability check failed", {
      err,
    });
    return {
      available: false,
      status: "error",
      setupInstruction: ALBEDO_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${ALBEDO_SETUP_INSTRUCTION}`,
    };
  }
}

/**
 * Runs an Albedo availability check and surfaces a warning toast when the
 * wallet is missing or the check errors.
 */
export function warnOnMissingAlbedo(
  showToast: AlbedoToastHandler,
  detector?: () => boolean
): AlbedoAvailabilityState {
  const state = checkAlbedoAvailability(detector);
  if (!state.available && state.warningMessage) {
    showToast(state.warningMessage, "warning");
  }
  return state;
}

// ---------------------------------------------------------------------------
// Network mismatch warnings (#126)
// ---------------------------------------------------------------------------

/** Chains the Albedo wallet can be pointed at. */
export type AlbedoNetwork = "mainnet" | "testnet";

export interface AlbedoNetworkMismatchState {
  mismatched: boolean;
  walletNetwork: AlbedoNetwork;
  appNetwork: AlbedoNetwork;
  warningMessage: string | null;
}

export class AlbedoNetworkMismatchError extends Error {
  constructor(
    public readonly walletNetwork: AlbedoNetwork,
    public readonly appNetwork: AlbedoNetwork
  ) {
    super(
      `Network mismatch: Albedo wallet is on ${walletNetwork}, app expects ${appNetwork}`
    );
    this.name = "AlbedoNetworkMismatchError";
  }
}

function capitalizeNetwork(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Compares the network the Albedo wallet is pointed at against the network
 * the app expects and produces a user-facing warning message when they diverge.
 */
export function checkAlbedoNetworkMatch(
  walletNetwork: AlbedoNetwork,
  appNetwork: AlbedoNetwork
): AlbedoNetworkMismatchState {
  const mismatched = walletNetwork !== appNetwork;
  return {
    mismatched,
    walletNetwork,
    appNetwork,
    warningMessage: mismatched
      ? `Network mismatch: your Albedo wallet is on ${capitalizeNetwork(walletNetwork)} but this app uses ${capitalizeNetwork(appNetwork)}. Switch networks in Albedo to continue.`
      : null,
  };
}

/**
 * Runs a network match check and, on mismatch, emits a formatted console
 * warning block (with stack) via the shared albedo_connector debug machinery.
 */
export function warnOnAlbedoNetworkMismatch(
  walletNetwork: AlbedoNetwork,
  appNetwork: AlbedoNetwork
): AlbedoNetworkMismatchState {
  const state = checkAlbedoNetworkMatch(walletNetwork, appNetwork);
  if (state.mismatched && state.warningMessage) {
    logAlbedoWarning("NETWORK MISMATCH", state.warningMessage, {
      err: new AlbedoNetworkMismatchError(walletNetwork, appNetwork),
      network: walletNetwork,
    });
  }
  return state;
}

// ---------------------------------------------------------------------------
// Transaction signature time limit bounds (#124)
// ---------------------------------------------------------------------------

/** Default bound for Albedo signature requests (milliseconds). */
export const DEFAULT_ALBEDO_SIGNATURE_TIMEOUT_MS = 60_000;

export interface AlbedoSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

export class AlbedoSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Albedo signature timed out after ${timeoutMs}ms`);
    this.name = "AlbedoSignatureTimeoutError";
  }
}

/**
 * Zeroes and drops a sensitive buffer so it cannot be retained after the
 * operation is aborted or completes.
 */
export function clearAlbedoSensitiveMemory(
  request: AlbedoSignRequest
): AlbedoSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races an Albedo signature operation against a timeout clock. On timeout
 * the operation is aborted and any sensitive payload memory is cleared.
 */
export async function signAlbedoWithTimeout<T>(
  request: AlbedoSignRequest,
  signFn: (xdr: string) => Promise<T>,
  timeoutMs: number = DEFAULT_ALBEDO_SIGNATURE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearAlbedoSensitiveMemory(request);
      reject(new AlbedoSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearAlbedoSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof AlbedoSignatureTimeoutError) {
      clearAlbedoSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// User signature rejection handling (#125)
// ---------------------------------------------------------------------------

export class AlbedoUserRejectedError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "AlbedoUserRejectedError";
  }
}

/** Detects "user rejected the signature request" style errors from Albedo. */
export function isAlbedoUserRejected(err: unknown): boolean {
  if (err instanceof AlbedoUserRejectedError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user") ||
    message.includes("rejected by user") ||
    message.includes("canceled by user") ||
    message.includes("cancelled by user")
  );
}

/**
 * Runs an Albedo signature step. Catches "user rejected transaction"
 * exceptions, logs them, and shows a clean warning toast instead of
 * surfacing a raw error to the caller.
 */
export async function runAlbedoSign<T>(
  signFn: () => Promise<T>,
  showToast: AlbedoToastHandler
): Promise<T | null> {
  try {
    return await signFn();
  } catch (err) {
    if (isAlbedoUserRejected(err)) {
      logAlbedoWarning("SIGNATURE REJECTED", "signature rejected by user", {
        err,
      });
      showToast(
        "Signature cancelled — you rejected the request in Albedo.",
        "warning"
      );
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Secure persistent caching for active keys (#127)
// ---------------------------------------------------------------------------

export const ALBEDO_STATE_VERSION = 1 as const;
export const ALBEDO_STORAGE_KEY = "albedo_connector_active_session";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AlbedoSerializedState {
  version: typeof ALBEDO_STATE_VERSION;
  address: string;
  network: AlbedoNetwork;
  connectedAt: number;
}

const SENSITIVE_STATE_FIELD_PATTERN =
  /(secret|private[_-]?key|seed|mnemonic|password|credential|auth[_-]?token)/i;

const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

export class AlbedoStateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlbedoStateParseError";
  }
}

/** Format-only Stellar public key check (G + 55 base32 chars). */
export function isValidStellarAddress(value: unknown): value is string {
  return typeof value === "string" && STELLAR_ADDRESS_PATTERN.test(value);
}

export function isValidNetwork(value: unknown): value is AlbedoNetwork {
  return value === "mainnet" || value === "testnet";
}

export function serializeWalletState(input: {
  address: string;
  network: AlbedoNetwork;
  connectedAt?: number;
}): AlbedoSerializedState {
  return {
    version: ALBEDO_STATE_VERSION,
    address: input.address,
    network: input.network,
    connectedAt: input.connectedAt ?? Date.now(),
  };
}

export function parseAlbedoState(raw: string): AlbedoSerializedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AlbedoStateParseError("invalid JSON");
  }
  return validateSerializedState(parsed);
}

export function validateSerializedState(value: unknown): AlbedoSerializedState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AlbedoStateParseError("expected object");
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_STATE_FIELD_PATTERN.test(key)) {
      throw new AlbedoStateParseError(`forbidden sensitive field "${key}"`);
    }
  }

  if (record.version !== ALBEDO_STATE_VERSION) {
    throw new AlbedoStateParseError("unsupported version");
  }
  if (!isValidStellarAddress(record.address)) {
    throw new AlbedoStateParseError("invalid address");
  }
  if (!isValidNetwork(record.network)) {
    throw new AlbedoStateParseError("invalid network");
  }
  if (
    typeof record.connectedAt !== "number" ||
    !Number.isFinite(record.connectedAt) ||
    record.connectedAt <= 0
  ) {
    throw new AlbedoStateParseError("invalid connectedAt");
  }

  return {
    version: ALBEDO_STATE_VERSION,
    address: record.address,
    network: record.network,
    connectedAt: record.connectedAt,
  };
}

export interface AlbedoRestoredState {
  restored: boolean;
  parseError: string | null;
  address: string | null;
  network: AlbedoNetwork | null;
  connectedAt: number | null;
}

export interface AlbedoPersistOptions {
  storage?: StorageAdapter | null;
}

function resolveStorageAdapter(
  storage?: StorageAdapter | null
): StorageAdapter | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__albedo_connector_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveAlbedoState(
  input: { address: string; network: AlbedoNetwork; connectedAt?: number },
  options?: AlbedoPersistOptions
): boolean {
  if (!isValidStellarAddress(input.address) || !isValidNetwork(input.network)) {
    return false;
  }

  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) {
    logAlbedoWarning("PERSIST UNAVAILABLE", "storage adapter unavailable");
    return false;
  }

  try {
    const serialized = serializeWalletState(input);
    storage.setItem(ALBEDO_STORAGE_KEY, JSON.stringify(serialized));
    return true;
  } catch (err) {
    logAlbedoWarning("PERSIST FAILED", "failed to save albedo session state", {
      err,
    });
    return false;
  }
}

export function loadAlbedoState(
  options?: AlbedoPersistOptions
): AlbedoRestoredState {
  const empty: AlbedoRestoredState = {
    restored: false,
    parseError: null,
    address: null,
    network: null,
    connectedAt: null,
  };

  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) {
    return { ...empty, parseError: "storage unavailable" };
  }

  try {
    const raw = storage.getItem(ALBEDO_STORAGE_KEY);
    if (!raw) return empty;

    try {
      const state = parseAlbedoState(raw);
      return {
        restored: true,
        parseError: null,
        address: state.address,
        network: state.network,
        connectedAt: state.connectedAt,
      };
    } catch (err) {
      const message =
        err instanceof AlbedoStateParseError
          ? err.message
          : "invalid persisted state";
      try {
        storage.removeItem(ALBEDO_STORAGE_KEY);
      } catch {
        // best-effort cleanup
      }
      logAlbedoWarning("REHYDRATE FAILED", message, { err });
      return { ...empty, parseError: message };
    }
  } catch {
    return { ...empty, parseError: "storage read failed" };
  }
}

export function clearAlbedoState(options?: AlbedoPersistOptions): boolean {
  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) return false;

  try {
    storage.removeItem(ALBEDO_STORAGE_KEY);
    return true;
  } catch (err) {
    logAlbedoWarning("CLEAR FAILED", "failed to clear albedo session state", {
      err,
    });
    return false;
  }
}

export class AlbedoSessionManager {
  private memory: AlbedoRestoredState;
  private storage: StorageAdapter | null;

  constructor(storage?: StorageAdapter | null) {
    this.storage =
      storage !== undefined ? storage : resolveStorageAdapter(undefined);
    this.memory = loadAlbedoState({ storage: this.storage });
  }

  getState(): AlbedoRestoredState {
    return { ...this.memory };
  }

  persist(input: {
    address: string;
    network: AlbedoNetwork;
    connectedAt?: number;
  }): boolean {
    const ok = saveAlbedoState(input, { storage: this.storage });
    if (ok) {
      const connectedAt = input.connectedAt ?? Date.now();
      this.memory = {
        restored: true,
        parseError: null,
        address: input.address,
        network: input.network,
        connectedAt,
      };
    }
    return ok;
  }

  restore(): AlbedoRestoredState {
    this.memory = loadAlbedoState({ storage: this.storage });
    return this.getState();
  }

  clear(): void {
    clearAlbedoState({ storage: this.storage });
    this.memory = {
      restored: false,
      parseError: null,
      address: null,
      network: null,
      connectedAt: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Loading spinner states (#128)
// ---------------------------------------------------------------------------

import {
  albedoLoading,
  AlbedoLoadingManager,
  withAlbedoLoading,
} from "./albedo_loading";

export {
  albedoLoading,
  AlbedoLoadingManager,
  withAlbedoLoading,
  type AlbedoLoadingOperation,
  type AlbedoLoadingState,
} from "./albedo_loading";

export async function connectWithAlbedoLoading<T>(
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return withAlbedoLoading("connect", fn, manager);
}

export async function getAddressWithAlbedoLoading<T>(
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return withAlbedoLoading("connect", fn, manager);
}

export async function signWithAlbedoLoading<T>(
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return withAlbedoLoading("sign", fn, manager);
}

export async function submitWithAlbedoLoading<T>(
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return withAlbedoLoading("submit", fn, manager);
}

export async function runAlbedoPopupWithLoading<T>(
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return withAlbedoLoading("popup", fn, manager);
}

// ---------------------------------------------------------------------------
// Multi-signature transaction helper hooks (#129)
// ---------------------------------------------------------------------------

export class AlbedoTransactionAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlbedoTransactionAssemblyError";
  }
}

export interface AlbedoTransactionStructure {
  operationCount: number;
  signatureCount: number;
  fee: string;
  sourceAccount: string;
}

function readTransactionEnvelope(
  transactionXdr: string,
  networkPassphrase: string
): Transaction {
  const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
  return tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx;
}

export function parseAlbedoTransactionStructure(
  transactionXdr: string,
  networkPassphrase: string
): AlbedoTransactionStructure {
  if (!transactionXdr || transactionXdr.trim().length === 0) {
    throw new AlbedoTransactionAssemblyError("missing transaction XDR");
  }

  try {
    const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    const envelope = readTransactionEnvelope(transactionXdr, networkPassphrase);
    return {
      operationCount: envelope.operations.length,
      signatureCount: tx.signatures.length,
      fee: envelope.fee,
      sourceAccount: envelope.source,
    };
  } catch (err) {
    if (err instanceof AlbedoTransactionAssemblyError) throw err;
    logAlbedoWarning(
      "ASSEMBLY PARSE FAILED",
      "failed to parse transaction XDR",
      { err }
    );
    throw new AlbedoTransactionAssemblyError(
      err instanceof Error ? err.message : "invalid transaction XDR"
    );
  }
}

export interface AlbedoMultiSigAssemblyPlan {
  baseXdr: string;
  pendingSigners: string[];
  structure: AlbedoTransactionStructure;
}

export interface AlbedoMultiSigPart {
  signerPublicKey: string;
  signedXdr: string;
}

export function createAlbedoMultiSigAssemblyPlan(
  baseXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): AlbedoMultiSigAssemblyPlan {
  if (!signerPublicKeys.length) {
    throw new AlbedoTransactionAssemblyError(
      "at least one signer public key is required"
    );
  }

  for (const key of signerPublicKeys) {
    if (!isValidStellarAddress(key)) {
      throw new AlbedoTransactionAssemblyError("invalid signer public key");
    }
  }

  const structure = parseAlbedoTransactionStructure(baseXdr, networkPassphrase);
  return {
    baseXdr,
    pendingSigners: [...signerPublicKeys],
    structure,
  };
}

export function validateAlbedoMultiSigParts(
  parts: AlbedoMultiSigPart[],
  networkPassphrase: string
): AlbedoMultiSigPart[] {
  if (!parts.length) {
    throw new AlbedoTransactionAssemblyError("no multi-sig parts provided");
  }

  for (const part of parts) {
    if (!part.signerPublicKey) {
      throw new AlbedoTransactionAssemblyError("Missing signer public key");
    }
    if (!isValidStellarAddress(part.signerPublicKey)) {
      throw new AlbedoTransactionAssemblyError("invalid signer public key");
    }
    if (!part.signedXdr) {
      throw new AlbedoTransactionAssemblyError("missing signed XDR");
    }
    parseAlbedoTransactionStructure(part.signedXdr, networkPassphrase);
  }

  return parts;
}

export function assembleAlbedoMultiSigTransaction(
  baseXdr: string,
  parts: AlbedoMultiSigPart[],
  networkPassphrase: string
): string {
  validateAlbedoMultiSigParts(parts, networkPassphrase);

  try {
    const merged = TransactionBuilder.fromXDR(baseXdr, networkPassphrase);
    const existing = new Set(
      merged.signatures.map((sig) => sig.signature().toString("base64"))
    );

    for (const part of parts) {
      const signed = TransactionBuilder.fromXDR(
        part.signedXdr,
        networkPassphrase
      );
      for (const signature of signed.signatures) {
        const key = signature.signature().toString("base64");
        if (!existing.has(key)) {
          merged.signatures.push(signature);
          existing.add(key);
        }
      }
    }

    return merged.toXDR();
  } catch (err) {
    if (err instanceof AlbedoTransactionAssemblyError) throw err;
    logAlbedoWarning(
      "MULTISIG ASSEMBLY FAILED",
      "failed to assemble multi-signature transaction",
      { err }
    );
    throw new AlbedoTransactionAssemblyError(
      err instanceof Error ? err.message : "assembly failed"
    );
  }
}

export function findMissingAlbedoSigners(
  plan: AlbedoMultiSigAssemblyPlan,
  collectedSignerPublicKeys: string[]
): string[] {
  const collected = new Set(collectedSignerPublicKeys);
  return plan.pendingSigners.filter((signer) => !collected.has(signer));
}

export function splitAlbedoMultiSigTransactionParts(
  signedXdr: string,
  signerPublicKeys: string[],
  networkPassphrase: string
): AlbedoMultiSigPart[] {
  if (!signerPublicKeys.length) {
    throw new AlbedoTransactionAssemblyError(
      "at least one signer public key is required"
    );
  }

  const structure = parseAlbedoTransactionStructure(signedXdr, networkPassphrase);
  if (structure.signatureCount === 0) {
    throw new AlbedoTransactionAssemblyError("transaction has no signatures");
  }

  return signerPublicKeys.map((signerPublicKey) => ({
    signerPublicKey,
    signedXdr,
  }));
}

// ── gas-estimation fee warnings (#130) ──────────────────────────────────────
// Restored from 51094be: the component and tests for this feature survived the
// merge but these declarations did not.

/**
 * Minimal shape of a Soroban simulation result that albedo_connector
 * understands for fee inspection. The full SDK type is structurally
 * compatible — pass it directly.
 */
export interface AlbedoSimulationResult {
  /** Estimated resource fee in stroops (string or number). */
  minResourceFee?: string | number;
  /** Classic base fee in stroops (string or number). */
  fee?: string | number;
  /** Present when simulation itself failed. */
  error?: string;
  /** Soroban error message embedded inside a failed simulation. */
  result?: { error?: string };
}

export interface AlbedoFeeWarningState {
  /** True when the estimated fee exceeds the configured bound. */
  exceeded: boolean;
  /** Estimated fee in stroops (0 when simulation has no fee data). */
  estimatedFeeStroops: number;
  /** The bound that was checked against (in stroops). */
  feeLimitStroops: number;
  /** Human-readable warning or null when the fee is within bounds. */
  warningMessage: string | null;
}

/**
 * Default upper bound for acceptable Soroban transaction fees.
 * 0.01 XLM = 1_000_000 stroops.  Transactions estimated above this
 * threshold trigger the fee warning banner.
 */
export const DEFAULT_FEE_LIMIT_STROOPS = 1_000_000;

export class AlbedoFeeExceededError extends Error {
  constructor(
    public readonly estimatedFeeStroops: number,
    public readonly feeLimitStroops: number
  ) {
    super(
      `Fee exceeded: estimated ${estimatedFeeStroops} stroops exceeds limit of ${feeLimitStroops} stroops`
    );
    this.name = "AlbedoFeeExceededError";
  }
}

export class AlbedoSimulationError extends Error {
  constructor(message: string) {
    super(`Albedo simulation failed: ${message}`);
    this.name = "AlbedoSimulationError";
  }
}

/**
 * Extracts the total estimated fee in stroops from a simulation result.
 * Soroban transactions carry a `minResourceFee`; classic transactions use
 * `fee`.  Both are accepted so callers need not branch on transaction type.
 */
export function extractEstimatedFee(
  simulation: AlbedoSimulationResult
): number {
  const raw = simulation.minResourceFee ?? simulation.fee;
  if (raw === undefined || raw === null) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Inspects a simulation result and produces a fee warning state.
 * A warning is triggered whenever the estimated fee exceeds `feeLimitStroops`.
 *
 * @param simulation  - Simulation result from the Soroban RPC / SDK.
 * @param feeLimitStroops - Upper bound in stroops. Defaults to {@link DEFAULT_FEE_LIMIT_STROOPS}.
 */
export function checkAlbedoFeeWarning(
  simulation: AlbedoSimulationResult,
  feeLimitStroops: number = DEFAULT_FEE_LIMIT_STROOPS
): AlbedoFeeWarningState {
  const estimatedFeeStroops = extractEstimatedFee(simulation);
  const exceeded = estimatedFeeStroops > feeLimitStroops;

  const xlmFee = (estimatedFeeStroops / 10_000_000).toFixed(7);
  const xlmLimit = (feeLimitStroops / 10_000_000).toFixed(7);

  return {
    exceeded,
    estimatedFeeStroops,
    feeLimitStroops,
    warningMessage: exceeded
      ? `High fee detected: estimated ${xlmFee} XLM (${estimatedFeeStroops} stroops) exceeds the ${xlmLimit} XLM limit. Review the transaction before signing.`
      : null,
  };
}

/**
 * Runs a fee check and, when the fee is exceeded, emits a formatted console
 * warning block via the shared albedo_connector debug machinery.
 */
export function warnOnAlbedoFeeExceeded(
  simulation: AlbedoSimulationResult,
  feeLimitStroops: number = DEFAULT_FEE_LIMIT_STROOPS
): AlbedoFeeWarningState {
  const state = checkAlbedoFeeWarning(simulation, feeLimitStroops);
  if (state.exceeded && state.warningMessage) {
    logAlbedoWarning("HIGH FEE WARNING", state.warningMessage, {
      err: new AlbedoFeeExceededError(
        state.estimatedFeeStroops,
        state.feeLimitStroops
      ),
      phase: "simulating",
    });
  }
  return state;
}
