/** Grid layout sizing constraints for freelancer_claim_panel. */
export const CLAIM_PANEL_GRID = {
  maxWidth: "72rem",
  columnMin: "16rem",
  columnMax: "1fr",
  gap: "1rem",
} as const;

/** Inline style for the panel grid: columns never shrink below columnMin and never overflow. */
export const claimPanelGridStyle = {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${CLAIM_PANEL_GRID.columnMin}), ${CLAIM_PANEL_GRID.columnMax}))`,
  gap: CLAIM_PANEL_GRID.gap,
  width: "100%",
  maxWidth: CLAIM_PANEL_GRID.maxWidth,
  marginInline: "auto",
  minWidth: 0,
} as const;

/** Style for grid children so long content wraps inside its cell. */
export const claimPanelGridItemStyle = {
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;
