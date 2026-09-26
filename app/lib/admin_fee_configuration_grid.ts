/**
 * admin_fee_configuration - Grid layout sizing constraints for the system
 * transaction fees update form (Issue #468).
 *
 * Pure helpers so the layout can be asserted without mounting at a real
 * viewport size.
 */

export type FeeConfigViewport = "mobile" | "tablet" | "desktop";

/** Minimum width (px) for the two-column form grid (Tailwind `sm`). */
export const FEE_CONFIG_TABLET_MIN_WIDTH = 640;

/** Minimum width (px) for the three-column aligned form grid (Tailwind `lg`). */
export const FEE_CONFIG_DESKTOP_MIN_WIDTH = 1024;

/** Maximum content width (px) of the form container. */
export const FEE_CONFIG_MAX_WIDTH = 1152;

/** Non-finite or negative widths fall back to the safe narrow layout. */
export function getFeeConfigViewport(width: number): FeeConfigViewport {
  if (!Number.isFinite(width) || width < FEE_CONFIG_TABLET_MIN_WIDTH) {
    return "mobile";
  }
  return width < FEE_CONFIG_DESKTOP_MIN_WIDTH ? "tablet" : "desktop";
}

/** Number of grid columns for a viewport. */
export function getFeeConfigColumns(viewport: FeeConfigViewport): 1 | 2 | 3 {
  return viewport === "desktop" ? 3 : viewport === "tablet" ? 2 : 1;
}

/** Tailwind class string for the form grid container. */
export const FEE_CONFIG_GRID_CLASS =
  "grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** Tailwind class for grid children; `min-w-0` stops content overflowing its track. */
export const FEE_CONFIG_GRID_ITEM_CLASS = "min-w-0";

/** Tailwind class for a field spanning the whole row. */
export const FEE_CONFIG_GRID_FULL_ROW_CLASS = "col-span-full";

/** Column-span class for an item so it never exceeds the available columns. */
export function getFeeConfigSpanClass(span: number, columns: 1 | 2 | 3): string {
  const safe = Number.isFinite(span) ? Math.min(Math.max(Math.floor(span), 1), columns) : 1;
  return `col-span-${safe}`;
}

/** Width (px) of each column given the container width and gap. */
export function getFeeConfigColumnWidth(containerWidth: number, gap = 16): number {
  const viewport = getFeeConfigViewport(containerWidth);
  const columns = getFeeConfigColumns(viewport);
  const usable = Math.min(Math.max(containerWidth, 0), FEE_CONFIG_MAX_WIDTH);
  return Math.floor((usable - gap * (columns - 1)) / columns);
}
