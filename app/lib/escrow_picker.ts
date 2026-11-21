/**
 * escrow_picker — helpers for choosing which escrow /admin acts on (#837).
 *
 * Every escrow is its own factory-created contract, so there is no single
 * contract for pause/resume or whitelist overrides to target. The admin either
 * types a contract ID or picks one of the escrows the indexer knows about for
 * the connected wallet.
 */
import { BACKEND_URL } from "@/app/lib/transactions";
import { JobListResponseSchema, validateResponse, type Job } from "@/app/lib/api_schemas";
import { parsePageResponse } from "@/app/lib/job_list_response";
import { isContractAddress } from "@/app/lib/factory_admin";

export interface EscrowOption {
  contractId: string;
  label: string;
}

/** Trims and upper-cases a typed contract ID; StrKey addresses are upper-case. */
export function normalizeContractIdInput(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Error to show for a typed contract ID, or null when it can be selected. */
export function contractIdInputError(raw: string): string | null {
  const value = normalizeContractIdInput(raw);
  if (!value) return "Enter an escrow contract ID.";
  if (!isContractAddress(value)) {
    return "That is not a contract ID (C followed by 55 letters and digits).";
  }
  return null;
}

/** "CABCDE…QRSTUV" style label used when a job has no title. */
function shortId(contractId: string): string {
  return contractId.length > 14 ? `${contractId.slice(0, 6)}…${contractId.slice(-6)}` : contractId;
}

/** One option per distinct, well-formed job contract, in list order. */
export function escrowOptionsFromJobs(jobs: readonly Job[]): EscrowOption[] {
  const seen = new Set<string>();
  const options: EscrowOption[] = [];
  for (const job of jobs) {
    const contractId = typeof job.id === "string" ? job.id.trim() : "";
    if (!isContractAddress(contractId) || seen.has(contractId)) continue;
    seen.add(contractId);
    const title = (job as { title?: unknown }).title;
    const name = typeof title === "string" && title.trim() ? title.trim() : "Escrow";
    options.push({ contractId, label: `${name} (${shortId(contractId)})` });
  }
  return options;
}

const INDEXED_ESCROW_LIMIT = 50;

/**
 * Escrows the indexer lists for `address` (`GET /api/jobs/by-wallet/:address`).
 * Throws on failure so the picker can say the list is unavailable; typing a
 * contract ID still works then.
 */
export async function fetchIndexedEscrows(
  address: string,
  options?: { signal?: AbortSignal }
): Promise<EscrowOption[]> {
  const route = `/api/jobs/by-wallet/${address}`;
  const res = await fetch(
    `${BACKEND_URL}/api/jobs/by-wallet/${encodeURIComponent(address)}?page=1&limit=${INDEXED_ESCROW_LIMIT}`,
    { signal: options?.signal }
  );
  if (!res.ok) throw new Error(`Escrow list request failed with status ${res.status}`);
  const data = validateResponse(JobListResponseSchema, await res.json(), route);
  if (data.success === false) throw new Error(data.error || "Failed to load escrows");
  return escrowOptionsFromJobs(parsePageResponse(data).jobs);
}
