/**
 * dispute_history_timeline — Pure helpers backing the dispute history
 * timeline view (`app/components/DisputeHistoryTimeline.tsx`).
 *
 * Implements:
 * - State badges: a distinct colour, glyph and label per event status (#444)
 * - Double-confirm gating for actions that sign a transaction (#445)
 * - Toast messages for action success and failure (#446)
 * - CSV export formatting and client-side download (#447)
 *
 * Keeping these rules here (rather than inline in JSX) lets each one be
 * asserted directly in tests. Mirrors the conventions of
 * `app/lib/arbitrator_evidence_list.ts`.
 */

import type { ToastType } from "@/app/context/ToastContext";

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

export interface DisputeTimelineEvent {
  id: string;
  disputeId: string;
  /** Short heading, e.g. "Dispute raised". */
  title: string;
  description: string;
  /** Wallet address or role that triggered the event. */
  actor: string;
  status: DisputeTimelineStatus;
  /** ISO-8601 timestamp. */
  occurredAt: string;
}

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
export function buildTimelineCsv(events: DisputeTimelineEvent[]): string {
  const rows = events.map((e) =>
    [e.id, e.disputeId, e.title, e.description, e.actor, getStatusBadge(e.status).label, e.occurredAt]
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
export function downloadTimelineCsv(events: DisputeTimelineEvent[], filename: string): boolean {
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
    title: "Dispute raised",
    description: "Client disputed milestone 2 delivery.",
    actor: "client",
    status: "resolved",
    occurredAt: "2026-09-20T10:15:00Z",
  },
  {
    id: "evt-002",
    disputeId: "disp-101",
    title: "Arbiter assigned",
    description: "An arbiter accepted the case and began review.",
    actor: "arbiter",
    status: "under_review",
    occurredAt: "2026-09-21T14:30:00Z",
  },
  {
    id: "evt-003",
    disputeId: "disp-101",
    title: "Awaiting freelancer response",
    description: "Freelancer has until the response deadline to reply.",
    actor: "freelancer",
    status: "pending",
    occurredAt: "2026-09-22T09:00:00Z",
  },
];
