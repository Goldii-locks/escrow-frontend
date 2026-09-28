/**
 * admin_fee_configuration — loading skeleton descriptors (#461).
 * Placeholder wireframe frames shown while fee data queries run.
 */

export interface FeeConfigSkeletonFrame {
  id: string;
  kind: "title" | "label" | "input" | "button";
  width: string;
  height: string;
}

export const FEE_CONFIG_SKELETON_FRAMES: readonly FeeConfigSkeletonFrame[] = [
  { id: "title", kind: "title", width: "40%", height: "24px" },
  { id: "fee-rate-label", kind: "label", width: "25%", height: "14px" },
  { id: "fee-rate-input", kind: "input", width: "100%", height: "40px" },
  { id: "fee-recipient-label", kind: "label", width: "30%", height: "14px" },
  { id: "fee-recipient-input", kind: "input", width: "100%", height: "40px" },
  { id: "submit", kind: "button", width: "120px", height: "40px" },
];

/** Returns the frames to render, or an empty list once loading has finished. */
export function getFeeConfigSkeleton(isLoading: boolean): readonly FeeConfigSkeletonFrame[] {
  return isLoading ? FEE_CONFIG_SKELETON_FRAMES : [];
}

export const FEE_CONFIG_SKELETON_ARIA = { role: "status", "aria-busy": true, "aria-label": "Loading fee configuration" } as const;
