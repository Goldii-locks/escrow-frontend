// @vitest-environment jsdom
// Issue #824: partial release takes decimal token amounts (regression of #593).
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneCard from "@/app/components/MilestoneCard";

const idleActionState = {
  phase: "idle" as const,
  error: null,
  txHash: null,
};

const FREELANCER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type Milestone = {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
};

function renderPartialCard({
  milestone,
  amountDecimals = 7,
  amountSymbol = "XLM",
}: {
  milestone: Milestone;
  amountDecimals?: number;
  amountSymbol?: string;
}) {
  const onPartialRelease = vi.fn();
  render(
    <MilestoneCard
      milestone={milestone}
      isClient
      isFreelancer={false}
      freelancerAddress={FREELANCER}
      partialReleaseState={idleActionState}
      claimAutoReleaseState={idleActionState}
      isPartialReleasePending={false}
      isClaimAutoReleasePending={false}
      amountDecimals={amountDecimals}
      amountSymbol={amountSymbol}
      onPartialRelease={onPartialRelease}
    />
  );
  return { onPartialRelease };
}

function submitPartial(value: string) {
  const input = screen.getByTestId("partial-amount-input");
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /release partial amount/i }));
}

function confirmDialog() {
  fireEvent.click(screen.getByRole("button", { name: /release amount/i }));
}

describe("Issue #824: partial release in token units", () => {
  it("passes 1000000000 to onPartialRelease when typing 100 on a 7-decimal token", () => {
    const { onPartialRelease } = renderPartialCard({
      milestone: { index: 0, amount: "5000000000", status: "Delivered" },
      amountDecimals: 7,
      amountSymbol: "USDC",
    });

    submitPartial("100");
    confirmDialog();

    expect(onPartialRelease).toHaveBeenCalledWith(0, "1000000000");
  });

  it("passes 1250 to onPartialRelease when typing 12.5 on a 2-decimal token", () => {
    const { onPartialRelease } = renderPartialCard({
      milestone: { index: 1, amount: "5000", status: "Delivered" },
      amountDecimals: 2,
      amountSymbol: "USDC",
    });

    submitPartial("12.5");
    confirmDialog();

    expect(onPartialRelease).toHaveBeenCalledWith(1, "1250");
  });

  it("never shows the word stroops in the partial release section", () => {
    renderPartialCard({
      milestone: {
        index: 0,
        amount: "1000000000",
        status: "PartiallyReleased",
        releasedAmount: "400000000",
      },
      amountSymbol: "USDC",
    });

    const section = screen.getByTestId("partial-release-section");
    expect(section.textContent).not.toMatch(/stroops/i);
  });

  it("formats 'Released so far' and 'Remaining' in token units with the symbol", () => {
    renderPartialCard({
      milestone: {
        index: 0,
        amount: "1000000000",
        status: "PartiallyReleased",
        releasedAmount: "400000000",
      },
      amountDecimals: 7,
      amountSymbol: "USDC",
    });

    const section = screen.getByTestId("partial-release-section");
    expect(section.textContent).toContain("Released so far:");
    expect(section.textContent).toContain("40 USDC");
    expect(section.textContent).toContain("Remaining:");
    expect(section.textContent).toContain("60 USDC");
  });

  it("shows an error with the formatted remaining balance when the amount exceeds it", () => {
    renderPartialCard({
      milestone: {
        index: 0,
        amount: "1000000000",
        status: "PartiallyReleased",
        releasedAmount: "400000000",
      },
      amountDecimals: 7,
      amountSymbol: "USDC",
    });

    submitPartial("70");

    const error = screen.getByTestId("partial-amount-error");
    expect(error).toHaveTextContent(/60 USDC/);
    expect(error.textContent).not.toMatch(/stroops/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels the input and placeholder with the token symbol, not stroops", () => {
    renderPartialCard({
      milestone: { index: 0, amount: "5000000000", status: "Delivered" },
      amountDecimals: 7,
      amountSymbol: "USDC",
    });

    const input = screen.getByTestId("partial-amount-input");
    expect(input).toHaveAttribute("placeholder", "Amount in USDC");
    expect(input).toHaveAttribute("inputMode", "decimal");
    // Label is sr-only; assert via the hidden label element.
    expect(document.querySelector('label[class*="sr-only"]')?.textContent).toContain(
      "Release amount in USDC"
    );
  });

  it("shows the converted amount in token units in the confirmation modal", () => {
    renderPartialCard({
      milestone: { index: 2, amount: "5000000000", status: "Delivered" },
      amountDecimals: 7,
      amountSymbol: "USDC",
    });

    submitPartial("100");

    expect(screen.getByTestId("release-confirm-modal-amount")).toHaveTextContent("100 USDC");
  });

  it("rejects amounts with more decimals than the token supports", () => {
    renderPartialCard({
      milestone: { index: 0, amount: "5000", status: "Delivered" },
      amountDecimals: 2,
      amountSymbol: "USDC",
    });

    submitPartial("1.234");

    expect(screen.getByTestId("partial-amount-error")).toHaveTextContent(/up to 2 decimal places/);
  });
});
