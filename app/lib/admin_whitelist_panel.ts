import type { ToastType } from "@/app/context/ToastContext";

/**
 * admin_whitelist_panel — Pure helpers backing the admin token whitelist panel
 * (`app/admin/page.tsx`).
 *
 * Covers input sanitization (#432), mapping backend whitelist payloads to view
 * entries (#433), status badges (#434) and the double-confirm modal copy (#435).
 * Kept free of React so every rule can be asserted directly in tests.
 */

import type { TxPhase } from "@/app/lib/transactions";

// =============================================================
// Input sanitization (#432)
// =============================================================

/** Matches anything that looks like an HTML/script tag or a script URL payload. */
const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:/i;

/** True when the value contains markup that could carry an injected payload. */
export function containsCodeTags(value: string): boolean {
  return CODE_TAG_PATTERN.test(value);
}

/**
 * Sanitize a token contract address typed into the add form.
 *
 * Input containing code tags is ignored outright (returns `""`); otherwise
 * whitespace and every non-alphanumeric character is dropped, since contract
 * addresses are base32 strings.
 */
export function sanitizeTokenAddress(raw: string): string {
  if (containsCodeTags(raw)) return "";
  return raw.replace(/[^A-Za-z0-9]/g, "");
}

/** Strip tags and control characters from free-form backend text (symbol/name). */
export function sanitizeDisplayText(raw: string): string {
  return raw
    .replace(/<[^>]*>?/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

// =============================================================
// Backend data mapping (#433)
// =============================================================

export interface WhitelistEntry {
  address: string;
  symbol?: string;
  name?: string;
}

/**
 * Map a whitelist response body (bare array, `{ data }` or `{ tokens }`, items
 * being address strings or `{ address|token|id, symbol?, name? }` objects) into
 * de-duplicated, sanitized entries. Returns `null` when the body has no list.
 */
export function mapWhitelistResponse(body: unknown): WhitelistEntry[] | null {
  const o = (body ?? {}) as Record<string, unknown>;
  const list = Array.isArray(body)
    ? body
    : Array.isArray(o.data)
      ? o.data
      : Array.isArray(o.tokens)
        ? o.tokens
        : null;
  if (!list) return null;

  const seen = new Set<string>();
  const entries: WhitelistEntry[] = [];
  for (const item of list) {
    const entry = toEntry(item);
    if (!entry || seen.has(entry.address)) continue;
    seen.add(entry.address);
    entries.push(entry);
  }
  return entries;
}

function toEntry(item: unknown): WhitelistEntry | null {
  if (typeof item === "string") {
    const address = sanitizeTokenAddress(item);
    return address ? { address } : null;
  }
  if (!item || typeof item !== "object") return null;

  const o = item as Record<string, unknown>;
  const rawAddress = [o.address, o.token, o.id].find(
    (v): v is string => typeof v === "string",
  );
  const address = rawAddress ? sanitizeTokenAddress(rawAddress) : "";
  if (!address) return null;

  const symbol =
    typeof o.symbol === "string" ? sanitizeDisplayText(o.symbol) : "";
  const name = typeof o.name === "string" ? sanitizeDisplayText(o.name) : "";
  return {
    address,
    ...(symbol ? { symbol } : {}),
    ...(name ? { name } : {}),
  };
}

// =============================================================
// Status badges (#434)
// =============================================================

export type WhitelistStatus =
  | "active"
  | "adding"
  | "removing"
  | "removed"
  | "failed";

export interface StatusBadge {
  status: WhitelistStatus;
  label: string;
  /** Leading marker so state is not conveyed by colour alone. */
  icon: string;
  className: string;
}

const BADGE_BASE =
  "inline-flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium";

export const STATUS_BADGES: Record<WhitelistStatus, StatusBadge> = {
  active: {
    status: "active",
    label: "Active",
    icon: "●",
    className: `${BADGE_BASE} border-green-700 bg-green-950/40 text-green-400`,
  },
  adding: {
    status: "adding",
    label: "Adding",
    icon: "…",
    className: `${BADGE_BASE} border-amber-700 bg-amber-950/40 text-amber-400`,
  },
  removing: {
    status: "removing",
    label: "Removing",
    icon: "…",
    className: `${BADGE_BASE} border-amber-700 bg-amber-950/40 text-amber-400`,
  },
  removed: {
    status: "removed",
    label: "Removed",
    icon: "✓",
    className: `${BADGE_BASE} border-gray-600 bg-gray-800 text-gray-400`,
  },
  failed: {
    status: "failed",
    label: "Failed",
    icon: "!",
    className: `${BADGE_BASE} border-red-700 bg-red-950/40 text-red-400`,
  },
};

/** Badge for a whitelisted token, derived from its remove-transaction state. */
export function getTokenStatusBadge(state: {
  phase: TxPhase;
  error: string | null;
}): StatusBadge {
  switch (state.phase) {
    case "building":
    case "signing":
    case "submitting":
      return STATUS_BADGES.removing;
    case "success":
      return STATUS_BADGES.removed;
    case "error":
      return STATUS_BADGES.failed;
    default:
      return state.error ? STATUS_BADGES.failed : STATUS_BADGES.active;
  }
}

/** Badge for the add-token form, or `null` while idle. */
export function getAddStatusBadge(phase: TxPhase): StatusBadge | null {
  switch (phase) {
    case "building":
    case "signing":
    case "submitting":
      return STATUS_BADGES.adding;
    case "success":
      return STATUS_BADGES.active;
    case "error":
      return STATUS_BADGES.failed;
    default:
      return null;
  }
}

// =============================================================
// Double-confirm modal (#435)
// =============================================================

export type WhitelistAction =
  | { kind: "add"; token: string }
  | { kind: "remove"; token: string };

export interface ConfirmCopy {
  title: string;
  description: string;
  acknowledgement: string;
  confirmLabel: string;
}

export function getConfirmCopy(action: WhitelistAction): ConfirmCopy {
  return action.kind === "add"
    ? {
        title: "Confirm: Add Token",
        description:
          "This will whitelist the token below as an accepted payment token and ask your wallet to sign the transaction.",
        acknowledgement:
          "I have verified this token address and want to sign this transaction.",
        confirmLabel: "Confirm & Sign",
      }
    : {
        title: "Confirm: Remove Token",
        description:
          "This will remove the token below from the whitelist so new escrows can no longer use it. Your wallet will be asked to sign the transaction.",
        acknowledgement:
          "I understand this removes the token and want to sign this transaction.",
        confirmLabel: "Confirm & Sign",
      };
}

// ---------------------------------------------------------------------------
// Toasts and CSV export (#436-#439)
// ---------------------------------------------------------------------------

export interface WhitelistToast {
  message: string;
  type: ToastType;
}

/** Kind of whitelist change, used by the toast helpers. */
export type WhitelistActionKind = "add" | "remove";

/** Shorten a long token address for use in toast copy. */
function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/** Toast shown when a whitelist add/remove transaction succeeds. */
export function whitelistSuccessToast(
  action: WhitelistActionKind,
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
  action: WhitelistActionKind,
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
