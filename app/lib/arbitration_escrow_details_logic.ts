/**
 * arbitration_escrow_details_logic: badge, CSV export and skeleton helpers for
 * ArbitrationEscrowDetails, folded into one module (issue #616).
 */
import type { ArbitrationEscrowDetailsRecord } from "./arbitration_escrow_details";


// --- badges ---
/**
 * arbitration_escrow_details — state badges for arbitration views (#484).
 *
 * Distinct label, color and marker per dispute/arbitration state. Pure and React-free.
 */

export type ArbitrationBadgeState = "locked" | "under_review" | "resolved" | "pending" | "appealed";

export interface ArbitrationBadge {
  state: ArbitrationBadgeState;
  label: string;
  icon: string;
  className: string;
  ariaLabel: string;
}

const BADGES: Record<ArbitrationBadgeState, ArbitrationBadge> = {
  locked: {
    state: "locked",
    label: "Locked in Escrow",
    icon: "lock",
    className: "bg-red-100 text-red-800 border-red-200",
    ariaLabel: "Arbitration status: locked",
  },
  under_review: {
    state: "under_review",
    label: "Under Review",
    icon: "search",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    ariaLabel: "Arbitration status: under review",
  },
  resolved: {
    state: "resolved",
    label: "Resolved",
    icon: "check-circle",
    className: "bg-green-100 text-green-800 border-green-200",
    ariaLabel: "Arbitration status: resolved",
  },
  pending: {
    state: "pending",
    label: "Pending",
    icon: "clock",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ariaLabel: "Arbitration status: pending",
  },
  appealed: {
    state: "appealed",
    label: "Appealed",
    icon: "alert-triangle",
    className: "bg-purple-100 text-purple-800 border-purple-200",
    ariaLabel: "Arbitration status: appealed",
  },
};

/** Badge for an arbitration state; unknown or missing values fall back to pending badge. */
export function getArbitrationBadge(state: string | null | undefined): ArbitrationBadge {
  const normalized = (state ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_") as ArbitrationBadgeState;
  return Object.prototype.hasOwnProperty.call(BADGES, normalized)
    ? BADGES[normalized]
    : BADGES.pending;
}

/** Derive badge state from dispute condition flags. */
export function deriveArbitrationBadgeState(opts: {
  isLocked?: boolean;
  isUnderReview?: boolean;
  isResolved?: boolean;
  isAppealed?: boolean;
}): ArbitrationBadgeState {
  if (opts.isResolved) return "resolved";
  if (opts.isAppealed) return "appealed";
  if (opts.isUnderReview) return "under_review";
  if (opts.isLocked) return "locked";
  return "pending";
}

// --- skeleton ---
/**
 * arbitration_escrow_details — loading skeleton descriptors (#481).
 * Placeholder wireframe elements shown on arbitration_escrow_details while loading data.
 */

export interface ArbitrationSkeletonFrame {
  id: string;
  kind: "header" | "badge" | "grid-cell" | "action-bar";
  width: string;
  height: string;
}

export const ARBITRATION_SKELETON_FRAMES: readonly ArbitrationSkeletonFrame[] = [
  { id: "header-title", kind: "header", width: "200px", height: "24px" },
  { id: "header-badge", kind: "badge", width: "100px", height: "20px" },
  { id: "cell-1", kind: "grid-cell", width: "100%", height: "48px" },
  { id: "cell-2", kind: "grid-cell", width: "100%", height: "48px" },
  { id: "cell-3", kind: "grid-cell", width: "100%", height: "48px" },
  { id: "cell-4", kind: "grid-cell", width: "100%", height: "48px" },
  { id: "cell-5", kind: "grid-cell", width: "100%", height: "48px" },
  { id: "cell-6", kind: "grid-cell", width: "100%", height: "48px" },
  {
    id: "action-button",
    kind: "action-bar",
    width: "140px",
    height: "38px",
  },
];

/** Returns skeleton frames when loading is active; returns empty array when complete. */
export function getArbitrationSkeleton(isLoading: boolean): readonly ArbitrationSkeletonFrame[] {
  return isLoading ? ARBITRATION_SKELETON_FRAMES : [];
}

export const ARBITRATION_SKELETON_ARIA = {
  role: "status",
  "aria-busy": true,
  "aria-label": "Loading locked escrow details",
} as const;

// --- export ---
/**
 * arbitration_escrow_details — export data formatting helpers (#487).
 *
 * Client-side download formatting helpers for table views inside the
 * arbitration_escrow_details portal.
 */


export interface ArbitrationExportRow {
  escrowId: string;
  disputeId: string;
  status: string;
  lockedAt: string;
  lockedAmount: string;
  token: string;
  clientAddress: string;
  freelancerAddress: string;
  arbiterAddress: string;
  reason: string;
}

export const ARBITRATION_EXPORT_HEADERS = [
  "Escrow ID",
  "Dispute ID",
  "Status",
  "Locked At",
  "Locked Amount",
  "Token",
  "Client Address",
  "Freelancer Address",
  "Arbiter Address",
  "Reason",
] as const;

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function escapeArbitrationCsvCell(value: string | number | null | undefined): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Convert a record into an export row. */
export function toArbitrationExportRow(
  record: ArbitrationEscrowDetailsRecord
): ArbitrationExportRow {
  return {
    escrowId: record.escrowId,
    disputeId: record.disputeId,
    status: record.status,
    lockedAt: record.lockedAt,
    lockedAmount: record.lockedAmount,
    token: record.token,
    clientAddress: record.clientAddress,
    freelancerAddress: record.freelancerAddress,
    arbiterAddress: record.arbiterAddress ?? "",
    reason: record.reason,
  };
}

/** Format export rows as CSV text (CRLF rows, header included). */
export function buildArbitrationCsv(
  rows: (ArbitrationExportRow | ArbitrationEscrowDetailsRecord)[]
): string {
  const exportRows = rows.map((r) =>
    "disputeId" in r && "token" in r
      ? toArbitrationExportRow(r as ArbitrationEscrowDetailsRecord)
      : (r as ArbitrationExportRow)
  );

  const lines = [ARBITRATION_EXPORT_HEADERS.map(escapeArbitrationCsvCell).join(",")];
  for (const r of exportRows) {
    lines.push(
      [
        r.escrowId,
        r.disputeId,
        r.status,
        r.lockedAt,
        r.lockedAmount,
        r.token,
        r.clientAddress,
        r.freelancerAddress,
        r.arbiterAddress,
        r.reason,
      ]
        .map(escapeArbitrationCsvCell)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

/** Timestamped filename for dispute escrow export. */
export function arbitrationExportFilename(disputeId?: string, now: Date = new Date()): string {
  const dateStr = now.toISOString().slice(0, 10);
  const idPrefix = disputeId ? `${disputeId}-` : "";
  return `arbitration-escrow-${idPrefix}${dateStr}.csv`;
}

/** Click handler helper: triggers a browser download of the rows as CSV. Returns false if empty. */
export function handleArbitrationExport(
  records: (ArbitrationExportRow | ArbitrationEscrowDetailsRecord)[],
  filename?: string
): boolean {
  if (!records || records.length === 0) return false;
  const targetFilename = filename ?? arbitrationExportFilename();
  const csvContent = buildArbitrationCsv(records);
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = targetFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
