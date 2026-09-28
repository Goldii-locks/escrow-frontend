import { describe, expect, it } from "vitest";
import {
  CLAIM_PANEL_GRID,
  claimPanelGridItemStyle,
  claimPanelGridStyle,
} from "@/app/lib/freelancer_claim_panel_grid";

describe("freelancer_claim_panel grid constraints", () => {
  it("uses an auto-fit grid bounded by min column and max width", () => {
    expect(claimPanelGridStyle.display).toBe("grid");
    expect(claimPanelGridStyle.gridTemplateColumns).toContain("auto-fit");
    expect(claimPanelGridStyle.gridTemplateColumns).toContain(
      `min(100%, ${CLAIM_PANEL_GRID.columnMin})`,
    );
    expect(claimPanelGridStyle.maxWidth).toBe("72rem");
  });

  it("lets items shrink and wrap inside their cell", () => {
    expect(claimPanelGridItemStyle.minWidth).toBe(0);
    expect(claimPanelGridItemStyle.overflowWrap).toBe("anywhere");
  });
});
