/**
 * arbitrator_evidence_list — Pure helpers and data services backing the
 * arbitrator evidence list view (`app/components/ArbitratorEvidenceList.tsx`).
 *
 * Implements:
 * - Access control checking for arbiters (Issue #420)
 * - Loading placeholder structures (Issue #421)
 * - User input sanitization against code/script tags (Issue #422)
 * - Dynamic data queries and API bindings with mock fallbacks (Issue #423)
 */

export interface EvidenceItem {
  id: string;
  disputeId: string;
  submittedBy: string;
  submitterRole: "client" | "freelancer";
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  fileSize: number; // in bytes
  uploadedAt: string;
  hash: string;
  verified: boolean;
}

export const UNAUTHORIZED_ARBITRATOR_WARNING =
  "Access Restricted: Only authorized arbiters assigned to this dispute can review submitted evidence.";

/**
 * Checks whether the given wallet address is authorized as an arbiter for this dispute.
 * Returns true if the address matches any of the designated arbitrator addresses.
 */
export function isArbitratorAuthorized(
  walletAddress: string | null | undefined,
  authorizedArbitrators?: string[]
): boolean {
  if (!walletAddress || typeof walletAddress !== "string") return false;
  const trimmed = walletAddress.trim().toLowerCase();
  if (!trimmed) return false;

  if (!authorizedArbitrators || authorizedArbitrators.length === 0) {
    // If no explicit whitelist is supplied, require non-empty address
    return true;
  }

  return authorizedArbitrators.some(
    (arb) => arb.trim().toLowerCase() === trimmed
  );
}

/**
 * Strips script tags, code tags, and dangerous executable syntax from user input.
 * If input contains <code>...</code> or <script>...</script>, removes them completely.
 */
export function sanitizeEvidenceInput(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input;
  // Strip <script> tags and contents
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Strip <code> tags and contents to ignore embedded script/payload code
  cleaned = cleaned.replace(/<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi, "");
  // Strip any remaining html tags
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");

  return cleaned.trim();
}

/**
 * Mock evidence dataset used as fallback for backend queries.
 */
export const MOCK_EVIDENCE_DATASET: EvidenceItem[] = [
  {
    id: "evi-001",
    disputeId: "disp-101",
    submittedBy: "GCKF7J3...CLIENT",
    submitterRole: "client",
    title: "Project Scope Specification v1.2",
    description: "Initial signed agreement detailing the milestone deliverables and acceptance criteria.",
    fileUrl: "/evidence/scope_v1.pdf",
    fileType: "application/pdf",
    fileSize: 245760,
    uploadedAt: "2026-09-20T10:15:00Z",
    hash: "0x8fa4c379a12b...b3f4",
    verified: true,
  },
  {
    id: "evi-002",
    disputeId: "disp-101",
    submittedBy: "GAX4K9L...FREELANCER",
    submitterRole: "freelancer",
    title: "Production Deployment Logs & Commit Proof",
    description: "Server access logs and repository commit history demonstrating milestone completion.",
    fileUrl: "/evidence/deploy_logs.txt",
    fileType: "text/plain",
    fileSize: 104857,
    uploadedAt: "2026-09-21T14:30:00Z",
    hash: "0x91c834a812df...c189",
    verified: true,
  },
  {
    id: "evi-003",
    disputeId: "disp-101",
    submittedBy: "GCKF7J3...CLIENT",
    submitterRole: "client",
    title: "Bug Reports and Non-Responsive Test Cases",
    description: "Automated QA test suite failures showing that the API endpoint returns 500 on valid inputs.",
    fileUrl: "/evidence/qa_failures.json",
    fileType: "application/json",
    fileSize: 52428,
    uploadedAt: "2026-09-22T09:00:00Z",
    hash: "0x4b78912ea55c...e890",
    verified: false,
  },
];

/**
 * Queries evidence records dynamically for a given dispute ID.
 * Pulls from the backend API if available, falling back to mock datasets.
 */
export async function fetchArbitratorEvidence(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal }
): Promise<EvidenceItem[]> {
  const url = options?.apiUrl || `/api/disputes/${encodeURIComponent(disputeId)}/evidence`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // Network or server error - fallback to mock dataset
  }

  // Filter mock dataset by dispute ID or return default items
  const matched = MOCK_EVIDENCE_DATASET.filter((item) => item.disputeId === disputeId);
  return matched.length > 0 ? matched : MOCK_EVIDENCE_DATASET;
}

/* ------------------------------------------------------------------ *
 * Issue #424 — State badges
 * ------------------------------------------------------------------ */

/** Distinct review states an evidence row can be rendered in. */
export type EvidenceState = "verified" | "pending" | "unverified";

