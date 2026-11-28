import { RPC_URL } from "@/app/lib/config";

/**
 * Ledger-time clock. The contract compares deadlines with the close time of
 * the ledger a transaction lands in, so time-gated UI must not trust the
 * browser clock directly. We measure the offset (ledger close time minus
 * Date.now()) once and apply it to every eligibility check.
 */

/** Extra seconds added before enabling a time-gated action. */
export const LEDGER_TIME_MARGIN_MS = 5_000;

let offsetMs = 0;
let inflight: Promise<number> | null = null;

export function setLedgerOffsetMs(offset: number): void {
  offsetMs = Number.isFinite(offset) ? offset : 0;
}

export function getLedgerOffsetMs(): number {
  return offsetMs;
}

/** Offset between ledger time and the given browser time, from a close time in epoch seconds. */
export function computeLedgerOffsetMs(ledgerCloseTimeSec: number, browserNowMs: number): number {
  return ledgerCloseTimeSec * 1000 - browserNowMs;
}

/** Best estimate of the current ledger time in epoch ms. */
export function ledgerNowMs(browserNowMs: number = Date.now()): number {
  return browserNowMs + offsetMs;
}

/** Ledger time minus a safety margin; use this to enable time-gated actions. */
export function gatedNowMs(browserNowMs: number = Date.now()): number {
  return ledgerNowMs(browserNowMs) - LEDGER_TIME_MARGIN_MS;
}

async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: Record<string, unknown> };
  return json.result ?? {};
}

/** Fetch the latest ledger close time (epoch seconds) via RPC. */
export async function fetchLatestLedgerCloseTimeSec(): Promise<number> {
  const latest = await rpc("getLatestLedger");
  let close = Number(latest.closeTime ?? latest.ledgerCloseTime);
  if (!Number.isFinite(close) && typeof latest.sequence === "number") {
    const r = await rpc("getLedgers", { startLedger: latest.sequence, pagination: { limit: 1 } });
    const first = (r.ledgers as Array<{ ledgerCloseTime?: string | number }> | undefined)?.[0];
    close = Number(first?.ledgerCloseTime);
  }
  if (!Number.isFinite(close)) throw new Error("ledger close time unavailable");
  return close;
}

/** Sync the offset once (deduplicated); failures leave the browser clock in use. */
export function syncLedgerOffset(): Promise<number> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const before = Date.now();
        const close = await fetchLatestLedgerCloseTimeSec();
        setLedgerOffsetMs(computeLedgerOffsetMs(close, before));
      } catch {
        /* keep the browser clock */
      }
      return offsetMs;
    })();
  }
  return inflight;
}
