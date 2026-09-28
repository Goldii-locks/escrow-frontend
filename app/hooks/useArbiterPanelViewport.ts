"use client";

import { useSyncExternalStore } from "react";
import {
  classifyArbiterPanelViewport,
  readArbiterPanelViewportWidth,
  type ArbiterPanelViewport,
} from "@/app/lib/arbiter_action_panel";

function subscribeToViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
  };
}

function getViewportSnapshot(): ArbiterPanelViewport {
  return classifyArbiterPanelViewport(readArbiterPanelViewportWidth());
}

/** Server render has no viewport, so start from the mobile-first layout. */
function getServerViewportSnapshot(): ArbiterPanelViewport {
  return "mobile";
}

/**
 * Tracks the active viewport bucket for the arbiter action panel.
 *
 * Visual sizing comes from Tailwind's responsive variants; this hook only
 * reports the bucket so the panel can expose its structural layout (see
 * `useDisputeViewport` for the rationale behind `useSyncExternalStore`).
 */
export function useArbiterPanelViewport(): ArbiterPanelViewport {
  return useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getServerViewportSnapshot,
  );
}

export default useArbiterPanelViewport;
