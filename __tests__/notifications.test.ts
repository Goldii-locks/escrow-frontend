/**
 * Notification bell data (#839): pending actions + job history → bell items,
 * with read state persisted per wallet.
 */
import { describe, expect, it } from "vitest";
import type { Job } from "@/app/lib/api_schemas";
import { MemoryStorage } from "@/app/lib/safe_storage";
import { deriveNeedsActions, type NeedsActionItem } from "@/app/lib/needs_action";
import {
  buildNotifications,
  countUnread,
  humanizeEventType,
  loadReadIds,
  markNotificationsRead,
  MAX_READ_IDS,
  notificationFromAction,
  readStateKey,
  saveReadIds,
} from "@/app/lib/notifications";

const CLIENT = "G" + "C".repeat(55);
const FREELANCER = "G" + "F".repeat(55);
const ARBITER = "G" + "R".repeat(55);
const JOB_ID = "C" + "J".repeat(55);
const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);

function job(milestones: { index: number; status: string; [k: string]: unknown }[]): Job {
  return {
    id: JOB_ID,
    client: CLIENT,
    freelancer: FREELANCER,
    arbiter: ARBITER,
    funded: true,
    milestones: milestones.map((m) => ({ amount: "100", ...m })),
  } as unknown as Job;
}

const action = (over: Partial<NeedsActionItem> = {}): NeedsActionItem => ({
  key: `${JOB_ID}:0:review_delivery`,
  jobId: JOB_ID,
  milestoneIndex: 0,
  role: "client",
  kind: "review_delivery",
  deadlineMs: null,
  ...over,
});

describe("pending actions become bell items", () => {
  it("derives a review item for the client from a Delivered milestone", () => {
    const actions = deriveNeedsActions([job([{ index: 0, status: "Delivered" }])], CLIENT, {
      now: NOW,
    });
    const items = buildNotifications({ actions, history: [], readIds: new Set() });

    expect(items.map((i) => i.title)).toContain("Review delivery");
    expect(items.every((i) => i.read === false)).toBe(true);
    expect(countUnread(items)).toBe(items.length);
  });

  it("derives a resolve item for the arbiter from a Disputed milestone", () => {
    const actions = deriveNeedsActions([job([{ index: 0, status: "Disputed" }])], ARBITER, {
      now: NOW,
    });
    const items = buildNotifications({ actions, history: [], readIds: new Set() });
    expect(items.map((i) => i.title)).toEqual(["Resolve dispute"]);
  });

  it("derives nothing for a wallet that is not a party to the job", () => {
    const stranger = "G" + "S".repeat(55);
    const actions = deriveNeedsActions([job([{ index: 0, status: "Delivered" }])], stranger, {
      now: NOW,
    });
    expect(buildNotifications({ actions, history: [], readIds: new Set() })).toEqual([]);
  });

  it("names the milestone (1-based) and job, and shows the deadline", () => {
    const item = notificationFromAction(
      action({ kind: "claim_auto_release", milestoneIndex: 2, deadlineMs: NOW })
    );
    expect(item.id).toBe(`action:${JOB_ID}:0:review_delivery`);
    expect(item.title).toBe("Claim auto-release");
    expect(item.message).toMatch(/^Milestone 3 of Job CJJJ…JJJJ/);
    expect(item.timestamp).toBe("Due 2026-11-21 12:00 UTC");
  });
});

describe("history and ordering", () => {
  it("lists actions first, then history newest first, without duplicates", () => {
    const items = buildNotifications({
      actions: [action()],
      history: [
        {
          jobId: JOB_ID,
          events: [
            { id: 1, event_type: "milestone_delivered", ledger_sequence: 10, timestamp: null },
            { id: 2, event_type: "milestone_released", ledger_sequence: 20, timestamp: null },
            { id: 2, event_type: "milestone_released", ledger_sequence: 20, timestamp: null },
          ],
        },
      ],
      readIds: new Set(),
    });

    expect(items.map((i) => i.id)).toEqual([
      `action:${JOB_ID}:0:review_delivery`,
      `history:${JOB_ID}:2`,
      `history:${JOB_ID}:1`,
    ]);
    expect(items[1].title).toBe("Milestone released");
  });

  it("humanizes event types", () => {
    expect(humanizeEventType("milestone_released")).toBe("Milestone released");
    expect(humanizeEventType("DisputeRaised")).toBe("Dispute raised");
    expect(humanizeEventType("")).toBe("Contract event");
  });
});

describe("read state", () => {
  it("applies persisted read ids and counts only unread items", () => {
    const storage = new MemoryStorage();
    saveReadIds(CLIENT, [`action:${JOB_ID}:0:review_delivery`], storage);

    const items = buildNotifications({
      actions: [action(), action({ key: `${JOB_ID}:1:deliver`, kind: "deliver" })],
      history: [],
      readIds: loadReadIds(CLIENT, storage),
    });

    expect(items.map((i) => i.read)).toEqual([true, false]);
    expect(countUnread(items)).toBe(1);
  });

  it("persists marked ids per wallet", () => {
    const storage = new MemoryStorage();
    const next = markNotificationsRead(CLIENT, new Set(), ["a", "b"], storage);

    expect([...next]).toEqual(["a", "b"]);
    expect(loadReadIds(CLIENT, storage)).toEqual(new Set(["a", "b"]));
    expect(loadReadIds(FREELANCER, storage)).toEqual(new Set());
  });

  it("treats corrupt storage as nothing read", () => {
    const storage = new MemoryStorage();
    storage.setItem(readStateKey(CLIENT), "{not json");
    expect(loadReadIds(CLIENT, storage)).toEqual(new Set());
  });

  it("keeps at most MAX_READ_IDS, dropping the oldest", () => {
    const storage = new MemoryStorage();
    const ids = Array.from({ length: MAX_READ_IDS + 5 }, (_, i) => `id-${i}`);
    saveReadIds(CLIENT, ids, storage);

    const kept = loadReadIds(CLIENT, storage);
    expect(kept.size).toBe(MAX_READ_IDS);
    expect(kept.has("id-0")).toBe(false);
    expect(kept.has(`id-${MAX_READ_IDS + 4}`)).toBe(true);
  });
});
