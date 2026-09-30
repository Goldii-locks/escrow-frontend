/**
 * arbitration_escrow_details — loading skeleton descriptors (#481).
 * Placeholder wireframe elements shown on arbitration_escrow_details while loading data.
 */

export interface ArbitrationSkeletonFrame {
  id: string;
  kind: "header" | "badge" | "grid-cell" | "action-bar";
  width: string;
  height: string;
}

export const ARBITRATION_SKELETON_FRAMES: readonly ArbitrationSkeletonFrame[] =
  [
    { id: "header-title", kind: "header", width: "200px", height: "24px" },
    { id: "header-badge", kind: "badge", width: "100px", height: "20px" },
    { id: "cell-1", kind: "grid-cell", width: "100%", height: "48px" },
    { id: "cell-2", kind: "grid-cell", width: "100%", height: "48px" },
    { id: "cell-3", kind: "grid-cell", width: "100%", height: "48px" },
    { id: "cell-4", kind: "grid-cell", width: "100%", height: "48px" },
    { id: "cell-5", kind: "grid-cell", width: "100%", height: "48px" },
    { id: "cell-6", kind: "grid-cell", width: "100%", height: "48px" },
    {
      id: "action-button",
      kind: "action-bar",
      width: "140px",
      height: "38px",
    },
  ];

/** Returns skeleton frames when loading is active; returns empty array when complete. */
export function getArbitrationSkeleton(
  isLoading: boolean,
): readonly ArbitrationSkeletonFrame[] {
  return isLoading ? ARBITRATION_SKELETON_FRAMES : [];
}

export const ARBITRATION_SKELETON_ARIA = {
  role: "status",
  "aria-busy": true,
  "aria-label": "Loading locked escrow details",
} as const;
