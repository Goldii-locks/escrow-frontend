/**
 * escrow_lock_state — Pure helpers for the paused / cancel-locked banner (#896).
 *
 * Three contract states make most entry points reject with Paused (13) or
 * EscrowLocked (16):
 *
 *  - `pausedByAdmin`      – admin called `admin_pause_escrow`.
 *  - `pausedByEmergency`  – both parties agreed to an emergency pause.
 *  - `cancelLocked`       – mutual cancel agreed; waiting for admin to settle.
 *
 * This module classifies the state, produces the user-facing banner message,
 * and decides which action buttons should be disabled. No React dependency so
 * it can be tested without a DOM environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All three lock flags the job view reads from the contract or backend. */
export interface EscrowLockFlags {
  pausedByAdmin?: boolean;
  pausedByEmergency?: boolean;
  cancelLocked?: boolean;
}

/**
 * Classified lock state.
 *
 * - `none`             – escrow is live; no banner, no disabled buttons.
 * - `admin_pause`      – admin paused the escrow.
 * - `emergency_pause`  – both parties agreed to an emergency pause.
 * - `cancel_locked`    – mutual cancel agreed; admin will settle.
 */
export type EscrowLockKind = "none" | "admin_pause" | "emergency_pause" | "cancel_locked";

export interface EscrowLockState {
  kind: EscrowLockKind;
  /** Banner message shown to the user. Empty string when kind === "none". */
  message: string;
  /** Tooltip shown on disabled action buttons. Empty string when kind === "none". */
  tooltip: string;
  /** True when any action buttons should be disabled. */
  actionsDisabled: boolean;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Derives the most specific lock state from the three boolean flags.
 *
 * Priority: cancel_locked > admin_pause > emergency_pause > none.
 * (Cancel-lock is the most restrictive: neither party can take any action.)
 */
export function classifyEscrowLock(flags: EscrowLockFlags): EscrowLockKind {
  if (flags.cancelLocked) return "cancel_locked";
  if (flags.pausedByAdmin) return "admin_pause";
  if (flags.pausedByEmergency) return "emergency_pause";
  return "none";
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const LOCK_MESSAGES: Record<EscrowLockKind, { message: string; tooltip: string }> = {
  none: { message: "", tooltip: "" },
  admin_pause: {
    message: "Paused by the platform admin. Actions will be available once the admin unpauses.",
    tooltip: "This escrow is paused by the platform admin.",
  },
  emergency_pause: {
    message:
      "Emergency-paused by both parties. Actions will be available once both parties agree to resume.",
    tooltip: "This escrow is emergency-paused.",
  },
  cancel_locked: {
    message: "Cancellation agreed by both parties. Waiting for the admin to settle the escrow.",
    tooltip: "This escrow is cancel-locked. No actions are available.",
  },
};

/**
 * Resolves the full lock state (kind + message + tooltip + actionsDisabled)
 * from the three boolean flags.
 */
export function getEscrowLockState(flags: EscrowLockFlags): EscrowLockState {
  const kind = classifyEscrowLock(flags);
  const { message, tooltip } = LOCK_MESSAGES[kind];
  return { kind, message, tooltip, actionsDisabled: kind !== "none" };
}
