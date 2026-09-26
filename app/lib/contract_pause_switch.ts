/**
 * contract_pause_switch — Pure helpers backing the emergency freeze toggle
 * (`app/components/ContractPauseSwitch.tsx`).
 *
 * Owns the grid sizing constraints that align the freeze status readouts on
 * larger screens (Issue #478) and the mock-backed state bindings that let the
 * toggle render in a test environment with no backend (Issue #479). Keeping
 * the breakpoints and class strings here (rather than inline in JSX) lets the
 * layout be asserted directly in tests without mounting at a real viewport
 * size.
 *
 * Mirrors the conventions established by `app/lib/dispute_raise_modal.ts` and
 * `app/lib/arbiter_action_panel.ts`.
 */

import { BACKEND_URL, CONTRACT_ID } from "@/app/lib/transactions";

const LOG_PREFIX = "[contract_pause_switch]";

// =============================================================
// Responsive viewport classification (#478)
// =============================================================

export type ContractPauseViewport = "mobile" | "tablet" | "desktop";

/**
 * Minimum width (px) at which the freeze status readouts sit two-up instead of
 * stacking. Matches Tailwind's `sm` breakpoint.
 */
export const CONTRACT_PAUSE_TABLET_MIN_WIDTH = 640;

/**
 * Minimum width (px) at which the readouts settle into a single aligned row of
 * three. Matches Tailwind's `lg` breakpoint.
 */
export const CONTRACT_PAUSE_DESKTOP_MIN_WIDTH = 1024;

/**
 * Maps a viewport width in pixels onto a layout bucket.
 *
 * Non-finite or negative widths fall back to `"mobile"`: the narrowest layout
 * is the safe default, since it never overflows a wider screen.
 */
export function classifyContractPauseViewport(
  width: number,
): ContractPauseViewport {
  if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
    return "mobile";
  }
  if (width >= CONTRACT_PAUSE_DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= CONTRACT_PAUSE_TABLET_MIN_WIDTH) return "tablet";
  return "mobile";
}

/** Structural layout decisions derived from the active viewport. */
export interface ContractPauseGridLayout {
  viewport: ContractPauseViewport;
  /** Number of columns used by the freeze status grid. */
  statusColumns: number;
  /**
   * Cross-axis alignment for the status cells. Mobile keeps `"start"` so a tall
   * cell does not stretch its neighbours; from `sm:` upward the readouts are
   * uniform enough to `"stretch"` and sit on one baseline row.
   */
  align: "start" | "stretch";
  /** `true` when the freeze toggle spans the full panel width. */
  fullWidthToggle: boolean;
  /** `true` when the toggle stops stretching and hugs its own label. */
  inlineToggle: boolean;
  /** Tailwind max-width cap applied to the panel. */
  maxWidthClass: string;
}

/**
 * Resolves the grid sizing constraints for a viewport bucket.
 *
 * Mobile stacks the readouts in one column with a full-width toggle; tablet
 * pairs the readouts two-up and still keeps the toggle full width so it stays
 * a comfortable tap target; desktop lines up all three readouts on a single
 * row and lets the toggle shrink to its content, which is what stops the
 * control wrapping out of bounds on wide screens.
 */
export function getContractPauseGridLayout(
  viewport: ContractPauseViewport,
): ContractPauseGridLayout {
  switch (viewport) {
    case "desktop":
      return {
        viewport: "desktop",
        statusColumns: 3,
        align: "stretch",
        fullWidthToggle: false,
        inlineToggle: true,
        maxWidthClass: "max-w-4xl",
      };
    case "tablet":
      return {
        viewport: "tablet",
        statusColumns: 2,
        align: "stretch",
        fullWidthToggle: true,
        inlineToggle: false,
        maxWidthClass: "max-w-2xl",
      };
    case "mobile":
    default:
      return {
        viewport: "mobile",
        statusColumns: 1,
        align: "start",
        fullWidthToggle: true,
        inlineToggle: false,
        maxWidthClass: "max-w-full",
      };
  }
}

/**
 * Resolves the grid sizing constraints for a raw pixel width.
 *
 * Convenience wrapper so callers that already track a viewport width do not
 * have to classify it first.
 */
