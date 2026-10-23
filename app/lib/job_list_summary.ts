/**
 * Helpers for the dashboard job list rows: role, counterparty, milestone
 * progress, latest activity and an optional local label per contract.
 */

export type JobRole = "client" | "freelancer" | "arbiter";

export interface JobSummaryInput {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  role?: string;
  milestones?: Array<{ status: string }> | null;
  milestoneCount?: number;
  releasedCount?: number;
  latestEventType?: string;
  latestEventAt?: string | number;
  latestLedger?: number;
}

const ROLE_LABELS: Record<JobRole, string> = {
  client: "Client",
  freelancer: "Freelancer",
  arbiter: "Arbiter",
};

export function shortAddress(address: string): string {
  if (!address) return "";
  return address.length <= 10 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Roles from the backend summary when known, else derived from the wallet address. */
export function getJobRoles(job: JobSummaryInput, address: string | null): JobRole[] {
  const backendRole = job.role?.toLowerCase();
  if (backendRole && backendRole in ROLE_LABELS) return [backendRole as JobRole];
  if (!address) return [];
  return (["client", "freelancer", "arbiter"] as const).filter((r) => job[r] === address);
}

export function roleLabel(role: JobRole): string {
  return ROLE_LABELS[role];
}

/** The other party: freelancer for a client, client otherwise. */
export function getCounterparty(job: JobSummaryInput, roles: JobRole[]): string {
  if (roles.includes("client")) return job.freelancer;
  return job.client;
}

export function formatMilestoneProgress(job: JobSummaryInput): string | null {
  const total = job.milestones?.length ?? job.milestoneCount ?? 0;
  if (total <= 0) return null;
  const released =
    job.releasedCount ??
    job.milestones?.filter((m) => m.status.toLowerCase() === "released").length ??
    0;
  return `${released} of ${total} released`;
}

function humanizeEventType(eventType: string): string {
  const words = eventType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .filter((w) => w !== "milestone" && w !== "job" && w !== "escrow");
  const text = words.join(" ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function formatRelativeTime(at: string | number, now: number = Date.now()): string | null {
  const ms = typeof at === "number" ? (at < 1e12 ? at * 1000 : at) : Date.parse(at);
  if (!Number.isFinite(ms)) return null;
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatLatestActivity(
  job: JobSummaryInput,
  now: number = Date.now()
): string | null {
  if (!job.latestEventType) return null;
  const label = humanizeEventType(job.latestEventType);
  if (!label) return null;
  if (job.latestEventAt !== undefined) {
    const when = formatRelativeTime(job.latestEventAt, now);
    if (when) return `${label} ${when}`;
  }
  if (job.latestLedger !== undefined) return `${label} at ledger ${job.latestLedger}`;
  return label;
}

const LABEL_PREFIX = "escrow:job-label:";

export function getJobLabel(contractId: string): string {
  try {
    return localStorage.getItem(LABEL_PREFIX + contractId) ?? "";
  } catch {
    return "";
  }
}

export function setJobLabel(contractId: string, label: string): void {
  try {
    const trimmed = label.trim();
    if (trimmed) localStorage.setItem(LABEL_PREFIX + contractId, trimmed);
    else localStorage.removeItem(LABEL_PREFIX + contractId);
  } catch {
    // Storage unavailable (private mode); labels are best-effort.
  }
}
