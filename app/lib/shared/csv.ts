type CsvCell = string | number | null | undefined;
type CsvRows = readonly (readonly CsvCell[])[];

/** Escape an RFC 4180 cell and neutralise leading spreadsheet formula prefixes. */
export function escapeCsvCell(value: CsvCell): string {
  let cell = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Serialize rows with CRLF line endings. */
export function toCsv(rows: CsvRows): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Download UTF-8 CSV with a BOM so spreadsheet apps can detect the encoding. */
export function downloadCsv(filename: string, rows: CsvRows): void {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
