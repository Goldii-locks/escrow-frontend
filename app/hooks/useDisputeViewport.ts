"use client";

import { useSyncExternalStore } from "react";
import {
  classifyDisputeViewport,
  readViewportWidth,
  type DisputeViewport,
} from "@/app/lib/dispute_raise_modal";

function subscribeToViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
  };
}

function getViewportSnapshot(): DisputeViewport {
  return classifyDisputeViewport(readViewportWidth());
}

/** Server render has no viewport, so start from the mobile-first layout. */
function getServerViewportSnapshot(): DisputeViewport {
  return "mobile";
}

/**
 * Tracks the active viewport bucket for the dispute raise modal.
 *
 * The modal's visual sizing comes from Tailwind's responsive variants; this
 * hook covers the structural decisions CSS cannot express (which layout the
 * panel reports, how many summary columns it advertises).
 *
 * Uses `useSyncExternalStore` rather than an effect + `setState` so the
 * subscription cannot tear during concurrent renders and the first client
 * render already reflects the real width — no cascading re-render on mount.
 * The snapshot is a string primitive, so it compares by value and cannot
 * loop.
 */
export function useDisputeViewport(): DisputeViewport {
  return useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getServerViewportSnapshot,
  );
}

export default useDisputeViewport;
