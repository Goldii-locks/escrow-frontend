"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NotificationItem } from "@/app/components/NotificationBell";
import type { Job } from "@/app/lib/api_schemas";
import { loadNeedsActions, type NeedsActionItem } from "@/app/lib/needs_action";
import {
  buildNotifications,
  countUnread,
  fetchRecentJobHistory,
  HISTORY_JOB_LIMIT,
  loadReadIds,
  markNotificationsRead,
  type JobHistoryEvent,
} from "@/app/lib/notifications";

interface Loaded {
  address: string;
  actions: NeedsActionItem[];
  jobs: Job[];
  history: { jobId: string; events: JobHistoryEvent[] }[];
  error: string | null;
}

export interface WalletNotifications {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Reloads actions and history, e.g. when the bell is opened. */
  refresh: () => void;
}

/**
 * Actionable notifications for the connected wallet (#839): pending actions
 * from its jobs plus recent history on them, with read state persisted per
 * wallet. Disconnected: an empty, settled list.
 */
export function useWalletNotifications(address: string | null): WalletNotifications {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [readState, setReadState] = useState<{ address: string; ids: Set<string> } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const { items, jobs } = await loadNeedsActions(address, { signal });
        const history = await Promise.all(
          jobs.slice(0, HISTORY_JOB_LIMIT).map(async (job) => ({
            jobId: job.id,
            events: await fetchRecentJobHistory(job.id, { signal }),
          }))
        );
        if (!signal.aborted) setLoaded({ address, actions: items, jobs, history, error: null });
      } catch {
        if (!signal.aborted) {
          setLoaded({
            address,
            actions: [],
            jobs: [],
            history: [],
            error: "Couldn't load notifications.",
          });
        }
      }
    })();

    return () => controller.abort();
  }, [address, reloadKey]);

  // Read ids belong to a wallet; load them lazily for the current one.
  const readIds = useMemo(() => {
    if (!address) return new Set<string>();
    return readState?.address === address ? readState.ids : loadReadIds(address);
  }, [address, readState]);

  const current = address && loaded?.address === address ? loaded : null;

  const notifications = useMemo(
    () =>
      current
        ? buildNotifications({
            actions: current.actions,
            history: current.history,
            jobs: current.jobs,
            readIds,
          })
        : [],
    [current, readIds]
  );

  const markIds = useCallback(
    (ids: string[]) => {
      if (!address || ids.length === 0) return;
      setReadState({ address, ids: markNotificationsRead(address, readIds, ids) });
    },
    [address, readIds]
  );

  return {
    notifications,
    unreadCount: countUnread(notifications),
    loading: Boolean(address) && current === null,
    error: current?.error ?? null,
    markRead: (id) => markIds([id]),
    markAllRead: () => markIds(notifications.filter((n) => !n.read).map((n) => n.id)),
    refresh: () => setReloadKey((k) => k + 1),
  };
}
