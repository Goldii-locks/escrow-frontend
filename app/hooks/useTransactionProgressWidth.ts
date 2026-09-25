"use client";

import { useSyncExternalStore } from "react";
import { PROGRESS_BAR_DESKTOP_MIN_WIDTH } from "@/app/lib/transaction_progress_bar";

function subscribeToViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
  };
}

function getWidthSnapshot(): number {
  return window.innerWidth;
}

/** Server render has no viewport; assume desktop, matching the component's default. */
function getServerWidthSnapshot(): number {
  return PROGRESS_BAR_DESKTOP_MIN_WIDTH;
}

/**
 * Tracks the viewport width backing the transaction progress bar's layout.
 *
 * Uses `useSyncExternalStore` rather than an effect + `setState` so the first
 * client render already reflects the real width and mounting does not trigger a
 * cascading re-render -- the same rationale as `useDisputeViewport`. The
 * snapshot is a number primitive, so it compares by value and cannot loop.
 */
export function useTransactionProgressWidth(): number {
  return useSyncExternalStore(
    subscribeToViewport,
    getWidthSnapshot,
    getServerWidthSnapshot,
  );
}

export default useTransactionProgressWidth;
