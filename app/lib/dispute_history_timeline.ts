import type { ToastType } from "@/app/context/ToastContext";

/**
 * dispute_history_timeline — Pure helpers and data services backing the
 * dispute history timeline (`app/components/DisputeHistoryTimeline.tsx`).
 *
 * Implements:
 * - Role-based access control for viewing dispute history (Issue #440)
 * - Loading placeholder structure (Issue #441)
 * - User input sanitization against code/script tags (Issue #442)
 * - Backend data queries with mock dataset fallback (Issue #443)
 * - State badges per event status (Issue #444)
 * - Double-confirm gating for actions that sign a transaction (Issue #445)
 * - Toast messages for action success and failure (Issue #446)
 * - CSV export formatting and client-side download (Issue #447)
 *
 * Mirrors the conventions established by `app/lib/arbitrator_evidence_list.ts`.
 */

export type DisputeHistoryEventType =
  | "raised"
  | "evidence_submitted"
  | "response"
  | "arbiter_assigned"
  | "note"
  | "resolved";

export interface DisputeHistoryEvent {
  id: string;
  disputeId: string;
  type: DisputeHistoryEventType;
  actor: string;
  actorRole: "client" | "freelancer" | "arbiter";
  title: string;
  description: string;
  timestamp: string;
  /** Workflow state of the event; drives the badge and available actions. */
  status?: DisputeTimelineStatus;
}

export const UNAUTHORIZED_TIMELINE_WARNING =
  "Access Restricted: Only wallets that are party to this dispute can view its history.";

/** Number of placeholder rows rendered while the history loads. */
export const TIMELINE_SKELETON_ROWS = 3;

/**
 * Checks whether the wallet may view the dispute history.
 *
 * A missing or blank wallet is always rejected. When a whitelist of dispute
 * participants is supplied the wallet must appear in it (case-insensitive);
 * without a whitelist any connected wallet is accepted.
 */
export function isTimelineViewerAuthorized(
  walletAddress: string | null | undefined,
  authorizedWallets?: string[],
): boolean {
  if (!walletAddress || typeof walletAddress !== "string") return false;
  const trimmed = walletAddress.trim().toLowerCase();
  if (!trimmed) return false;

  if (!authorizedWallets || authorizedWallets.length === 0) return true;

  return authorizedWallets.some((w) => w.trim().toLowerCase() === trimmed);
}

/**
 * Strips script tags, code tags (with contents) and any remaining HTML from
 * user input passed to the timeline forms.
 */
export function sanitizeTimelineInput(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

/** Mock dataset used as a fallback when the backend query fails. */
export const MOCK_DISPUTE_HISTORY: DisputeHistoryEvent[] = [
  {
    id: "evt-001",
    disputeId: "disp-101",
    type: "raised",
    actor: "GCKF7J3...CLIENT",
    actorRole: "client",
    title: "Dispute raised",
    description: "Client disputed milestone 2 deliverables.",
    timestamp: "2026-09-20T10:15:00Z",
  },
  {
    id: "evt-002",
    disputeId: "disp-101",
    type: "response",
    actor: "GAX4K9L...FREELANCER",
    actorRole: "freelancer",
    title: "Freelancer responded",
    description: "Freelancer submitted deployment proof for the milestone.",
    timestamp: "2026-09-21T14:30:00Z",
  },
  {
    id: "evt-003",
    disputeId: "disp-101",
    type: "arbiter_assigned",
    actor: "GARB2M8...ARBITER",
    actorRole: "arbiter",
    title: "Arbiter assigned",
    description: "An arbiter accepted the dispute for review.",
    timestamp: "2026-09-22T09:00:00Z",
  },
];

/**
 * Queries history events for a dispute. Pulls from the backend API and falls
 * back to the mock dataset on a network or server error.
 */
export async function fetchDisputeHistory(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal },
): Promise<DisputeHistoryEvent[]> {
  const url =
    options?.apiUrl ||
    `/api/disputes/${encodeURIComponent(disputeId)}/history`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Network or server error - fall back to the mock dataset
  }

  const matched = MOCK_DISPUTE_HISTORY.filter((e) => e.disputeId === disputeId);
  return matched.length > 0 ? matched : MOCK_DISPUTE_HISTORY;
}

