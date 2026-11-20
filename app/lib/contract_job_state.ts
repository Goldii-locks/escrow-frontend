/**
 * contract_job_state — reads job state directly from the escrow contract.
 *
 * Used as a fallback when the indexer is behind or the backend's
 * `/api/jobs/:id` endpoint fails (#895). Calls the same `/api/jobs/query`
 * route that `admin.ts` uses, so no new backend surface is needed.
 *
 * The returned `Job` is flagged with `contractFallback: true` by convention
 * (the `Job` schema passes unknown fields through); callers check that flag to
 * show "Live from the contract; history may be delayed".
 */

import { BACKEND_URL } from "@/app/lib/transactions";
import { EscrowStateResponseSchema, type Job } from "@/app/lib/api_schemas";

/** Ledgers older than this threshold trigger the contract fallback (#895). */
export const STALE_LEDGER_THRESHOLD = 150;

/**
 * Fetches `get_escrow_state` for `contractId` via the backend's read-only
 * query route and maps the result to a `Job`.
 *
 * Returns `null` when the backend is unreachable or the response does not
 * match the expected shape, so callers can keep the existing error state
 * rather than replacing it with partial data.
 */
export async function fetchJobStateFromContract(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<Job | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/jobs/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, method: "get_escrow_state" }),
      signal: options?.signal,
    });

    if (!res.ok) return null;

    const rawData: unknown = await res.json();
    const parsed = EscrowStateResponseSchema.safeParse(rawData);
    if (!parsed.success) return null;

    const { job, admin } = parsed.data.data.result;

    const contractJob: Job = {
      id: contractId,
      client: job.client ?? "",
      freelancer: job.freelancer ?? "",
      arbiter: job.arbiter ?? "",
      admin: admin ?? undefined,
      funded: job.funded ?? false,
      milestones: job.milestones ?? [],
      token: job.token,
      tokenSymbol: job.tokenSymbol,
      tokenDecimals: job.tokenDecimals,
      // Mark this record so the UI can show the "live from contract" banner.
      contractFallback: true,
    } as Job & { contractFallback: boolean };

    return contractJob;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

/**
 * Returns `true` when `latestLedger` is defined and more than
 * `STALE_LEDGER_THRESHOLD` ledgers behind `currentLedger`.
 *
 * Both values come from the backend: `currentLedger` is the RPC tip the
 * backend knows about; `latestLedger` is the last ledger the indexer has
 * processed for this job.
 */
export function isIndexerStale(
  latestLedger: number | undefined,
  currentLedger: number | undefined
): boolean {
  if (latestLedger === undefined || currentLedger === undefined) return false;
  return currentLedger - latestLedger > STALE_LEDGER_THRESHOLD;
}
