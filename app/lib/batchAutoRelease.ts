import type { Job } from "@/app/lib/api_schemas";
import { simulateContractRead } from "@/app/lib/contract_read";

type JobTiming = Pick<Job, "id" | "milestones" | "autoReleaseSeconds">;
type Deadlines = Record<number, number | null>;

function seconds(value: unknown): number | null {
  if (typeof value !== "bigint" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function deadlineMs(deliveredAt: unknown, duration: unknown, extension: unknown): number | null {
  const delivered = seconds(deliveredAt);
  const window = seconds(duration);
  const extra = seconds(extension);
  if (!delivered || window === null || extra === null) return null;
  const deadline = (delivered + window + extra) * 1000;
  return Number.isSafeInteger(deadline) ? deadline : null;
}

export function getJobAutoReleaseDeadlines(job: JobTiming): Deadlines {
  const deadlines: Deadlines = {};
  for (const milestone of job.milestones ?? []) {
    if (milestone.status !== "Delivered") continue;
    deadlines[milestone.index] = deadlineMs(
      milestone.deliveredAt,
      milestone.autoReleaseSeconds ?? job.autoReleaseSeconds,
      milestone.extensionSeconds ?? 0
    );
  }
  return deadlines;
}

interface EscrowTimingSnapshot {
  job?: {
    auto_release_seconds?: unknown;
    milestones?: { delivered_at?: unknown }[];
  };
  milestone_timing?: { extension_seconds?: unknown; deadline?: unknown }[];
}

// The dashboard and its action panel can request the same job concurrently.
const pendingTimingReads = new Map<string, Promise<EscrowTimingSnapshot | null>>();

function readJobTiming(jobId: string): Promise<EscrowTimingSnapshot | null> {
  const pending = pendingTimingReads.get(jobId);
  if (pending) return pending;

  const read = simulateContractRead(jobId, "get_escrow_state")
    .then((value) => value as EscrowTimingSnapshot)
    .catch(() => null)
    .finally(() => pendingTimingReads.delete(jobId));
  pendingTimingReads.set(jobId, read);
  return read;
}

/** Read all extensions for a job in one simulation and calculate its deadlines. */
export async function fetchAllAutoReleaseDeadlines(
  job: JobTiming,
  signal?: AbortSignal
): Promise<Deadlines> {
  const deadlines = getJobAutoReleaseDeadlines(job);
  const delivered = (job.milestones ?? []).filter((milestone) => milestone.status === "Delivered");
  if (delivered.length === 0 || signal?.aborted) return deadlines;

  const snapshot = await readJobTiming(job.id);
  if (!snapshot || signal?.aborted) return deadlines;

  for (const milestone of delivered) {
    const index = milestone.index;
    const timing = snapshot.milestone_timing?.[index];
    const extension = seconds(timing?.extension_seconds);
    const chainDeadline = seconds(timing?.deadline);
    if (chainDeadline === null || extension === null) continue;
    const computed = deadlineMs(
      snapshot.job?.milestones?.[index]?.delivered_at ?? milestone.deliveredAt,
      snapshot.job?.auto_release_seconds ?? milestone.autoReleaseSeconds ?? job.autoReleaseSeconds,
      extension
    );
    const reported = chainDeadline * 1000;
    deadlines[index] = computed ?? (Number.isSafeInteger(reported) ? reported : deadlines[index]);
  }
  return deadlines;
}
