"use client";

import { useEffect, useState } from "react";
import { fetchArbiterQueue, type ArbiterQueueItem } from "@/app/lib/arbiter_queue";

/** Loads the connected wallet's arbiter queue; `items` is null while loading. */
export function useArbiterQueue(address: string | null): {
  items: ArbiterQueueItem[] | null;
  error: boolean;
} {
  const [state, setState] = useState<{
    key: string | null;
    items: ArbiterQueueItem[] | null;
    error: boolean;
  }>({ key: null, items: null, error: false });

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    fetchArbiterQueue(address, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setState({ key: address, items, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key: address, items: [], error: true });
      });
    return () => controller.abort();
  }, [address]);

  return state.key === address ? state : { items: null, error: false };
}
