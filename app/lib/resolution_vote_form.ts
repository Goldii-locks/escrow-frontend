/**
 * resolution_vote_form — Pure helpers and data services backing the
 * arbitrator vote split selector (`app/components/ResolutionVoteForm.tsx`).
 *
 * Implements:
 * - Input sanitization against script / markup injection (Issue #452)
 * - Dispute data queries with payload normalisation and mock fallback (Issue #453)
 * - Status badge classification and styling (Issue #454)
 * - Vote submission shaping for the confirmation modal (Issue #455)
 */

/** Basis-point scale: a split is expressed as client + freelancer = 10 000. */
export const RESOLUTION_BPS_SCALE = 10_000;

/** Upper bound for the rationale field, applied after sanitization. */
export const RESOLUTION_RATIONALE_MAX_LENGTH = 500;

/** Window before the deadline in which a pending vote needs attention. */
export const RESOLUTION_ACTION_REQUIRED_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Option id used for the arbitrator's own split. */
export const CUSTOM_VOTE_OPTION_ID = "custom";

export type ArbitratorVoteStatus = "eligible" | "voted" | "ineligible";

export interface ResolutionVoteOption {
  id: string;
  label: string;
  clientBps: number;
  freelancerBps: number;
}

export interface ResolutionDisputeData {
  disputeId: string;
  jobId: string;
  /** Disputed amount, pre-formatted for display. */
  amount: string;
  /** Split currently proposed / leading for this dispute. */
  currentSplit: { clientBps: number; freelancerBps: number };
  arbitratorStatus: ArbitratorVoteStatus;
  /** ISO-8601 voting deadline. */
  deadline: string;
  /** Whether the dispute has already been resolved on-chain. */
  resolved: boolean;
  voteOptions: ResolutionVoteOption[];
}

export interface ResolutionVoteSubmission {
  disputeId: string;
  optionId: string;
  clientBps: number;
  freelancerBps: number;
  rationale: string;
}

// ── Issue #452: sanitization ────────────────────────────────────────────────

/** Elements whose *contents* are executable or embedded and must go entirely. */
const DANGEROUS_BLOCK_TAGS = ["script", "style", "iframe", "object", "embed", "code"];

/**
 * Strip markup and executable payloads from free-text input.
 *
 * - `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>` and `<code>`
 *   elements are removed together with their contents.
 * - Every remaining tag (including self-closing / unterminated ones such as
 *   `<img src=x onerror=...>`) is removed, which also drops inline event
 *   handler attributes.
 * - Stray `on*=` handler fragments and `javascript:` / `vbscript:` /
 *   `data:text/html` URI schemes are neutralised.
 *
 * The result is plain text; React escapes it again when rendered.
 */
export function sanitizeVoteInput(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";

  let cleaned = input;
  for (const tag of DANGEROUS_BLOCK_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    const unclosed = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, "gi");
    cleaned = cleaned.replace(paired, "").replace(unclosed, "");
  }
  // Any other complete or unterminated tag.
  cleaned = cleaned.replace(/<\/?[a-z!][^>]*(>|$)/gi, "");
  // Inline handlers that survived outside a tag, e.g. `onerror=alert(1)`.
  cleaned = cleaned.replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Script-bearing URI schemes.
  cleaned = cleaned.replace(/\b(?:javascript|vbscript)\s*:/gi, "");
  cleaned = cleaned.replace(/\bdata\s*:\s*text\/html[^\s]*/gi, "");

  return cleaned.replace(/\s+/g, " ").trim();
}

/** True when sanitization would change the input, i.e. it carries markup. */
export function containsUnsafeMarkup(input: unknown): boolean {
  if (typeof input !== "string") return false;
  return sanitizeVoteInput(input) !== input.replace(/\s+/g, " ").trim();
}

/**
 * Sanitize a basis-point field: keep digits only and clamp to
 * `[0, RESOLUTION_BPS_SCALE]`. Returns an empty string for empty input so the
 * field can be cleared while typing.
 */
export function sanitizeBpsInput(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  const digits = String(input).replace(/[^0-9]/g, "").slice(0, 5);
  if (digits === "") return "";
  return String(Math.min(Number(digits), RESOLUTION_BPS_SCALE));
}

// ── split helpers ───────────────────────────────────────────────────────────

export function isValidBps(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= RESOLUTION_BPS_SCALE
  );
}

export function isValidSplit(clientBps: unknown, freelancerBps: unknown): boolean {
  return (
    isValidBps(clientBps) &&
    isValidBps(freelancerBps) &&
    clientBps + freelancerBps === RESOLUTION_BPS_SCALE
  );
}

