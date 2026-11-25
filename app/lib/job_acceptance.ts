/**
 * job_acceptance — the freelancer's and arbiter's job acceptance (#802).
 *
 * An escrow created through the factory requires both the freelancer
 * (`accept_job`) and the arbiter (`accept_arbiter`) to accept the job before
 * `mark_delivered`, `raise_dispute` or `resolve_dispute` are allowed. Until
 * both acceptances are recorded those calls revert with `NotAccepted`
 * (error 43).
 *
 * The contract keeps the two bits in a private `Acceptance` instance entry
 * that `get_escrow_state` does not expose. It does publish a
 * `JobAcceptedEvent { party, acceptance_mask }` under the `acceptjob` and
 * `acceptarb` topics, and the backend already indexes both event types and
 * serves them from `GET /api/jobs/:contractId/history`. Acceptance can only
 * happen in the first days of a job and the event carries the cumulative
 * mask, so the oldest page of the history is enough to rebuild the state.
 */

import { BACKEND_URL } from "@/app/lib/transactions";
import { reportApiResponse } from "@/app/lib/errorReporter";

/** Acceptance bits as stored by the contract (`DataKey::Acceptance`). */
export const FREELANCER_ACCEPTANCE_BIT = 1;
export const ARBITER_ACCEPTANCE_BIT = 2;

/** Topics the contract publishes on acceptance (`symbol_short!` values). */
export const FREELANCER_ACCEPTANCE_EVENT = "acceptjob";
export const ARBITER_ACCEPTANCE_EVENT = "acceptarb";

/**
 * Event count read from the oldest history page. Acceptance is recorded before
 * any delivery can happen, so both events are inside the first few entries;
 * 100 is the backend's maximum page size and keeps this to one request.
 */
export const ACCEPTANCE_SCAN_LIMIT = 100;

export interface JobAcceptance {
  freelancerAccepted: boolean;
  arbiterAccepted: boolean;
}

/** The subset of an indexed history event this module reads. */
export interface AcceptanceEventLike {
  event_type?: unknown;
  data_json?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function maskFromEventData(event: AcceptanceEventLike): number {
  if (typeof event.data_json !== "string") return 0;
  try {
    const data: unknown = JSON.parse(event.data_json);
    if (!isRecord(data)) return 0;
    // The backend's decoded event uses snake_case; older rows may use the
    // contract field name verbatim before decoding.
    const value = data.acceptance_mask ?? data.acceptanceMask;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    // A malformed payload still leaves the event type itself to read.
    return 0;
  }
}

/**
 * Rebuilds the acceptance state from indexed history events. The event type
 * and the cumulative `acceptance_mask` payload are both honoured, so a page
 * that contains either acceptance is enough to know that bit is set.
 */
export function acceptanceFromEvents(events: readonly AcceptanceEventLike[]): JobAcceptance {
  let mask = 0;
  for (const event of events) {
    if (event.event_type === FREELANCER_ACCEPTANCE_EVENT) mask |= FREELANCER_ACCEPTANCE_BIT;
    if (event.event_type === ARBITER_ACCEPTANCE_EVENT) mask |= ARBITER_ACCEPTANCE_BIT;
    mask |= maskFromEventData(event);
  }
  return {
    freelancerAccepted: (mask & FREELANCER_ACCEPTANCE_BIT) !== 0,
    arbiterAccepted: (mask & ARBITER_ACCEPTANCE_BIT) !== 0,
  };
}

/**
 * Acceptance never moves backwards on-chain, so a later read can only add
 * bits. Merging keeps a successful acceptance visible while the indexer (or
 * the history cache) is still catching up.
 */
export function mergeAcceptance(
  previous: JobAcceptance | null | undefined,
  next: JobAcceptance | null
): JobAcceptance | null {
  if (!previous) return next;
  if (!next) return previous;
  return {
    freelancerAccepted: previous.freelancerAccepted || next.freelancerAccepted,
    arbiterAccepted: previous.arbiterAccepted || next.arbiterAccepted,
  };
}

/** True once both parties have accepted; the contract's `require_accepted`. */
export function isJobAccepted(acceptance: JobAcceptance | null | undefined): boolean {
  return !!acceptance && acceptance.freelancerAccepted && acceptance.arbiterAccepted;
}

/**
 * Why delivery and dispute actions are blocked, or `null` when they are not.
 * `null` acceptance means the state could not be read: callers must not block
 * on it, or a backend hiccup would make an accepted job undeliverable.
 */
export function acceptanceBlockedMessage(
  acceptance: JobAcceptance | null | undefined
): string | null {
  if (!acceptance) return null;
  if (isJobAccepted(acceptance)) return null;
  if (!acceptance.freelancerAccepted && !acceptance.arbiterAccepted) {
    return "Waiting for the freelancer and the arbiter to accept";
  }
  if (!acceptance.arbiterAccepted) return "Waiting for the arbiter to accept";
  return "Waiting for the freelancer to accept";
}

/**
 * Reads the acceptance state from the job's indexed history.
 *
 * Returns `null` when the backend is unreachable or answers with an
 * unexpected shape, so the caller can keep the accept buttons available
 * instead of wrongly reporting the job as unaccepted. Aborts are re-thrown so
 * callers can tell intentional cancellation from a failed read.
 */
export async function fetchJobAcceptance(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<JobAcceptance | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}/history?page=1&limit=${ACCEPTANCE_SCAN_LIMIT}`,
      { signal: options?.signal }
    );

    reportApiResponse(res, "/api/jobs/:contractId/history");

    if (!res.ok) return null;

    const payload: unknown = await res.json();
    if (!isRecord(payload) || payload.success === false || !Array.isArray(payload.events)) {
      return null;
    }

    return acceptanceFromEvents(payload.events.filter(isRecord));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}
