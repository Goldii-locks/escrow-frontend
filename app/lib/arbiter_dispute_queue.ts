/**
 * arbiter_dispute_queue — Pure helpers backing the arbiter-centred dispute
 * queue (`app/components/ArbiterDisputeQueue.tsx`, Issue #881).
 *
 * Until the backend exposes a dedicated dispute API, the queue is derived
 * from the job list plus milestone statuses: every `Disputed` milestone on a
 * job where the connected wallet is the arbiter becomes one queue entry.
 *
 * Escalation deadlines come from the milestone when the backend provides
 * them (`escalationDeadline`), otherwise they are estimated from the time
 * the dispute was raised (`disputedAt`) plus a fixed response window. When
 * neither is available the deadline is unknown and the entry sorts last.
 */

const LOG_PREFIX = "[arbiter_dispute_queue]";

/**
 * Assumed response window before either party may escalate a dispute.
 * Used only when the backend has not supplied an explicit deadline.
 */
export const DISPUTE_ESCALATION_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

export interface ArbiterQueueMilestone {
  index: number;
  amount: string;
  status: string;
  /** ISO string or epoch ms of when the dispute was raised, when known. */
  disputedAt?: string | number;
  /** Address of the party that raised the dispute, when known. */
  disputedBy?: string;
  /** Explicit escalation deadline (ISO string or epoch ms), when known. */
  escalationDeadline?: string | number;
}

export interface ArbiterQueueJob {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  milestones?: ArbiterQueueMilestone[];
}

export interface ArbiterDisputeEntry {
  jobId: string;
  milestoneIndex: number;
  /** Amount in base units (stroops), as stored on the milestone. */
  amount: string;
  tokenSymbol: string;
  tokenDecimals: number;
  client: string;
  freelancer: string;
  /** Who raised the dispute, or `null` when the backend does not say. */
  raisedBy: string | null;
  /** Epoch ms of when the dispute was raised, or `null` when unknown. */
  raisedAt: number | null;
  /** Epoch ms when either party may escalate, or `null` when unknown. */
  escalationDeadline: number | null;
  /** Milliseconds until escalation opens (negative once overdue). */
  msUntilEscalation: number | null;
}

