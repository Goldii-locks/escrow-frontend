/**
 * arbitration_escrow_details — export data formatting helpers (#487).
 *
 * Client-side download formatting helpers for table views inside the
 * arbitration_escrow_details portal.
 */

import type { ArbitrationEscrowDetailsRecord } from "./arbitration_escrow_details";

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
export function escapeArbitrationCsvCell(
  value: string | number | null | undefined,
): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Convert a record into an export row. */
export function toArbitrationExportRow(
  record: ArbitrationEscrowDetailsRecord,
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
  rows: (ArbitrationExportRow | ArbitrationEscrowDetailsRecord)[],
): string {
  const exportRows = rows.map((r) =>
    "disputeId" in r && "token" in r
      ? toArbitrationExportRow(r as ArbitrationEscrowDetailsRecord)
      : (r as ArbitrationExportRow),
  );

  const lines = [
    ARBITRATION_EXPORT_HEADERS.map(escapeArbitrationCsvCell).join(","),
  ];
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
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** Timestamped filename for dispute escrow export. */
export function arbitrationExportFilename(
  disputeId?: string,
  now: Date = new Date(),
): string {
  const dateStr = now.toISOString().slice(0, 10);
  const idPrefix = disputeId ? `${disputeId}-` : "";
  return `arbitration-escrow-${idPrefix}${dateStr}.csv`;
}

/** Click handler helper: triggers a browser download of the rows as CSV. Returns false if empty. */
export function handleArbitrationExport(
  records: (ArbitrationExportRow | ArbitrationEscrowDetailsRecord)[],
  filename?: string,
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
