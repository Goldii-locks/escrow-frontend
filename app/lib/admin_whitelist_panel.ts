import type { ToastType } from "@/app/context/ToastContext";

export interface WhitelistToast {
  message: string;
  type: ToastType;
}

export type WhitelistAction = "add" | "remove";

/** Shorten a long token address for use in toast copy. */
function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/** Toast shown when a whitelist add/remove transaction succeeds. */
export function whitelistSuccessToast(
  action: WhitelistAction,
  token: string,
): WhitelistToast {
  return {
    type: "success",
    message:
      action === "add"
        ? `Token ${shortAddress(token)} added to the whitelist.`
        : `Token ${shortAddress(token)} removed from the whitelist.`,
  };
}

/** Toast shown when a whitelist add/remove transaction fails. */
export function whitelistErrorToast(
  action: WhitelistAction,
  token: string,
  reason: string,
): WhitelistToast {
  const verb = action === "add" ? "add" : "remove";
  return {
    type: "error",
    message: `Failed to ${verb} token ${shortAddress(token)}: ${reason}`,
  };
}

/** Toast shown when the whitelist itself cannot be loaded. */
export function whitelistLoadErrorToast(reason: string): WhitelistToast {
  return { type: "error", message: reason };
}

/** Toast shown when there is nothing to export. */
export function whitelistExportEmptyToast(): WhitelistToast {
  return { type: "warning", message: "No whitelisted tokens to export." };
}

/** Toast shown once an export has been handed to the browser. */
export function whitelistExportSuccessToast(count: number): WhitelistToast {
  return {
    type: "success",
    message: `Exported ${count} whitelisted token${count === 1 ? "" : "s"}.`,
  };
}

const CSV_HEADER = ["#", "Token Address"];

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
export function escapeCsvCell(value: string | number): string {
  let cell = String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Format the whitelist as CSV text (CRLF rows, header included). */
export function buildWhitelistCsv(tokens: string[]): string {
  const rows = tokens.map((token, i) => [i + 1, token]);
  return [CSV_HEADER, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

/** Timestamped filename, e.g. `whitelisted-tokens-2026-09-25.csv`. */
export function whitelistExportFilename(now: Date = new Date()): string {
  return `whitelisted-tokens-${now.toISOString().slice(0, 10)}.csv`;
}

/** Trigger a client-side CSV download of the whitelist. */
export function downloadWhitelistCsv(
  tokens: string[],
  filename: string = whitelistExportFilename(),
): void {
  const blob = new Blob([`﻿${buildWhitelistCsv(tokens)}`], {
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
}
