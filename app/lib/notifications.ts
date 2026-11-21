/**
 * notifications — what the navbar bell shows for the connected wallet (#839).
 *
 * Two sources, both real:
 *  - pending actions derived from the wallet's jobs (`needs_action.ts`):
 *    deliveries awaiting the client's review, milestones to deliver,
 *    claimable auto-releases, disputes awaiting the arbiter, unfunded jobs;
 *  - recent on-chain events on those jobs (`GET /api/jobs/:id/history`).
 *
 * Read state is persisted per wallet in local storage (with the in-memory
 * fallback from `safe_storage`), keyed by a stable notification id, so a
 * dismissed item stays read across reloads and a new one shows as unread.
 */
import type { NotificationItem } from "@/app/components/NotificationBell";
import type { Job } from "@/app/lib/api_schemas";
import { BACKEND_URL } from "@/app/lib/transactions";
import {
  NEEDS_ACTION_LABELS,
  type NeedsActionItem,
  type NeedsActionKind,
} from "@/app/lib/needs_action";
import { getSafeStorage } from "@/app/lib/safe_storage";

/** One event from `GET /api/jobs/:contractId/history`. */
export interface JobHistoryEvent {
  id?: number;
  event_type: string;
  ledger_sequence: number;
  timestamp: number | null;
  tx_hash?: string | null;
}

const ACTION_TYPE: Record<NeedsActionKind, NonNullable<NotificationItem["type"]>> = {
  fund: "info",
  review_delivery: "warning",
  deliver: "info",
  claim_auto_release: "success",
  resolve_dispute: "error",
};

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function jobName(jobId: string, jobs: ReadonlyMap<string, Job>): string {
  const title = (jobs.get(jobId) as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : `Job ${shortId(jobId)}`;
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Bell item for one pending action. The id embeds the action, so it is stable. */
export function notificationFromAction(
  item: NeedsActionItem,
  jobs: ReadonlyMap<string, Job> = new Map()
): NotificationItem {
  const where =
    item.milestoneIndex === null
      ? jobName(item.jobId, jobs)
      : `Milestone ${item.milestoneIndex + 1} of ${jobName(item.jobId, jobs)}`;
  return {
    id: `action:${item.key}`,
    title: NEEDS_ACTION_LABELS[item.kind],
    message: `${where}. Open the dashboard to act on it.`,
    timestamp: item.deadlineMs !== null ? `Due ${formatTime(item.deadlineMs)}` : "Action needed",
    read: false,
    type: ACTION_TYPE[item.kind],
  };
}

/** "milestone_released" → "Milestone released". */
export function humanizeEventType(eventType: string): string {
  const words = eventType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : "Contract event";
}

/** Bell item for one job history event, id keyed by job and ledger/event id. */
export function notificationFromHistoryEvent(
  jobId: string,
  event: JobHistoryEvent,
  jobs: ReadonlyMap<string, Job> = new Map()
): NotificationItem {
  const eventKey = event.id ?? `${event.ledger_sequence}:${event.event_type}`;
  return {
    id: `history:${jobId}:${eventKey}`,
    title: humanizeEventType(event.event_type),
    message: `${jobName(jobId, jobs)} · ledger ${event.ledger_sequence}`,
    // Seconds from the indexer; milliseconds from some older payloads.
    timestamp:
      event.timestamp !== null
        ? formatTime(event.timestamp < 1e12 ? event.timestamp * 1000 : event.timestamp)
        : "",
    read: false,
    type: "info",
  };
}

/**
 * Pending actions first (they need the wallet), then history newest first,
 * with each item's `read` taken from `readIds`.
 */
export function buildNotifications({
  actions,
  history,
  jobs = [],
  readIds,
}: {
  actions: readonly NeedsActionItem[];
  history: readonly { jobId: string; events: readonly JobHistoryEvent[] }[];
  jobs?: readonly Job[];
  readIds: ReadonlySet<string>;
}): NotificationItem[] {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const historyItems = history
    .flatMap(({ jobId, events }) => events.map((event) => ({ jobId, event })))
    .sort((a, b) => b.event.ledger_sequence - a.event.ledger_sequence)
    .map(({ jobId, event }) => notificationFromHistoryEvent(jobId, event, byId));

  const seen = new Set<string>();
  return [...actions.map((item) => notificationFromAction(item, byId)), ...historyItems]
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .map((item) => ({ ...item, read: readIds.has(item.id) }));
}

export function countUnread(items: readonly NotificationItem[]): number {
  return items.reduce((n, item) => n + (item.read ? 0 : 1), 0);
}

// =============================================================================
// Read state
// =============================================================================

/** Cap on remembered ids per wallet so storage cannot grow without bound. */
export const MAX_READ_IDS = 500;

export function readStateKey(address: string): string {
  return `milestone.notifications.read.${address}`;
}

/** Ids the wallet has read. Corrupt or missing storage reads as "none read". */
export function loadReadIds(address: string, storage: Storage = getSafeStorage()): Set<string> {
  try {
    const raw = storage.getItem(readStateKey(address));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

/** Persists the most recent {@link MAX_READ_IDS} read ids. */
export function saveReadIds(
  address: string,
  ids: Iterable<string>,
  storage: Storage = getSafeStorage()
): void {
  const list = [...ids].slice(-MAX_READ_IDS);
  try {
    storage.setItem(readStateKey(address), JSON.stringify(list));
  } catch {
    // Quota or private mode: read state just won't survive a reload.
  }
}

/** `readIds` plus `ids`, persisted; returns the new set. */
export function markNotificationsRead(
  address: string,
  readIds: ReadonlySet<string>,
  ids: Iterable<string>,
  storage: Storage = getSafeStorage()
): Set<string> {
  const next = new Set(readIds);
  for (const id of ids) {
    next.delete(id); // re-insert so it counts as most recent for the cap
    next.add(id);
  }
  saveReadIds(address, next, storage);
  return next;
}

// =============================================================================
// History loading
// =============================================================================

/** Jobs whose history is shown, and events per job: keeps the bell cheap. */
export const HISTORY_JOB_LIMIT = 5;
export const HISTORY_EVENTS_PER_JOB = 3;

/**
 * Latest events for one job, newest first. Returns [] when the history can't
 * be read: the bell still shows pending actions.
 */
export async function fetchRecentJobHistory(
  jobId: string,
  { signal, limit = HISTORY_EVENTS_PER_JOB }: { signal?: AbortSignal; limit?: number } = {}
): Promise<JobHistoryEvent[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}/history?page=1&limit=${limit}&order=desc`,
      { signal }
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { success?: boolean; events?: unknown; order?: string };
    if (body.success === false || !Array.isArray(body.events)) return [];
    const events = body.events.filter(
      (e): e is JobHistoryEvent =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as JobHistoryEvent).event_type === "string" &&
        typeof (e as JobHistoryEvent).ledger_sequence === "number"
    );
    // A legacy backend ignores order=desc and returns oldest first.
    const newestFirst = [...events].sort((a, b) => b.ledger_sequence - a.ledger_sequence);
    return newestFirst.slice(0, limit);
  } catch (err) {
    if (signal?.aborted) throw err;
    return [];
  }
}
