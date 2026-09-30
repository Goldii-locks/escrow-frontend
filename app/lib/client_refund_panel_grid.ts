/**
 * client_refund_panel — Grid layout sizing constraints (#508).
 *
 * Responsive grid helpers so refund panel elements align correctly on larger
 * screens and never wrap out of bounds. Pure helpers, React-free.
 */

export type RefundPanelViewport = "mobile" | "tablet" | "desktop";

/** Minimum width (px) for the two-column grid (Tailwind `sm`). */
export const REFUND_PANEL_TABLET_MIN_WIDTH = 640;

/** Minimum width (px) for the three-column grid (Tailwind `lg`). */
export const REFUND_PANEL_DESKTOP_MIN_WIDTH = 1024;

/** Maximum content width (px) of the panel container. */
export const REFUND_PANEL_MAX_WIDTH = 1152;

/** Non-finite or negative widths fall back to the safe narrow layout. */
export function getRefundPanelViewport(width: number): RefundPanelViewport {
  if (!Number.isFinite(width) || width < REFUND_PANEL_TABLET_MIN_WIDTH) {
    return "mobile";
  }
  return width < REFUND_PANEL_DESKTOP_MIN_WIDTH ? "tablet" : "desktop";
}

/** Number of grid columns for a viewport. */
export function getRefundPanelColumns(viewport: RefundPanelViewport): 1 | 2 | 3 {
  return viewport === "desktop" ? 3 : viewport === "tablet" ? 2 : 1;
}

/** Tailwind class string for the panel grid container. */
export const REFUND_PANEL_GRID_CLASS =
  "grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** Tailwind class for grid children; `min-w-0` stops content overflowing its track. */
export const REFUND_PANEL_GRID_ITEM_CLASS = "min-w-0";

/** Tailwind class for a field spanning the whole row. */
export const REFUND_PANEL_GRID_FULL_ROW_CLASS = "col-span-full";

/** Column-span class for an item so it never exceeds the available columns. */
export function getRefundPanelSpanClass(span: number, columns: 1 | 2 | 3): string {
  const safe = Number.isFinite(span)
    ? Math.min(Math.max(Math.floor(span), 1), columns)
    : 1;
  return `col-span-${safe}`;
}

/** Width (px) of each column given the container width and gap. */
export function getRefundPanelColumnWidth(containerWidth: number, gap = 16): number {
  const viewport = getRefundPanelViewport(containerWidth);
  const columns = getRefundPanelColumns(viewport);
  const usable = Math.min(Math.max(containerWidth, 0), REFUND_PANEL_MAX_WIDTH);
  return Math.floor((usable - gap * (columns - 1)) / columns);
}

/** Inline style object for the refund panel grid container. */
export const REFUND_PANEL_GRID = {
  maxWidth: "72rem",
  columnMin: "16rem",
  columnMax: "1fr",
  gap: "1rem",
} as const;

/** Inline style for the panel grid: columns never shrink below columnMin and never overflow. */
export const refundPanelGridStyle = {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${REFUND_PANEL_GRID.columnMin}), ${REFUND_PANEL_GRID.columnMax}))`,
  gap: REFUND_PANEL_GRID.gap,
  width: "100%",
  maxWidth: REFUND_PANEL_GRID.maxWidth,
  marginInline: "auto",
  minWidth: 0,
} as const;

/** Style for grid children so long content wraps inside its cell. */
export const refundPanelGridItemStyle = {
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;
