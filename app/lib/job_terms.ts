/**
 * job_terms: the rules fixed at creation that decide what happens next on a
 * job (#857): auto-release window, dispute timeout, arbiter fee, funding mode.
 */
import { BACKEND_URL } from "@/app/lib/config";
import { formatFeeBps } from "@/app/lib/arbiter_fee";

const SECONDS_PER_DAY = 86_400;

export const DEFAULT_AUTO_RELEASE_SECONDS = 7 * SECONDS_PER_DAY;
export const DEFAULT_DISPUTE_TIMEOUT_SECONDS = 30 * SECONDS_PER_DAY;

export type FundingMode = "Upfront" | "PerMilestone";

export interface JobTerms {
  autoReleaseSeconds: number;
  disputeTimeoutSeconds: number;
  arbiterFeeBps: number;
  fundingMode: string;
}

export const DEFAULT_JOB_TERMS: JobTerms = {
  autoReleaseSeconds: DEFAULT_AUTO_RELEASE_SECONDS,
  disputeTimeoutSeconds: DEFAULT_DISPUTE_TIMEOUT_SECONDS,
  arbiterFeeBps: 0,
  fundingMode: "Upfront",
};

function pickNumber(sources: Record<string, unknown>[], keys: string[]): number | undefined {
  for (const src of sources) {
    for (const key of keys) {
      const v = src[key];
      const n = typeof v === "bigint" ? Number(v) : typeof v === "string" ? Number(v) : v;
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

function pickString(sources: Record<string, unknown>[], keys: string[]): string | undefined {
  for (const src of sources) {
    for (const key of keys) {
      const v = src[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

/**
 * Reads the terms out of a decoded `get_escrow_state` result, looking on the
 * job and on its `settings` object. Anything absent falls back to the
 * contract defaults used when a job is created from this app.
 */
export function parseJobTerms(result: unknown): JobTerms {
  const root = (typeof result === "object" && result !== null ? result : {}) as Record<
    string,
    unknown
  >;
  const job = (typeof root.job === "object" && root.job !== null ? root.job : {}) as Record<
    string,
    unknown
  >;
  const settings = (typeof job.settings === "object" && job.settings !== null
    ? job.settings
    : typeof root.settings === "object" && root.settings !== null
      ? root.settings
      : {}) as Record<string, unknown>;
  const sources = [settings, job, root];

  return {
    autoReleaseSeconds:
      pickNumber(sources, ["auto_release_seconds", "autoReleaseSeconds"]) ??
      DEFAULT_JOB_TERMS.autoReleaseSeconds,
    disputeTimeoutSeconds:
      pickNumber(sources, ["dispute_timeout_seconds", "disputeTimeoutSeconds"]) ??
      DEFAULT_JOB_TERMS.disputeTimeoutSeconds,
    arbiterFeeBps:
      pickNumber(sources, ["arbiter_fee_bps", "arbiterFeeBps"]) ?? DEFAULT_JOB_TERMS.arbiterFeeBps,
    fundingMode:
      pickString(sources, ["funding_mode", "fundingMode"]) ?? DEFAULT_JOB_TERMS.fundingMode,
  };
}

/** "7 days", "1 day", "12 hours", "45 minutes". */
export function formatTermDuration(seconds: number): string {
  if (seconds >= SECONDS_PER_DAY) {
    const d = Math.round(seconds / SECONDS_PER_DAY);
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  if (seconds >= 3600) {
    const h = Math.round(seconds / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

export interface JobTermLine {
  label: string;
  value: string;
  description: string;
}

/** The four terms in plain language, in display order. */
export function describeJobTerms(terms: JobTerms): JobTermLine[] {
  const funding =
    terms.fundingMode === "Upfront"
      ? "Upfront"
      : terms.fundingMode === "PerMilestone"
        ? "Per milestone"
        : terms.fundingMode;
  return [
    {
      label: "Auto-release window",
      value: formatTermDuration(terms.autoReleaseSeconds),
      description: `Client has ${formatTermDuration(terms.autoReleaseSeconds)} to review each delivery`,
    },
    {
      label: "Dispute timeout",
      value: formatTermDuration(terms.disputeTimeoutSeconds),
      description: `Either party can escalate a dispute after ${formatTermDuration(terms.disputeTimeoutSeconds)} without a ruling`,
    },
    {
      label: "Arbiter fee",
      value: formatFeeBps(terms.arbiterFeeBps),
      description:
        terms.arbiterFeeBps === 0
          ? "The arbiter takes no fee from a disputed milestone"
          : `The arbiter takes ${formatFeeBps(terms.arbiterFeeBps)} of a disputed milestone`,
    },
    {
      label: "Funding mode",
      value: funding,
      description:
        terms.fundingMode === "Upfront"
          ? "The client funds the whole job up front"
          : `Funding: ${funding}`,
    },
  ];
}

/** Fetches the job's terms from `get_escrow_state`; null when unavailable. */
export async function fetchJobTerms(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<JobTerms | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/jobs/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, method: "get_escrow_state" }),
      signal: options?.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: { result?: unknown } };
    if (!body?.success || !body.data?.result) return null;
    return parseJobTerms(body.data.result);
  } catch {
    return null;
  }
}
