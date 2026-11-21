// @vitest-environment jsdom
/**
 * useWalletNotifications (#839): the navbar bell's data source.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NeedsActionItem } from "@/app/lib/needs_action";

const { mockLoadNeedsActions, mockFetchHistory, storage } = vi.hoisted(() => {
  class Mem {
    private m = new Map<string, string>();
    get length() {
      return this.m.size;
    }
    clear() {
      this.m.clear();
    }
    getItem(k: string) {
      return this.m.get(k) ?? null;
    }
    key(i: number) {
      return [...this.m.keys()][i] ?? null;
    }
    removeItem(k: string) {
      this.m.delete(k);
    }
    setItem(k: string, v: string) {
      this.m.set(k, String(v));
    }
  }
  return {
    mockLoadNeedsActions: vi.fn(),
    mockFetchHistory: vi.fn(),
    storage: new Mem() as unknown as Storage,
  };
});

vi.mock("@/app/lib/needs_action", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/needs_action")>()),
  loadNeedsActions: mockLoadNeedsActions,
}));

vi.mock("@/app/lib/safe_storage", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/safe_storage")>()),
  getSafeStorage: () => storage,
}));

vi.mock("@/app/lib/notifications", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/notifications")>()),
  fetchRecentJobHistory: mockFetchHistory,
}));

import { useWalletNotifications } from "@/app/hooks/useWalletNotifications";

const WALLET = "G" + "W".repeat(55);
const OTHER = "G" + "X".repeat(55);
const JOB_ID = "C" + "J".repeat(55);

const review: NeedsActionItem = {
  key: `${JOB_ID}:0:review_delivery`,
  jobId: JOB_ID,
  milestoneIndex: 0,
  role: "client",
  kind: "review_delivery",
  deadlineMs: null,
};
const dispute: NeedsActionItem = {
  ...review,
  key: `${JOB_ID}:1:resolve_dispute`,
  milestoneIndex: 1,
  role: "arbiter",
  kind: "resolve_dispute",
};

beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  mockLoadNeedsActions.mockResolvedValue({
    items: [review, dispute],
    jobs: [{ id: JOB_ID }],
  });
  mockFetchHistory.mockResolvedValue([
    { id: 9, event_type: "milestone_delivered", ledger_sequence: 42, timestamp: null },
  ]);
});

describe("useWalletNotifications", () => {
  it("is empty and settled with no wallet, and loads nothing", () => {
    const { result } = renderHook(() => useWalletNotifications(null));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(mockLoadNeedsActions).not.toHaveBeenCalled();
  });

  it("derives unread items from the wallet's pending actions and job history", async () => {
    const { result } = renderHook(() => useWalletNotifications(WALLET));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockLoadNeedsActions).toHaveBeenCalledWith(WALLET, expect.anything());
    expect(mockFetchHistory).toHaveBeenCalledWith(JOB_ID, expect.anything());
    expect(result.current.notifications.map((n) => n.title)).toEqual([
      "Review delivery",
      "Resolve dispute",
      "Milestone delivered",
    ]);
    expect(result.current.unreadCount).toBe(3);
  });

  it("persists read state per wallet across remounts", async () => {
    const first = renderHook(() => useWalletNotifications(WALLET));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    act(() => first.result.current.markRead(`action:${review.key}`));
    expect(first.result.current.unreadCount).toBe(2);
    first.unmount();

    const again = renderHook(() => useWalletNotifications(WALLET));
    await waitFor(() => expect(again.result.current.loading).toBe(false));
    expect(again.result.current.unreadCount).toBe(2);
    expect(
      again.result.current.notifications.find((n) => n.id === `action:${review.key}`)?.read
    ).toBe(true);

    // Another wallet's read state is separate.
    const other = renderHook(() => useWalletNotifications(OTHER));
    await waitFor(() => expect(other.result.current.loading).toBe(false));
    expect(other.result.current.unreadCount).toBe(3);
  });

  it("marks everything read", async () => {
    const { result } = renderHook(() => useWalletNotifications(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it("surfaces a load failure instead of an empty bell", async () => {
    mockLoadNeedsActions.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useWalletNotifications(WALLET));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Couldn't load notifications.");
    expect(result.current.notifications).toEqual([]);
  });

  it("reloads on refresh", async () => {
    const { result } = renderHook(() => useWalletNotifications(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(mockLoadNeedsActions).toHaveBeenCalledTimes(2));
  });
});
