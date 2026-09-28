/**
 * platform_metrics_charts — client-side export helpers (#517).
 */

import type { PlatformMetricsData } from "@/app/lib/platform_metrics_charts_mapping";

export interface ExportRow {
  [key: string]: string | number;
}

export const PLATFORM_METRICS_EXPORT_HEADERS = [
  "ID",
  "Label",
  "Value",
  "Change (%)",
  "Unit",
];

/** Escape a CSV cell; also neutralises spreadsheet formula injection. */
export function escapeCsvCell(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Format PlatformMetricsData into export rows ready for CSV serialisation. */
export function formatMetricsForExport(data: PlatformMetricsData): ExportRow[] {
  return data.metrics.map((m) => ({
    ID: m.id,
    Label: m.label,
    Value: m.value,
    "Change (%)": m.change,
    Unit: m.unit,
  }));
}

/** Convert an array of export rows to a CSV string with \r\n line endings. */
export function convertToCSV(rows: ExportRow[]): string {
  if (rows.length === 0) return PLATFORM_METRICS_EXPORT_HEADERS.map(escapeCsvCell).join(",");

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

/** Build a dated filename for the metrics CSV export. */
export function metricsExportFilename(date: Date = new Date()): string {
  return `platform-metrics-${date.toISOString().slice(0, 10)}.csv`;
}

/** Trigger a browser download of a CSV string. */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: format, serialise, and download metrics data as CSV. */
export function exportPlatformMetrics(
  data: PlatformMetricsData,
  filename = metricsExportFilename(),
): void {
  const rows = formatMetricsForExport(data);
  const csv = convertToCSV(rows);
  downloadCSV(filename, csv);
}
