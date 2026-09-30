/**
 * arbitration_escrow_details — Grid layout sizing constraints (#488).
 *
 * Refactors structure grids on arbitration_escrow_details to align elements on
 * larger screens without elements wrapping out of bounds.
 */

export type ArbitrationViewport = "mobile" | "tablet" | "desktop";

/** Minimum width (px) for the two-column grid (Tailwind `sm`). */
export const ARBITRATION_TABLET_MIN_WIDTH = 640;

/** Minimum width (px) for the three-column grid (Tailwind `lg`). */
export const ARBITRATION_DESKTOP_MIN_WIDTH = 1024;

/** Maximum container width (px). */
export const ARBITRATION_MAX_WIDTH = 1280;

/** Derive viewport from container/window width. Non-finite values fallback to mobile. */
export function getArbitrationViewport(width: number): ArbitrationViewport {
  if (!Number.isFinite(width) || width < ARBITRATION_TABLET_MIN_WIDTH) {
    return "mobile";
  }
  return width < ARBITRATION_DESKTOP_MIN_WIDTH ? "tablet" : "desktop";
}

/** Number of grid columns for viewport. */
export function getArbitrationColumns(
  viewport: ArbitrationViewport,
): 1 | 2 | 3 {
  switch (viewport) {
    case "desktop":
      return 3;
    case "tablet":
      return 2;
    default:
      return 1;
  }
}

/** Tailwind class string for container. */
export const ARBITRATION_GRID_CLASS =
  "grid w-full max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6";

/** Tailwind class for grid item; min-w-0 prevents overflow. */
export const ARBITRATION_GRID_ITEM_CLASS = "min-w-0 break-words";

/** Column span class helper. */
export function getArbitrationSpanClass(
  span: number,
  columns: 1 | 2 | 3,
): string {
  const safe = Number.isFinite(span)
    ? Math.min(Math.max(Math.floor(span), 1), columns)
    : 1;
  return `col-span-${safe}`;
}

/** Compute column width (px) based on container width and gap. */
export function getArbitrationColumnWidth(
  containerWidth: number,
  gap = 16,
): number {
  const viewport = getArbitrationViewport(containerWidth);
  const cols = getArbitrationColumns(viewport);
  const usable = Math.min(Math.max(containerWidth, 0), ARBITRATION_MAX_WIDTH);
  return Math.floor((usable - gap * (cols - 1)) / cols);
}
