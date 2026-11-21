/**
 * arbiter_queue: disputed milestones across all of a wallet's jobs as arbiter
 * (#881). Built from the job list plus each job's `get_escrow_state` until a
 * dedicated dispute API exists.
 */
import { BACKEND_URL } from "@/app/lib/config";
import { parseJobTerms, DEFAULT_DISPUTE_TIMEOUT_SECONDS } from "@/app/lib/job_terms";

export interface ArbiterQueueItem {
  jobId: string;
  milestoneIndex: number;
  amount: string;
  tokenSymbol?: string;
  raisedBy: string | null;
  /** Unix seconds the dispute was raised, when the contract reports it. */
  raisedAt: number | null;
  /** Unix seconds after which either party can escalate, when known. */
  escalatesAt: number | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "bigint" ? Number(v) : typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/** Extracts the arbiter's disputed milestones from a decoded `get_escrow_state` result. */
export function extractDisputedItems(
  jobId: string,
  result: unknown,
  arbiterAddress: string
): ArbiterQueueItem[] {
  if (typeof result !== "object" || result === null) return [];
  const job = (result as { job?: unknown }).job;
  if (typeof job !== "object" || job === null) return [];
  const j = job as Record<string, unknown>;
  if (j.arbiter !== arbiterAddress || !Array.isArray(j.milestones)) return [];
  const timeout = parseJobTerms(result).disputeTimeoutSeconds || DEFAULT_DISPUTE_TIMEOUT_SECONDS;

  const items: ArbiterQueueItem[] = [];
  for (const raw of j.milestones) {
    if (typeof raw !== "object" || raw === null) continue;
    const m = raw as Record<string, unknown>;
    if (m.status !== "Disputed") continue;
    const raisedAt = num(m.disputed_at ?? m.disputedAt);
    items.push({
      jobId,
      milestoneIndex: typeof m.index === "number" ? m.index : items.length,
      amount: typeof m.amount === "string" ? m.amount : String(m.amount ?? "0"),
      tokenSymbol: typeof j.tokenSymbol === "string" ? j.tokenSymbol : undefined,
      raisedBy: str(m.disputed_by ?? m.disputedBy ?? m.raised_by ?? m.raisedBy),
      raisedAt,
      escalatesAt: raisedAt === null ? null : raisedAt + timeout,
    });
  }
  return items;
}

/** Most urgent first: soonest escalation deadline, unknown deadlines last. */
export function sortByUrgency(items: ArbiterQueueItem[]): ArbiterQueueItem[] {
  return [...items].sort((a, b) => {
    if (a.escalatesAt === null && b.escalatesAt === null) return 0;
    if (a.escalatesAt === null) return 1;
    if (b.escalatesAt === null) return -1;
    return a.escalatesAt - b.escalatesAt;
  });
}

/** "3d 4h left", "2h 10m left", "Escalation open", or "Unknown". */
export function formatTimeLeft(escalatesAt: number | null, nowSeconds: number): string {
  if (escalatesAt === null) return "Unknown";
  const left = escalatesAt - nowSeconds;
  if (left <= 0) return "Escalation open";
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

/** Loads every disputed milestone where `address` is the arbiter, sorted by urgency. */
export async function fetchArbiterQueue(
  address: string,
  options?: { signal?: AbortSignal }
): Promise<ArbiterQueueItem[]> {
  const listRes = await fetch(
    `${BACKEND_URL}/api/jobs/by-wallet/${encodeURIComponent(address)}?role=arbiter&limit=100`,
    { signal: options?.signal }
  );
  if (!listRes.ok) throw new Error(`Failed to load jobs (${listRes.status})`);
  const body = (await listRes.json()) as { data?: unknown; jobs?: unknown };
  const embedded = body.data as { jobs?: unknown } | unknown[] | undefined;
  const rows = Array.isArray(embedded)
    ? embedded
    : Array.isArray(embedded?.jobs)
      ? embedded.jobs
      : Array.isArray(body.jobs)
        ? body.jobs
        : [];
  const ids = rows
    .map((r) => (r as { id?: unknown; contract_id?: unknown }) ?? {})
    .map((r) => str(r.id) ?? str(r.contract_id))
    .filter((id): id is string => id !== null);

  const perJob = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/jobs/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: id, method: "get_escrow_state" }),
          signal: options?.signal,
        });
        if (!res.ok) return [];
        const state = (await res.json()) as { data?: { result?: unknown } };
        return extractDisputedItems(id, state?.data?.result, address);
      } catch {
        return [];
      }
    })
  );
  return sortByUrgency(perJob.flat());
}
