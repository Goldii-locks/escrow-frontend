// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Review from "@/app/(app)/create/steps/Review";
import type { CreateJobForm } from "@/app/(app)/create/useCreateJobForm";

function makeForm(review: Record<string, unknown>): CreateJobForm {
  return {
    loading: false,
    setActiveSection: vi.fn(),
    review: {
      assetCount: 1,
      requirementCount: 1,
      milestoneCount: 2,
      autoReleaseDays: "7",
      arbiter: "",
      agreed: true,
      setAgreed: vi.fn(),
      balance: null,
      balanceLoading: false,
      totalRequired: null,
      tokenDecimals: 7,
      tokenSymbol: "USDC",
      insufficientBalance: false,
      ...review,
    },
  } as unknown as CreateJobForm;
}

describe("create Review balance display (issue #845)", () => {
  it("shows the client's balance and the escrow total", () => {
    const form = makeForm({
      balance: "500000000",
      totalRequired: "400000000",
      insufficientBalance: false,
    });
    render(<Review form={form} />);

    expect(screen.getByTestId("review-balance")).toHaveTextContent(
      "Balance: 50 USDC. Total escrow: 40 USDC"
    );
    expect(screen.queryByTestId("review-balance-warning")).not.toBeInTheDocument();
  });

  it("warns when the client cannot cover the escrow total", () => {
    const form = makeForm({
      balance: "100000000",
      totalRequired: "400000000",
      insufficientBalance: true,
    });
    render(<Review form={form} />);

    expect(screen.getByTestId("review-balance-warning")).toHaveTextContent(
      "Insufficient balance: you have 10 USDC, need 40 USDC"
    );
  });

  it("shows a checking state while the balance loads", () => {
    render(<Review form={makeForm({ balanceLoading: true })} />);
    expect(screen.getByTestId("review-balance")).toHaveTextContent("Checking token balance…");
  });
});
