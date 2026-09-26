import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  claimErrorToast,
  claimNothingToClaimToast,
  claimSuccessToast,
} from "@/app/lib/freelancer_claim_panel_toasts";
import { handleClaimExport } from "@/app/lib/freelancer_claim_panel_export";
import {
  claimPanelGridItemStyle,
  claimPanelGridStyle,
} from "@/app/lib/freelancer_claim_panel_grid";

const rows = [{ escrowId: "7", amount: "5", token: "USDC", status: "Ready" }];

function MockPanel({ onToast }: { onToast: (t: { message: string; type: string }) => void }) {
  return (
    <section data-testid="panel" style={claimPanelGridStyle}>
      <div data-testid="cell" style={claimPanelGridItemStyle}>
        <button onClick={() => (handleClaimExport([]) ? null : onToast(claimNothingToClaimToast()))}>
          Export
        </button>
        <button onClick={() => onToast(claimSuccessToast("7"))}>Claim</button>
        <button onClick={() => onToast(claimErrorToast("7", "boom"))}>Fail</button>
      </div>
    </section>
  );
}

describe("freelancer_claim_panel mock integration", () => {
  it("renders the grid and cells in the test environment", () => {
    render(<MockPanel onToast={vi.fn()} />);
    expect(screen.getByTestId("panel").style.display).toBe("grid");
    expect(screen.getByTestId("cell")).toBeTruthy();
  });

  it("emits toasts for claim outcomes and empty export", () => {
    const onToast = vi.fn();
    render(<MockPanel onToast={onToast} />);
    fireEvent.click(screen.getByText("Claim"));
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByText("Export"));
    expect(onToast.mock.calls.map((c) => c[0].type)).toEqual(["success", "error", "warning"]);
    expect(rows).toHaveLength(1);
  });
});