/** Format basis points as a percentage, e.g. `6000` → `"60%"`, `3333` → `"33.33%"`. */
export function formatBpsAsPercent(bps: number): string {
  const percent = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${percent}%`;
}

// ── Issue #453: data binding ────────────────────────────────────────────────

export const RESOLUTION_LOAD_ERROR = "Unable to load dispute details. Please try again.";

export const MOCK_RESOLUTION_DISPUTES: Record<string, ResolutionDisputeData> = {
  "disp-101": {
    disputeId: "disp-101",
    jobId: "job-7",
    amount: "1,500 XLM",
    currentSplit: { clientBps: 5_000, freelancerBps: 5_000 },
    arbitratorStatus: "eligible",
    deadline: "2026-10-05T12:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "full-refund", label: "Full refund to client", clientBps: 10_000, freelancerBps: 0 },
      { id: "even-split", label: "Even split", clientBps: 5_000, freelancerBps: 5_000 },
      { id: "full-release", label: "Full release to freelancer", clientBps: 0, freelancerBps: 10_000 },
    ],
  },
  "disp-102": {
    disputeId: "disp-102",
    jobId: "job-9",
    amount: "800 XLM",
    currentSplit: { clientBps: 3_000, freelancerBps: 7_000 },
    arbitratorStatus: "voted",
    deadline: "2026-10-01T12:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "favor-client", label: "Favor client (70/30)", clientBps: 7_000, freelancerBps: 3_000 },
      { id: "favor-freelancer", label: "Favor freelancer (30/70)", clientBps: 3_000, freelancerBps: 7_000 },
    ],
  },
};

/**
 * Validate and normalise an untrusted dispute payload. Free-text fields are
 * sanitized and invalid vote options are dropped. Returns `null` when the
 * payload is not a usable dispute record.
 */
export function normalizeResolutionDispute(raw: unknown): ResolutionDisputeData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const disputeId = sanitizeVoteInput(r.disputeId);
  if (!disputeId) return null;

  const split = (r.currentSplit ?? {}) as Record<string, unknown>;
  const currentSplit = isValidSplit(split.clientBps, split.freelancerBps)
    ? { clientBps: split.clientBps as number, freelancerBps: split.freelancerBps as number }
    : { clientBps: 5_000, freelancerBps: 5_000 };

  const arbitratorStatus: ArbitratorVoteStatus =
    r.arbitratorStatus === "voted" || r.arbitratorStatus === "ineligible"
      ? r.arbitratorStatus
      : "eligible";

  const voteOptions: ResolutionVoteOption[] = [];
  if (Array.isArray(r.voteOptions)) {
    for (const entry of r.voteOptions) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const id = sanitizeVoteInput(o.id);
      const label = sanitizeVoteInput(o.label);
      if (!id || !label || id === CUSTOM_VOTE_OPTION_ID) continue;
      if (!isValidSplit(o.clientBps, o.freelancerBps)) continue;
      voteOptions.push({
        id,
        label,
        clientBps: o.clientBps as number,
        freelancerBps: o.freelancerBps as number,
      });
    }
  }

  const deadline =
    typeof r.deadline === "string" && !Number.isNaN(Date.parse(r.deadline)) ? r.deadline : "";

  return {
    disputeId,
    jobId: sanitizeVoteInput(r.jobId),
    amount: sanitizeVoteInput(r.amount),
    currentSplit,
    arbitratorStatus,
    deadline,
    resolved: r.resolved === true,
    voteOptions,
  };
}

/**
 * Load a dispute for the vote form.
 *
 * - API `2xx` with a valid payload → normalised record.
 * - API `404` → `null` (empty state).
 * - Any other failure → the mock record for `disputeId` if one exists,
 *   otherwise throws `RESOLUTION_LOAD_ERROR` (error state).
 */
export async function fetchResolutionDispute(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal },
): Promise<ResolutionDisputeData | null> {
  const url = options?.apiUrl || `/api/disputes/${encodeURIComponent(disputeId)}/resolution`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.status === 404) return null;
    if (res.ok) {
      const normalized = normalizeResolutionDispute(await res.json());
      if (normalized) return normalized;
    }
  } catch {
    // Network or server error — fall through to the mock dataset.
  }

  const mock = MOCK_RESOLUTION_DISPUTES[disputeId];
  if (mock) return mock;
  throw new Error(RESOLUTION_LOAD_ERROR);
}

// ── Issue #454: status badges ───────────────────────────────────────────────

export type ResolutionVoteStatus = "pending_vote" | "voted" | "closed" | "action_required";

export interface ResolutionBadgeStyle {
  label: string;
  /** Design tone: green = done, amber = pending, orange = urgent, red = closed. */
  tone: "green" | "amber" | "orange" | "red";
  className: string;
}

const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export const RESOLUTION_BADGE_STYLES: Record<ResolutionVoteStatus, ResolutionBadgeStyle> = {
  pending_vote: {
    label: "Pending Vote",
    tone: "amber",
    className: `${BADGE_BASE} border-amber-600/50 bg-amber-900/40 text-amber-300`,
  },
  voted: {
    label: "Voted",
    tone: "green",
    className: `${BADGE_BASE} border-emerald-600/50 bg-emerald-900/40 text-emerald-300`,
  },
  closed: {
    label: "Resolution Closed",
    tone: "red",
    className: `${BADGE_BASE} border-red-600/50 bg-red-900/40 text-red-300`,
  },
  action_required: {
    label: "Action Required",
    tone: "orange",
    className: `${BADGE_BASE} border-orange-500/60 bg-orange-900/40 text-orange-300`,
  },
};

/**
 * Classify the dispute for the status badge.
 *
 * Precedence: resolved or past deadline → `closed`; already voted →
 * `voted`; eligible with less than `RESOLUTION_ACTION_REQUIRED_WINDOW_MS`
 * left → `action_required`; otherwise `pending_vote`.
 */
export function getResolutionVoteStatus(
  data: Pick<ResolutionDisputeData, "resolved" | "deadline" | "arbitratorStatus">,
  nowMs: number,
  hasVotedLocally = false,
): ResolutionVoteStatus {
  const deadlineMs = data.deadline ? Date.parse(data.deadline) : Number.NaN;
  const pastDeadline = !Number.isNaN(deadlineMs) && nowMs >= deadlineMs;

  if (data.resolved || pastDeadline) return "closed";
  if (hasVotedLocally || data.arbitratorStatus === "voted") return "voted";
  if (
    data.arbitratorStatus === "eligible" &&
    !Number.isNaN(deadlineMs) &&
    deadlineMs - nowMs <= RESOLUTION_ACTION_REQUIRED_WINDOW_MS
  ) {
    return "action_required";
  }
  return "pending_vote";
}

// ── Issue #455: submission shaping ──────────────────────────────────────────

export interface VoteDraft {
  optionId: string;
  /** Raw client bps text for the custom option. */
  customClientBps: string;
  rationale: string;
}

export type VoteDraftResult =
  | { ok: true; submission: ResolutionVoteSubmission }
  | { ok: false; error: string };

export const VOTE_OPTION_REQUIRED_ERROR = "Select a split before submitting your vote.";
export const VOTE_CUSTOM_SPLIT_ERROR = `Enter a client share between 0 and ${RESOLUTION_BPS_SCALE} bps.`;
export const VOTE_RATIONALE_MARKUP_ERROR =
  "Rationale contained only disallowed markup. Please describe your decision in plain text.";
export const VOTE_RATIONALE_LENGTH_ERROR = `Rationale must be ${RESOLUTION_RATIONALE_MAX_LENGTH} characters or fewer.`;

/**
 * Turn the form draft into a sanitized submission, or return the first
 * validation error. Nothing here signs or sends anything; the component only
 * shows the confirmation modal once this succeeds.
 */
export function buildVoteSubmission(
  data: ResolutionDisputeData,
  draft: VoteDraft,
): VoteDraftResult {
  let clientBps: number;
  let freelancerBps: number;

  if (draft.optionId === CUSTOM_VOTE_OPTION_ID) {
    const cleaned = sanitizeBpsInput(draft.customClientBps);
    if (cleaned === "") return { ok: false, error: VOTE_CUSTOM_SPLIT_ERROR };
    clientBps = Number(cleaned);
    freelancerBps = RESOLUTION_BPS_SCALE - clientBps;
  } else {
    const option = data.voteOptions.find((o) => o.id === draft.optionId);
    if (!option) return { ok: false, error: VOTE_OPTION_REQUIRED_ERROR };
    clientBps = option.clientBps;
    freelancerBps = option.freelancerBps;
  }

  const rationale = sanitizeVoteInput(draft.rationale);
  if (!rationale && draft.rationale.trim() !== "") {
    return { ok: false, error: VOTE_RATIONALE_MARKUP_ERROR };
  }
  if (rationale.length > RESOLUTION_RATIONALE_MAX_LENGTH) {
    return { ok: false, error: VOTE_RATIONALE_LENGTH_ERROR };
  }

  return {
    ok: true,
    submission: {
      disputeId: data.disputeId,
      optionId: draft.optionId,
      clientBps,
      freelancerBps,
      rationale,
    },
  };
}
