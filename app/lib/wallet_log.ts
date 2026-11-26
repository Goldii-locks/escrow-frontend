/**
 * wallet_log — console warning formatter and transaction-debug tracker for
 * wallet operations.
 *
 * Extracted from `wallet_state_context.ts`. Re-exported from that module for
 * backwards compatibility.
 */

const LOG_PREFIX = "[wallet_state_context]";

export type WalletTxPhase =
  "idle" | "connecting" | "signing" | "disconnecting" | "success" | "error";

export interface WalletTxTrackEntry {
  txId: string;
  phase: WalletTxPhase;
  message: string;
  timestamp: number;
  stack?: string;
}

export interface WalletConsoleWarningBlock {
  title: string;
  body: string;
  stack: string;
  txId?: string;
  phase?: WalletTxPhase;
}

/** Captures a normalized stack string from an error or the current call site. */
export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(typeof err === "string" ? err : "Wallet state context trace");
  return synthetic.stack ?? "Error: Wallet state context trace";
}

/** Builds a multi-line console warning block for transaction debug tracking. */
export function formatConsoleWarningBlock(block: WalletConsoleWarningBlock): string {
  const lines = [
    `${LOG_PREFIX} ╔══════════════════════════════════════╗`,
    `${LOG_PREFIX} ║ ${block.title.padEnd(36).slice(0, 36)} ║`,
    `${LOG_PREFIX} ╚══════════════════════════════════════╝`,
    `${LOG_PREFIX} ${block.body}`,
  ];

  if (block.txId) {
    lines.push(`${LOG_PREFIX} txId: ${block.txId}`);
  }
  if (block.phase) {
    lines.push(`${LOG_PREFIX} phase: ${block.phase}`);
  }

  lines.push(`${LOG_PREFIX} --- stack trace ---`);
  for (const frame of block.stack.split("\n")) {
    lines.push(`${LOG_PREFIX} ${frame}`);
  }
  lines.push(`${LOG_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

/** Logs a formatted warning block (including stack) to the console. */
export function logWalletWarning(
  title: string,
  body: string,
  options?: { err?: unknown; txId?: string; phase?: WalletTxPhase }
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

export class WalletTransactionTracker {
  private entries: WalletTxTrackEntry[] = [];

  track(txId: string, phase: WalletTxPhase, message: string, err?: unknown): WalletTxTrackEntry {
    const entry: WalletTxTrackEntry = {
      txId,
      phase,
      message,
      timestamp: Date.now(),
      stack: formatStackTrace(err),
    };
    this.entries.push(entry);

    logWalletWarning(`TX ${phase.toUpperCase()}`, message, {
      err,
      txId,
      phase,
    });

    return entry;
  }

  getHistory(txId?: string): WalletTxTrackEntry[] {
    if (!txId) return [...this.entries];
    return this.entries.filter((e) => e.txId === txId);
  }

  clear(): void {
    this.entries = [];
  }
}
