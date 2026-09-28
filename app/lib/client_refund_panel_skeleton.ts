/**
 * client_refund_panel — loading skeleton descriptors (#501).
 * Placeholder wireframe frames shown on client_refund_panel while loading data.
 */

export interface ClientRefundSkeletonFrame {
  id: string;
  kind: "title" | "badge" | "form-field" | "button" | "list-item";
  width: string;
  height: string;
}

export const CLIENT_REFUND_SKELETON_FRAMES: readonly ClientRefundSkeletonFrame[] =
  [
    { id: "title", kind: "title", width: "180px", height: "24px" },
    { id: "badge", kind: "badge", width: "90px", height: "20px" },
    { id: "amount-field", kind: "form-field", width: "100%", height: "40px" },
    { id: "reason-field", kind: "form-field", width: "100%", height: "80px" },
    { id: "submit-button", kind: "button", width: "160px", height: "38px" },
    { id: "list-item-1", kind: "list-item", width: "100%", height: "56px" },
    { id: "list-item-2", kind: "list-item", width: "100%", height: "56px" },
  ];

/** Returns skeleton frames when loading is active; returns empty array when complete. */
export function getClientRefundSkeleton(
  isLoading: boolean,
): readonly ClientRefundSkeletonFrame[] {
  return isLoading ? CLIENT_REFUND_SKELETON_FRAMES : [];
}

export const CLIENT_REFUND_SKELETON_ARIA = {
  role: "status",
  "aria-busy": true,
  "aria-label": "Loading client refund panel",
} as const;