// =============================================================
// Status badges, confirmed actions, toasts and CSV export (#444-#447)
// =============================================================

const LOG_PREFIX = "[dispute_history_timeline]";

// =============================================================
// Types
// =============================================================

export type DisputeTimelineStatus =
  | "pending"
  | "under_review"
  | "escalated"
  | "resolved"
  | "rejected";

/** A timeline event that carries a workflow status. */
export type DisputeTimelineEvent = DisputeHistoryEvent & {
  status: DisputeTimelineStatus;
};

/** Timeline actions that sign a transaction and therefore need confirming. */
export type DisputeTimelineAction = "escalate" | "withdraw";

// =============================================================
// State badges (#444)
// =============================================================

export interface DisputeStatusBadge {
  status: DisputeTimelineStatus;
  label: string;
  /** Non-colour marker so the state is not conveyed by colour alone. */
  glyph: string;
  /** Tailwind classes drawn from the `@theme` tokens in `app/globals.css`. */
  className: string;
}

export const DISPUTE_STATUS_BADGES: Record<DisputeTimelineStatus, DisputeStatusBadge> = {
  pending: {
    status: "pending",
    label: "Pending",
    glyph: "●",
    className: "border-warning-soft/60 bg-warning-soft/15 text-warning-soft",
  },
  under_review: {
    status: "under_review",
    label: "Under review",
    glyph: "◐",
    className: "border-info-soft/60 bg-info-soft/15 text-info-soft",
  },
  escalated: {
    status: "escalated",
    label: "Escalated",
    glyph: "▲",
    className: "border-partial/60 bg-partial/15 text-partial-soft",
  },
  resolved: {
    status: "resolved",
    label: "Resolved",
    glyph: "✓",
    className: "border-success/60 bg-success/15 text-success-soft",
  },
  rejected: {
    status: "rejected",
    label: "Rejected",
    glyph: "✕",
    className: "border-danger-soft/60 bg-danger/20 text-danger-soft",
  },
};

/**
 * Returns the badge for a status. Unknown statuses fall back to `pending`
 * rather than throwing, so one malformed backend record cannot blank the list.
 */
export function getStatusBadge(status: string | null | undefined): DisputeStatusBadge {
  if (status && Object.prototype.hasOwnProperty.call(DISPUTE_STATUS_BADGES, status)) {
    return DISPUTE_STATUS_BADGES[status as DisputeTimelineStatus];
  }
  return DISPUTE_STATUS_BADGES.pending;
}

// =============================================================
// Action confirmation (#445)
// =============================================================

export interface DisputeActionConfig {
  action: DisputeTimelineAction;
  /** Label of the button that opens the confirmation dialog. */
  buttonLabel: string;
  /** Heading of the confirmation dialog. */
  confirmTitle: string;
  /** Warning shown in the dialog before the user signs. */
  warning: string;
  /** Label of the final "sign" button in the dialog. */
  confirmLabel: string;
}

export const DISPUTE_ACTIONS: Record<DisputeTimelineAction, DisputeActionConfig> = {
  escalate: {
    action: "escalate",
    buttonLabel: "Escalate",
    confirmTitle: "Escalate this dispute?",
    warning:
      "Escalating hands the dispute to a senior arbiter and requires signing a transaction.",
    confirmLabel: "Sign & escalate",
  },
  withdraw: {
    action: "withdraw",
    buttonLabel: "Withdraw",
    confirmTitle: "Withdraw this dispute?",
    warning:
      "Withdrawing closes the dispute and releases the escrow. This requires signing a transaction and cannot be undone.",
    confirmLabel: "Sign & withdraw",
  },
};

/** Actions offered for an event: only unsettled events can be acted on. */
export function getAvailableActions(status: DisputeTimelineStatus): DisputeTimelineAction[] {
  switch (status) {
    case "pending":
    case "under_review":
      return ["escalate", "withdraw"];
    case "escalated":
      return ["withdraw"];
    default:
      return [];
  }
}

/** State of the double-confirm dialog. */
export interface ConfirmationState {
  /** Step 1: the dialog has been opened for an action. */
  opened: boolean;
  /** Step 2: the user ticked the explicit acknowledgement. */
  acknowledged: boolean;
  submitting: boolean;
}