export interface EvidenceBadgeDescriptor {
  /** Visible badge text. */
  label: string;
  /** Tailwind classes giving each state its own colour treatment. */
  className: string;
  /** Screen-reader description of what the colour conveys. */
  srLabel: string;
}

/**
 * Colour and copy for each state. Kept as data (rather than branching in
 * JSX) so the component stays declarative and tests can assert on the
 * mapping directly.
 */
export const EVIDENCE_STATE_BADGES: Record<EvidenceState, EvidenceBadgeDescriptor> = {
  verified: {
    label: "Verified",
    className: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    srLabel: "Evidence verified by an arbiter",
  },
  pending: {
    label: "Pending Review",
    className: "bg-amber-900/50 text-amber-300 border-amber-700",
    srLabel: "Evidence awaiting arbiter review",
  },
  unverified: {
    label: "Integrity Unverified",
    className: "bg-red-900/50 text-red-300 border-red-700",
    srLabel: "Evidence is missing a content hash and cannot be integrity checked",
  },
};

/**
 * Resolves the active state of an evidence item.
 *
 * A blank or missing hash outranks `verified`: without a hash the file's
 * integrity cannot be confirmed, so it is surfaced as `unverified` even if
 * the record carries a stale verification flag.
 */
export function getEvidenceState(item: EvidenceItem): EvidenceState {
  if (!item.hash || item.hash.trim() === "") return "unverified";
  return item.verified ? "verified" : "pending";
}

/** Convenience wrapper returning the badge descriptor for an item. */
export function getEvidenceBadge(item: EvidenceItem): EvidenceBadgeDescriptor {
  return EVIDENCE_STATE_BADGES[getEvidenceState(item)];
}

/* ------------------------------------------------------------------ *
 * Issue #427 — Spreadsheet export
 * ------------------------------------------------------------------ */

const EVIDENCE_CSV_HEADER = [
  "Evidence ID",
  "Dispute ID",
  "Title",
  "Description",
  "Submitted By",
  "Role",
  "File Type",
  "File Size (KB)",
  "Uploaded At",
  "Hash",
  "Status",
];

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function escapeEvidenceCsvCell(value: string | number): string {
  let cell = String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Format evidence rows as CSV text (CRLF rows, header included). */
export function buildEvidenceCsv(items: EvidenceItem[]): string {
  const body = items.map((item) => [
    item.id,
    item.disputeId,
    item.title,
    item.description,
    item.submittedBy,
    item.submitterRole,
    item.fileType,
    (item.fileSize / 1024).toFixed(1),
    item.uploadedAt,
    item.hash,
    EVIDENCE_STATE_BADGES[getEvidenceState(item)].label,
  ]);

  return [EVIDENCE_CSV_HEADER, ...body]
    .map((row) => row.map(escapeEvidenceCsvCell).join(","))
    .join("\r\n");
}

/** Timestamped filename, e.g. `evidence-disp-101-2026-09-28.csv`. */
export function evidenceExportFilename(disputeId: string, now: Date = new Date()): string {
  const safeId = disputeId.replace(/[^a-zA-Z0-9-_]/g, "") || "dispute";
  return `evidence-${safeId}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Export button handler: triggers a client-side CSV download. Returns false when empty. */
export function handleEvidenceExport(
  items: EvidenceItem[],
  filename: string = evidenceExportFilename("dispute"),
): boolean {
  if (items.length === 0) return false;
  // Leading BOM so Excel reads the UTF-8 payload correctly.
  const blob = new Blob([`\ufeff${buildEvidenceCsv(items)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/* ------------------------------------------------------------------ *
 * Issue #425 — Validation modals
 * ------------------------------------------------------------------ */

/** An arbiter action that must be double-confirmed before it is signed. */
export interface EvidenceAction {
  kind: "verify" | "reject";
  evidenceId: string;
  evidenceTitle: string;
}

export interface EvidenceConfirmCopy {
  title: string;
  description: string;
  acknowledgement: string;
  confirmLabel: string;
}

/**
 * Copy for the double-confirm dialog. Both actions put an on-chain
 * signature behind them, so each spells out that the result is permanent.
 */
export function getEvidenceConfirmCopy(action: EvidenceAction): EvidenceConfirmCopy {
  if (action.kind === "reject") {
    return {
      title: "Reject this evidence?",
      description:
        `You are about to reject "${action.evidenceTitle}". This is recorded on-chain against the dispute and cannot be undone.`,
      acknowledgement:
        "I confirm I have reviewed this evidence and intend to reject it.",
      confirmLabel: "Sign & Reject",
    };
  }

  return {
    title: "Verify this evidence?",
    description:
      `You are about to mark "${action.evidenceTitle}" as verified. This is recorded on-chain against the dispute and cannot be undone.`,
    acknowledgement:
      "I confirm I have reviewed this evidence and attest to its validity.",
    confirmLabel: "Sign & Verify",
  };
}
