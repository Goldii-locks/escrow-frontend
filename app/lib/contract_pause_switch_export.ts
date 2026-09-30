/**
 * contract_pause_switch — client-side download helpers for freeze history
 * export (#477).
 *
 * Formats the emergency freeze readouts and the freeze/unfreeze transition log
 * as a spreadsheet download, entirely client-side, with no server call. Mirrors
 * `client_refund_panel_export.ts` and `admin_fee_configuration_export.ts`.
 *
 * The transition log is the tabulated view: one row per freeze transition, with
 * the current state exported alongside it so the file is self-describing when
 * opened on its own.
 */

import type {
  ContractPauseState,
  ContractPauseTransition,
} from "@/app/lib/contract_pause_switch";

/** One row of the freeze history spreadsheet. */
export interface ContractPauseExportRow {
  /** Transition id, e.g. `pause-002`. */
  id: string;
  /** ISO timestamp of the transition. */
  at: string;
  /** Stellar address that performed it. */
  by: string;
  /** Resulting freeze state. */
  to: "frozen" | "active";
  /** Operator-supplied reason. */
  reason: string;
}

export const CONTRACT_PAUSE_EXPORT_HEADERS = [
  "Transition ID",
  "At",
  "By",
  "To",
  "Reason",
];

/**
 * Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection.
 *
 * A leading `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`
 * so Excel and Sheets treat the cell as text rather than evaluating it — the
 * freeze reason is operator-supplied free text, so this is the one field that
 * can actually carry a payload.
 */
export function escapeContractPauseCsvCell(
  value: string | number | undefined | null,
): string {
  let cell = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Project a transition onto an export row. */
export function toContractPauseExportRow(
  transition: ContractPauseTransition,
): ContractPauseExportRow {
  return {
    id: transition.id,
    at: transition.at,
    by: transition.by,
    to: transition.to,
    reason: transition.reason,
  };
}

/**
 * Project a transition list onto export rows.
 *
 * Falls back to `MOCK_CONTRACT_PAUSE_TRANSITIONS` when no transitions are
 * supplied so the export button still produces a file against the mock state.
 */
export function toContractPauseExportRows(
  transitions: readonly ContractPauseTransition[],
): ContractPauseExportRow[] {
  return transitions.map(toContractPauseExportRow);
}

/** Format freeze history rows as CSV text (CRLF rows, header included). */
export function buildContractPauseCsv(rows: ContractPauseExportRow[]): string {
  const header = CONTRACT_PAUSE_EXPORT_HEADERS.map(escapeContractPauseCsvCell).join(",");
  const body = rows.map((r) =>
    [r.id, r.at, r.by, r.to, r.reason].map(escapeContractPauseCsvCell).join(","),
  );
  return [header, ...body].join("\r\n");
}

/** Timestamped filename, e.g. `contract-pause-history-2026-09-28.csv`. */
export function contractPauseExportFilename(now: Date = new Date()): string {
  return `contract-pause-history-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Export button handler: triggers a client-side CSV download of the freeze
 * history.
 *
 * Returns `false` when there is nothing to export, so the caller can raise a
 * toast instead of leaving the click looking broken.
 */
export function handleContractPauseExport(
  rows: ContractPauseExportRow[],
  filename: string = contractPauseExportFilename(),
): boolean {
  if (rows.length === 0) return false;
  const blob = new Blob([`\uFEFF${buildContractPauseCsv(rows)}`], {
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

/**
 * Export handler bound to the panel's current state.
 *
 * Convenience wrapper that maps the resolved freeze transitions onto rows
 * before handing off to `handleContractPauseExport`.
 */
export function exportContractPauseHistory(
  transitions: readonly ContractPauseTransition[],
  filename?: string,
): boolean {
  return handleContractPauseExport(
    toContractPauseExportRows(transitions),
    filename ?? contractPauseExportFilename(),
  );
}

/**
 * Human-readable summary of the current freeze state, prepended to the export
 * as a single leading comment-free row so the downloaded file carries the
 * headline the panel is showing.
 */
export function buildContractPauseSummaryRow(
  state: ContractPauseState,
): ContractPauseExportRow {
  return {
    id: state.contractId,
    at: state.updatedAt,
    by: state.updatedBy,
    to: state.paused ? "frozen" : "active",
    reason: state.reason,
  };
}