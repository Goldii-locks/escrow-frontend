export interface ClaimExportRow {
  escrowId: string;
  amount: string | number;
  token: string;
  status: string;
}

const HEADER = ["Escrow ID", "Amount", "Token", "Status"];

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function escapeClaimCsvCell(value: string | number): string {
  let cell = String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Format claim rows as CSV text (CRLF rows, header included). */
export function buildClaimCsv(rows: ClaimExportRow[]): string {
  const body = rows.map((r) => [r.escrowId, r.amount, r.token, r.status]);
  return [HEADER, ...body]
    .map((row) => row.map(escapeClaimCsvCell).join(","))
    .join("\r\n");
}

/** Timestamped filename, e.g. `freelancer-claims-2026-09-25.csv`. */
export function claimExportFilename(now: Date = new Date()): string {
  return `freelancer-claims-${now.toISOString().slice(0, 10)}.csv`;
}

/** Export button handler: triggers a client-side CSV download. Returns false when empty. */
export function handleClaimExport(
  rows: ClaimExportRow[],
  filename: string = claimExportFilename(),
): boolean {
  if (rows.length === 0) return false;
  const blob = new Blob([`﻿${buildClaimCsv(rows)}`], {
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