export const INITIAL_CONFIRMATION_STATE: ConfirmationState = {
  opened: false,
  acknowledged: false,
  submitting: false,
};

/**
 * A transaction may only be submitted once the dialog is open AND the user has
 * ticked the acknowledgement, and never while a submission is in flight.
 */
export function canSubmitAction(state: ConfirmationState): boolean {
  return state.opened && state.acknowledged && !state.submitting;
}

// =============================================================
// Toast messages (#446)
// =============================================================

export interface ActionToast {
  message: string;
  type: ToastType;
}

export function getActionToast(
  action: DisputeTimelineAction,
  outcome: "success" | "failure",
  error?: unknown,
): ActionToast {
  const verb = action === "escalate" ? "escalated" : "withdrawn";
  if (outcome === "success") {
    return { message: `Dispute ${verb} successfully.`, type: "success" };
  }
  const reason = error instanceof Error && error.message ? `: ${error.message}` : "";
  return { message: `Could not ${action} the dispute${reason}`, type: "error" };
}

export const EXPORT_EMPTY_TOAST: ActionToast = {
  message: "There are no timeline events to export.",
  type: "warning",
};

export const EXPORT_SUCCESS_TOAST: ActionToast = {
  message: "Dispute history exported.",
  type: "success",
};

// =============================================================
// CSV export (#447)
// =============================================================

export const EXPORT_COLUMNS = [
  "Event ID",
  "Dispute ID",
  "Title",
  "Description",
  "Actor",
  "Status",
  "Occurred At",
] as const;

/**
 * Escapes one CSV cell. Cells starting with a formula trigger are prefixed
 * with a single quote so spreadsheet apps show them as text instead of
 * evaluating them (CSV injection); the cell is then quoted per RFC 4180 when
 * it holds a delimiter, quote or line break.
 */
export function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Formats events as CSV text: a header row, then one row per event. */
export function buildTimelineCsv(events: DisputeHistoryEvent[]): string {
  const rows = events.map((e) =>
    [
      e.id,
      e.disputeId,
      e.title,
      e.description,
      e.actor,
      e.status ? getStatusBadge(e.status).label : "",
      e.timestamp,
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [EXPORT_COLUMNS.map(escapeCsvCell).join(","), ...rows].join("\r\n");
}

export function getExportFilename(disputeId: string): string {
  const safe = disputeId.replace(/[^A-Za-z0-9_-]/g, "_") || "dispute";
  return `dispute-history-${safe}.csv`;
}

/**
 * Triggers a client-side download of the events as a CSV file.
 * Returns `false` (and downloads nothing) when there is nothing to export.
 */
export function downloadTimelineCsv(events: DisputeHistoryEvent[], filename: string): boolean {
  if (events.length === 0) return false;

  // Leading BOM so Excel reads the file as UTF-8.
  const blob = new Blob(["\uFEFF" + buildTimelineCsv(events)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error(`${LOG_PREFIX} export failed`, err);
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
  return true;
}

// =============================================================
// Sample data
// =============================================================

export const MOCK_TIMELINE_EVENTS: DisputeTimelineEvent[] = [
  {
    id: "evt-001",
    disputeId: "disp-101",
    type: "raised",
    title: "Dispute raised",
    description: "Client disputed milestone 2 delivery.",
    actor: "client",
    actorRole: "client",
    status: "resolved",
    timestamp: "2026-09-20T10:15:00Z",
  },
  {
    id: "evt-002",
    disputeId: "disp-101",
    type: "arbiter_assigned",
    title: "Arbiter assigned",
    description: "An arbiter accepted the case and began review.",
    actor: "arbiter",
    actorRole: "arbiter",
    status: "under_review",
    timestamp: "2026-09-21T14:30:00Z",
  },
  {
    id: "evt-003",
    disputeId: "disp-101",
    type: "response",
    title: "Awaiting freelancer response",
    description: "Freelancer has until the response deadline to reply.",
    actor: "freelancer",
    actorRole: "freelancer",
    status: "pending",
    timestamp: "2026-09-22T09:00:00Z",
  },
];
