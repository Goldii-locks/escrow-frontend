/**
 * contract_pause_switch - Loading skeleton wireframe for the emergency freeze
 * toggle (Issue #471). Describes placeholder frames shown while the pause
 * state is being fetched.
 */

export type ContractPauseSkeletonKind = "title" | "status" | "toggle" | "meta";

export interface ContractPauseSkeletonBlock {
  key: string;
  kind: ContractPauseSkeletonKind;
  className: string;
}

export const CONTRACT_PAUSE_SKELETON_LABEL = "Loading contract pause status";

export const CONTRACT_PAUSE_SKELETON_BASE_CLASS = "animate-pulse rounded bg-gray-200 dark:bg-gray-700";

/** Placeholder frames mirroring the real layout: title, status, toggle, meta rows. */
export const CONTRACT_PAUSE_SKELETON_BLOCKS: readonly ContractPauseSkeletonBlock[] = [
  { key: "title", kind: "title", className: `${CONTRACT_PAUSE_SKELETON_BASE_CLASS} h-6 w-1/3` },
  { key: "status", kind: "status", className: `${CONTRACT_PAUSE_SKELETON_BASE_CLASS} h-4 w-2/3` },
  { key: "toggle", kind: "toggle", className: `${CONTRACT_PAUSE_SKELETON_BASE_CLASS} h-10 w-32` },
  { key: "meta", kind: "meta", className: `${CONTRACT_PAUSE_SKELETON_BASE_CLASS} h-3 w-1/2` },
];

/** Whether the skeleton should be shown for the current load state. */
export function shouldShowContractPauseSkeleton(state: {
  isLoading: boolean;
  hasData: boolean;
}): boolean {
  return state.isLoading && !state.hasData;
}

/** Accessibility attributes for the skeleton container. */
export function getContractPauseSkeletonA11y(): {
  role: "status";
  "aria-busy": true;
  "aria-label": string;
} {
  return { role: "status", "aria-busy": true, "aria-label": CONTRACT_PAUSE_SKELETON_LABEL };
}