/** Parses an ISO string or epoch-ms number into epoch ms, or `null`. */
function toEpochMs(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Resolves the escalation deadline for a disputed milestone. */
export function getEscalationDeadline(
  milestone: ArbiterQueueMilestone,
): number | null {
  const explicit = toEpochMs(milestone.escalationDeadline);
  if (explicit !== null) return explicit;

  const raisedAt = toEpochMs(milestone.disputedAt);
  if (raisedAt !== null) return raisedAt + DISPUTE_ESCALATION_WINDOW_MS;

  return null;
}

/**
 * Builds the queue: every `Disputed` milestone across the given jobs where
 * `address` is the arbiter, sorted by escalation deadline (most urgent
 * first). Entries without a known deadline sort last, oldest-raised first.
 */
export function buildArbiterDisputeQueue(
  jobs: ArbiterQueueJob[],
  address: string | null,
  now: number = Date.now(),
): ArbiterDisputeEntry[] {
  if (!address) return [];

  const entries: ArbiterDisputeEntry[] = [];

  for (const job of jobs) {
    if (!job || job.arbiter !== address) continue;
    if (!Array.isArray(job.milestones)) continue;

    for (const milestone of job.milestones) {
      if (!milestone || milestone.status !== "Disputed") continue;
      if (typeof milestone.index !== "number") continue;

      const raisedAt = toEpochMs(milestone.disputedAt);
      const escalationDeadline = getEscalationDeadline(milestone);

      entries.push({
        jobId: job.id,
        milestoneIndex: milestone.index,
        amount: typeof milestone.amount === "string" ? milestone.amount : "0",
        tokenSymbol: job.tokenSymbol ?? "XLM",
        tokenDecimals: job.tokenDecimals ?? 7,
        client: job.client,
        freelancer: job.freelancer,
        raisedBy:
          typeof milestone.disputedBy === "string" && milestone.disputedBy
            ? milestone.disputedBy
            : null,
        raisedAt,
        escalationDeadline,
        msUntilEscalation:
          escalationDeadline !== null ? escalationDeadline - now : null,
      });
    }
  }

  entries.sort((a, b) => {
    // Known deadlines first, ascending (most urgent first).
    if (a.escalationDeadline !== null && b.escalationDeadline !== null) {
      if (a.escalationDeadline !== b.escalationDeadline) {
        return a.escalationDeadline - b.escalationDeadline;
      }
    } else if (a.escalationDeadline !== null) {
      return -1;
    } else if (b.escalationDeadline !== null) {
      return 1;
    }

    // Then oldest-raised first; unknown raise times sort last.
    if (a.raisedAt !== null && b.raisedAt !== null && a.raisedAt !== b.raisedAt) {
      return a.raisedAt - b.raisedAt;
    }
    if (a.raisedAt !== null && b.raisedAt === null) return -1;
    if (a.raisedAt === null && b.raisedAt !== null) return 1;

    // Stable fallback so the order never depends on fetch order.
    if (a.jobId !== b.jobId) return a.jobId < b.jobId ? -1 : 1;
    return a.milestoneIndex - b.milestoneIndex;
  });

  return entries;
}

/** Number of disputes awaiting the given arbiter, for the navbar badge. */
export function countArbiterDisputes(
  jobs: ArbiterQueueJob[],
  address: string | null,
): number {
  if (!address) return 0;
  let count = 0;
  for (const job of jobs) {
    if (!job || job.arbiter !== address) continue;
    if (!Array.isArray(job.milestones)) continue;
    for (const milestone of job.milestones) {
      if (milestone?.status === "Disputed") count += 1;
    }
  }
  return count;
}

/**
 * Human-readable countdown for the queue, e.g. "2d 4h", "3h 12m", "9m".
 * Non-positive values mean the dispute can already be escalated.
 */
export function formatTimeUntilEscalation(ms: number | null): string {
  if (ms === null) return "Escalation window unknown";
  if (ms <= 0) return "Escalatable now";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return "Under a minute";
}

/** Empty-state copy for the queue view. */
export function getArbiterQueueEmptyState(): { title: string; description: string } {
  return {
    title: "No disputes need your decision",
    description:
      "When a client or freelancer disputes a milestone on a job you arbitrate, it will appear here sorted by escalation deadline.",
  };
}

/**
 * Tolerant parser for the by-wallet jobs payload, mirroring the shapes the
 * dashboard accepts (`data` array, `data.jobs`, `data.items`).
 */
export function parseArbiterJobsPayload(payload: unknown): ArbiterQueueJob[] {
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  if (record.success === false) return [];

  let rows: unknown[] = [];
  const data = record.data;
  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === "object" && data !== null) {
    const embedded = data as Record<string, unknown>;
    if (Array.isArray(embedded.jobs)) rows = embedded.jobs;
    else if (Array.isArray(embedded.items)) rows = embedded.items;
    else if (typeof embedded.id === "string") rows = [embedded];
  }

  const jobs: ArbiterQueueJob[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string") continue;

    jobs.push({
      id: item.id,
      client: typeof item.client === "string" ? item.client : "",
      freelancer: typeof item.freelancer === "string" ? item.freelancer : "",
      arbiter: typeof item.arbiter === "string" ? item.arbiter : "",
      tokenSymbol: typeof item.tokenSymbol === "string" ? item.tokenSymbol : undefined,
      tokenDecimals:
        typeof item.tokenDecimals === "number" && Number.isFinite(item.tokenDecimals)
          ? item.tokenDecimals
          : undefined,
      milestones: Array.isArray(item.milestones)
        ? (item.milestones as ArbiterQueueMilestone[])
        : undefined,
    });
  }

  if (rows.length > 0 && jobs.length === 0) {
    console.warn(`${LOG_PREFIX} no jobs could be normalized from payload`);
  }

  return jobs;
}