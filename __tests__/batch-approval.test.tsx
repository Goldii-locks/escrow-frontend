import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  MAX_BATCH_APPROVALS,
  buildApproveMilestonesArgs,
  getBatchApprovalCandidates,
  getBatchApprovalTotal,
  pruneBatchSelection,
  shouldOfferBatchApproval,
  toggleBatchSelection,
  validateBatchSelection,
} from "@/app/lib/batch_approval";
import BatchApproveModal from "@/app/components/BatchApproveModal";
import MilestoneCard from "@/app/components/MilestoneCard";

const CLIENT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const milestones = [
  { index: 0, amount: "10000000", status: "Released" },
  { index: 1, amount: "20000000", status: "Delivered" },
  { index: 2, amount: "30000000", status: "Delivered" },
  { index: 3, amount: "40000000", status: "Delivered", releasedAmount: "0" },
  { index: 4, amount: "50000000", status: "Pending" },
];

describe("batch approval selection (#899)", () => {
  it("only offers delivered milestones", () => {
    expect(getBatchApprovalCandidates(milestones).map((m) => m.index)).toEqual([1, 2, 3]);
  });

  it("is offered with two or more delivered milestones", () => {
    expect(shouldOfferBatchApproval(milestones)).toBe(true);
    expect(shouldOfferBatchApproval(milestones.slice(0, 2))).toBe(false);
    expect(shouldOfferBatchApproval(null)).toBe(false);
  });

  it("toggles indices and keeps them sorted", () => {
    let selection: number[] = [];
    selection = toggleBatchSelection(selection, 3, true);
    selection = toggleBatchSelection(selection, 1, true);
    selection = toggleBatchSelection(selection, 2, true);
    expect(selection).toEqual([1, 2, 3]);
    selection = toggleBatchSelection(selection, 2, false);
    expect(selection).toEqual([1, 3]);
    // Selecting twice does not duplicate.
    expect(toggleBatchSelection(selection, 1, true)).toEqual([1, 3]);
  });

  it("refuses to select more than the contract's cap", () => {
    const full = Array.from({ length: MAX_BATCH_APPROVALS }, (_, i) => i);
    expect(toggleBatchSelection(full, 99, true)).toEqual(full);
  });

  it("drops indices that are no longer delivered", () => {
    expect(pruneBatchSelection([0, 1, 3, 4], milestones)).toEqual([1, 3]);
  });

  it("totals what each milestone still holds", () => {
    expect(getBatchApprovalTotal([1, 2, 3], milestones)).toBe(BigInt(90_000_000));
    expect(
      getBatchApprovalTotal(
        [0],
        [{ index: 0, amount: "100", status: "Delivered", releasedAmount: "40" }]
      )
    ).toBe(BigInt(60));
    expect(getBatchApprovalTotal([7], milestones)).toBeNull();
  });

  it("validates the selection", () => {
    expect(validateBatchSelection([])).toMatch(/at least one/);
    expect(validateBatchSelection([1, 1])).toMatch(/twice/);
    expect(validateBatchSelection(Array.from({ length: 11 }, (_, i) => i))).toMatch(/at most 10/);
    expect(validateBatchSelection([1, 2, 3])).toBeNull();
  });

  it("builds approve_milestones(client, Vec<u32>) arguments", () => {
    expect(buildApproveMilestonesArgs(CLIENT, [3, 1, 2])).toEqual([
      { type: "address", value: CLIENT },
      {
        type: "vec",
        value: [
          { type: "u32", value: "1" },
          { type: "u32", value: "2" },
          { type: "u32", value: "3" },
        ],
      },
    ]);
  });
});

describe("BatchApproveModal (#899)", () => {
  it("lists each milestone and the total, and confirms", () => {
    const onConfirm = vi.fn();
    render(
      <BatchApproveModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        milestones={milestones.slice(1, 4)}
        totalStroops="90000000"
        decimals={7}
        symbol="XLM"
      />
    );
    const items = screen.getAllByTestId("batch-approve-modal-item");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Milestone 2");
    expect(items[0]).toHaveTextContent("2 XLM");
    expect(screen.getByTestId("batch-approve-modal-total")).toHaveTextContent("9 XLM");
    fireEvent.click(screen.getByTestId("batch-approve-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("MilestoneCard batch checkbox (#899)", () => {
  const baseProps = {
    isClient: true,
    isFreelancer: false,
    partialReleaseState: { phase: "idle" as const, error: null, txHash: null },
    claimAutoReleaseState: { phase: "idle" as const, error: null, txHash: null },
    isPartialReleasePending: false,
    isClaimAutoReleasePending: false,
  };

  it("shows a checkbox on a delivered milestone for the client and reports changes", () => {
    const onSelectChange = vi.fn();
    render(
      <MilestoneCard
        {...baseProps}
        milestone={milestones[1]}
        selectable
        selected={false}
        onSelectChange={onSelectChange}
      />
    );
    fireEvent.click(screen.getByTestId("milestone-batch-select"));
    expect(onSelectChange).toHaveBeenCalledWith(1, true);
  });

  it("shows no checkbox when batch approval is off or the milestone isn't delivered", () => {
    const { rerender } = render(<MilestoneCard {...baseProps} milestone={milestones[1]} />);
    expect(screen.queryByTestId("milestone-batch-select")).not.toBeInTheDocument();
    rerender(<MilestoneCard {...baseProps} milestone={milestones[4]} selectable />);
    expect(screen.queryByTestId("milestone-batch-select")).not.toBeInTheDocument();
  });
});
