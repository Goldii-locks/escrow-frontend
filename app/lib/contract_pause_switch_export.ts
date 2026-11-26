/**
 * contract_pause_switch — client-side download helpers for freeze history
 * export (#477).
 *
 * Formats the emergency freeze readouts and the freeze/unfreeze transition log
 * as a spreadsheet download, entirely client-side, with no server call.
 *
 * The transition log is the tabulated view: one row per freeze transition, with
 * the current state exported alongside it so the file is self-describing when
 * opened on its own.
 */

import type { ContractPauseState, ContractPauseTransition } from "@/app/lib/contract_pause_switch";
import { downloadCsv, toCsv } from "./shared/csv";

export { escapeCsvCell as escapeContractPauseCsvCell } from "./shared/csv";

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

export const CONTRACT_PAUSE_EXPORT_HEADERS = ["Transition ID", "At", "By", "To", "Reason"];

/** Project a transition onto an export row. */
export function toContractPauseExportRow(
  transition: ContractPauseTransition
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
 */
export function toContractPauseExportRows(
  transitions: readonly ContractPauseTransition[]
): ContractPauseExportRow[] {
  return transitions.map(toContractPauseExportRow);
}

function contractPauseCsvRows(rows: ContractPauseExportRow[]): string[][] {
  return [
    CONTRACT_PAUSE_EXPORT_HEADERS,
    ...rows.map(({ id, at, by, to, reason }) => [id, at, by, to, reason]),
  ];
}

/** Format freeze history rows as CSV text (CRLF rows, header included). */
export function buildContractPauseCsv(rows: ContractPauseExportRow[]): string {
  return toCsv(contractPauseCsvRows(rows));
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
  filename: string = contractPauseExportFilename()
): boolean {
  if (rows.length === 0) return false;
  downloadCsv(filename, contractPauseCsvRows(rows));
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
  filename?: string
): boolean {
  return handleContractPauseExport(
    toContractPauseExportRows(transitions),
    filename ?? contractPauseExportFilename()
  );
}

/**
 * Human-readable summary of the current freeze state, prepended to the export
 * as a single leading comment-free row so the downloaded file carries the
 * headline the panel is showing.
 */
export function buildContractPauseSummaryRow(state: ContractPauseState): ContractPauseExportRow {
  return {
    id: state.contractId,
    at: state.updatedAt,
    by: state.updatedBy,
    to: state.paused ? "frozen" : "active",
    reason: state.reason,
  };
}
