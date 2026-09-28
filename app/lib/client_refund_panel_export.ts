/**
 * client_refund_panel — client-side download helpers for refund data export (#507).
 *
 * Triggers a browser download without any server call.
 */

export interface RefundExportRow {
  escrowId: string;
  amount: string | number;
  token: string;
  status: string;
  requestedAt?: string;
}

export const REFUND_EXPORT_HEADERS = [
  "Escrow ID",
  "Amount",
  "Token",
  "Status",
  "Requested At",
];

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function escapeRefundCsvCell(value: string | number | undefined | null): string {
  let cell = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Format refund rows as CSV text (CRLF rows, header included). */
export function buildRefundCsv(rows: RefundExportRow[]): string {
  const header = REFUND_EXPORT_HEADERS.map(escapeRefundCsvCell).join(",");
  const body = rows.map((r) =>
    [r.escrowId, r.amount, r.token, r.status, r.requestedAt ?? ""]
      .map(escapeRefundCsvCell)
      .join(","),
  );
  return [header, ...body].join("\r\n");
}

/** Timestamped filename, e.g. `client-refunds-2026-09-28.csv`. */
export function refundExportFilename(now: Date = new Date()): string {
  return `client-refunds-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Export button handler: triggers a client-side CSV download.
 * Returns false when the rows array is empty (no download triggered).
 */
export function handleRefundExport(
  rows: RefundExportRow[],
  filename: string = refundExportFilename(),
): boolean {
  if (rows.length === 0) return false;
  const blob = new Blob([`\uFEFF${buildRefundCsv(rows)}`], {
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