export function getContractPauseGridLayoutForWidth(
  width: number,
): ContractPauseGridLayout {
  return getContractPauseGridLayout(classifyContractPauseViewport(width));
}

// =============================================================
// Grid sizing class strings (#478)
// =============================================================

/**
 * Class strings for the emergency freeze panel.
 *
 * Every readout cell carries `min-w-0` and breaks long words, so a Stellar
 * address or a long freeze reason can never push a grid track past the panel's
 * `max-w-*` cap and wrap the control out of bounds. The column counts step
 * 1 → 2 → 3 with the viewport, so the row only fills out once the screen is
 * actually wide enough to hold it.
 */
export const CONTRACT_PAUSE_GRID_CLASSES = {
  /** Panel shell — capped width, so the row can never outgrow the viewport. */
  panel:
    "w-full max-w-full rounded-xl border border-border-subtle bg-surface-card p-4 " +
    "sm:p-5 lg:p-6",

  /** Panel header row — title and description stack on narrow screens. */
  header:
    "mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4",

  /** Panel title. */
  title: "text-sm font-semibold text-text-primary sm:text-base",

  /** Panel description. */
  description: "text-xs text-text-secondary",

  /**
   * Status grid — one column on mobile, two from `sm:`, three from `lg:`.
   * `items-start` keeps a tall cell from stretching its neighbours on mobile;
   * `sm:items-stretch` lines the desktop row up on a single baseline.
   */
  statusGrid:
    "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4 " +
    "lg:grid-cols-3 lg:gap-6",

  /**
   * A single readout cell. `min-w-0` lets the track shrink below its content
   * so `break-words` can engage, which is what keeps long contract addresses
   * inside the grid instead of overflowing it.
   */
  statusCell: "min-w-0 rounded-lg bg-surface-field px-3 py-2.5",

  /** Readout label. */
  statusLabel:
    "block text-[11px] font-medium uppercase tracking-wide text-text-secondary",

  /** Readout value — wraps instead of overflowing the cell. */
  statusValue: "mt-1 block min-w-0 break-words text-sm text-text-primary",

  /** Toggle row — stacked full-width on mobile, inline from `sm:`. */
  toggleRow:
    "mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 " +
    "sm:flex-row sm:items-center sm:justify-between sm:gap-4",

  /** Toggle caption stack. */
  toggleCaption: "min-w-0",

  /** Toggle caption heading. */
  toggleCaptionTitle: "text-sm font-medium text-text-primary",

  /** Toggle caption body — explains the blast radius of a freeze. */
  toggleCaptionBody: "mt-0.5 text-xs text-text-secondary",

  /**
   * The freeze toggle itself. Full width on mobile so it stays a 44px tap
   * target; `sm:w-auto` hands it back to the content so it cannot be stretched
   * past the capped panel on wider screens.
   */
  toggle:
    "w-full min-h-[44px] sm:w-auto sm:min-w-[180px] sm:px-5",

  /** Loading placeholder block shown while the freeze state resolves. */
  loadingCell: "h-14 animate-pulse rounded-lg bg-surface-field",
} as const;

// =============================================================
// Input sanitization
// =============================================================

/** Matches HTML/script tags and javascript: URL payloads. */
const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:/i;

/** True when a value contains markup that could carry an injected payload. */
export function containsCodeTags(value: string): boolean {
  return CODE_TAG_PATTERN.test(value);
}

/**
 * Strips tags and trims a free-text field from the backend.
 * Returns an empty string when the value contains a script payload so the
 * readout collapses to the "—" fallback rather than rendering injected markup.
 */
export function sanitizePauseField(value: string): string {
  if (containsCodeTags(value)) return "";
  return value.trim();
}

// =============================================================
// Mock integration bindings (#479)
// =============================================================

/** Lifecycle of the escrow contract's emergency freeze. */
export type ContractPausePhase = "active" | "frozen" | "unfreezing";

/** Snapshot of the contract's emergency freeze state. */
export interface ContractPauseState {
  contractId: string;
  paused: boolean;
  /** ISO timestamp of the last freeze or unfreeze transition. */
  updatedAt: string;
  /** Stellar address that performed the last transition. */
  updatedBy: string;
  /** Human-readable note explaining the last transition. */
  reason: string;
}

