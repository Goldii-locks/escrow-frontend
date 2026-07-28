/**
 * albedo_connector — formatted console warnings/errors and transaction
 * lifecycle tracking for Albedo popup wallet debugging.
 *
 * Never logs private keys, seeds, credentials, or full sensitive payloads.
 */

export type AlbedoTxPhase =
  | "idle"
  | "building"
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
