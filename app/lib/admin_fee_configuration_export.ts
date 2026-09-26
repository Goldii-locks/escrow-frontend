/**
 * admin_fee_configuration — client-side export helpers for fee table views (#467).
 */

export interface FeeConfigRow {
  token: string;
  feeBps: number;
  state: string;
  updatedAt?: string;
}

export const FEE_EXPORT_HEADERS = ["Token", "Fee (bps)", "Fee (%)", "State", "Updated At"];

/** Escape a CSV cell; also neutralises spreadsheet formula injection. */
export function escapeCsvCell(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function feeRowsToCsv(rows: FeeConfigRow[]): string {
  const lines = [FEE_EXPORT_HEADERS.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.token, r.feeBps, (r.feeBps / 100).toFixed(2), r.state, r.updatedAt ?? ""]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function feeExportFilename(date: Date = new Date()): string {
  return `admin-fee-configuration-${date.toISOString().slice(0, 10)}.csv`;
}

/** Click handler helper: triggers a browser download of the rows as CSV. */
export function downloadFeeConfigCsv(rows: FeeConfigRow[], filename = feeExportFilename()): void {
  const blob = new Blob([feeRowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