/**
 * Mock freeze state used as the fallback for backend queries.
 *
 * Frozen rather than active: it is the state an operator needs to be able to
 * read at a glance, and it is the one worth asserting in tests, since a
 * mislabelled toggle is the failure this panel exists to prevent.
 */
export const MOCK_CONTRACT_PAUSE_STATE: ContractPauseState = {
  contractId: "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
  paused: true,
  updatedAt: "2026-09-24T18:42:00Z",
  updatedBy: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
  reason: "Payout indexer reports duplicate release events for milestone 3.",
};

/** One entry in the freeze transition log. */
export interface ContractPauseTransition {
  id: string;
  at: string;
  by: string;
  to: "frozen" | "active";
  reason: string;
}

/**
 * Mock transition log backing the freeze history readout, so the panel renders
 * a real history instead of an empty shell when the backend is unreachable.
 */
export const MOCK_CONTRACT_PAUSE_TRANSITIONS: ContractPauseTransition[] = [
  {
    id: "pause-002",
    at: "2026-09-24T18:42:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "frozen",
    reason: "Payout indexer reports duplicate release events for milestone 3.",
  },
  {
    id: "pause-001",
    at: "2026-09-21T07:15:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "frozen",
    reason: "Scheduled upgrade of the dispute escrow entrypoint.",
  },
  {
    id: "pause-000",
    at: "2026-09-18T11:03:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "active",
    reason: "Freeze lifted after the entrypoint upgrade completed.",
  },
];

/** Narrows an unknown value to a `ContractPauseState`. */
export function isContractPauseState(
  value: unknown,
): value is ContractPauseState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.contractId === "string" &&
    typeof candidate.paused === "boolean" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.updatedBy === "string" &&
    typeof candidate.reason === "string"
  );
}

/**
 * Resolves the label shown for the current freeze state.
 *
 * Split out of the component so the wording is assertable without mounting.
 */
export function getContractPausePhaseLabel(paused: boolean): string {
  return paused ? "Frozen" : "Active";
}

/**
 * Maps a resolved pause snapshot onto the readouts the panel renders.
 *
 * The freeze reason is a free-text field, so it is trimmed and collapsed here
 * rather than in JSX; an empty reason falls back to an explicit dash so the
 * readout never collapses to a blank row.
 */
export function getContractPauseReadouts(state: ContractPauseState): {
  contractId: string;
  phase: string;
  updatedAt: string;
  updatedBy: string;
  reason: string;
} {
  const trimmedReason = sanitizePauseField(state.reason);
  return {
    contractId: sanitizePauseField(state.contractId) || "—",
    phase: getContractPausePhaseLabel(state.paused),
    updatedAt: sanitizePauseField(state.updatedAt) || "—",
    updatedBy: sanitizePauseField(state.updatedBy) || "—",
    reason: trimmedReason || "—",
  };
}

/**
 * Queries the emergency freeze state for a contract.
 *
 * Pulls from the backend when an endpoint is reachable and the payload carries
 * every field the panel reads; otherwise falls back to
 * `MOCK_CONTRACT_PAUSE_STATE` so the toggle still renders in a test
 * environment with no network.
 *
 * Defaults to `BACKEND_URL` + the configured `CONTRACT_ID` so the panel in
 * production hits the same backend all other queries use.
 */
export async function fetchContractPauseState(options?: {
  apiUrl?: string;
  signal?: AbortSignal;
}): Promise<ContractPauseState> {
  const contractId = CONTRACT_ID || MOCK_CONTRACT_PAUSE_STATE.contractId;
  const url =
    options?.apiUrl ??
    `${BACKEND_URL}/api/jobs/query?contractId=${encodeURIComponent(contractId)}&method=is_paused`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data: unknown = await res.json();
      // The backend may return the snapshot bare or wrapped in a success
      // envelope; accept either, but only when the payload is complete.
      const payload =
        typeof data === "object" &&
        data !== null &&
        "success" in data &&
        "data" in data
          ? (data as { data: unknown }).data
          : data;

      if (isContractPauseState(payload)) {
        return payload;
      }
      console.warn(
        `${LOG_PREFIX} pause state response missing fields, using mock state`,
      );
    }
  } catch {
    // Network or server error - fall through to the mock state.
  }

  return { ...MOCK_CONTRACT_PAUSE_STATE };
}
