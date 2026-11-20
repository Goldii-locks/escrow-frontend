import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  arbiterFeeFor,
  formatFeeBps,
  getArbiterResolutionBreakdown,
  isValidArbiterFeeBps,
} from "@/app/lib/arbiter_fee";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";

describe("arbiterFeeFor (#900) — matches the contract's arbiter_fee_for", () => {
  it("is remaining * bps / 10_000, rounded down", () => {
    expect(arbiterFeeFor(BigInt(1_000_000), 250)).toBe(BigInt(25_000));
    // 999 * 250 / 10_000 = 24.975 → 24
    expect(arbiterFeeFor(BigInt(999), 250)).toBe(BigInt(24));
    // 39 * 250 / 10_000 = 0.975 → 0
    expect(arbiterFeeFor(BigInt(39), 250)).toBe(BigInt(0));
    // 1 bps of 9_999 = 0.9999 → 0
    expect(arbiterFeeFor(BigInt(9_999), 1)).toBe(BigInt(0));
    expect(arbiterFeeFor(BigInt(10_000), 1)).toBe(BigInt(1));
  });

  it("is zero when the fee is zero", () => {
    expect(arbiterFeeFor(BigInt(123_456_789), 0)).toBe(BigInt(0));
  });

  it("supports the contract's 10% maximum", () => {
    expect(arbiterFeeFor(BigInt(300_000_000), 1_000)).toBe(BigInt(30_000_000));
  });

  it("is capped to the available balance", () => {
    expect(arbiterFeeFor(BigInt(1_000_000), 1_000, BigInt(50_000))).toBe(BigInt(50_000));
    expect(arbiterFeeFor(BigInt(1_000_000), 1_000, BigInt(500_000))).toBe(BigInt(100_000));
  });

  it("stays exact beyond Number.MAX_SAFE_INTEGER", () => {
    const remaining = BigInt("170141183460469231731687303715884105");
    expect(arbiterFeeFor(remaining, 333)).toBe((remaining * BigInt(333)) / BigInt(10_000));
  });

  it("rejects a rate the contract would never store", () => {
    expect(() => arbiterFeeFor(BigInt(1), 1_001)).toThrow(RangeError);
    expect(() => arbiterFeeFor(BigInt(1), -1)).toThrow(RangeError);
    expect(isValidArbiterFeeBps(2.5)).toBe(false);
  });
});

describe("getArbiterResolutionBreakdown (#900)", () => {
  it("returns remaining, fee and payout = remaining - fee", () => {
    expect(
      getArbiterResolutionBreakdown({ amount: "1000000", releasedAmount: "200000", feeBps: 250 })
    ).toEqual({
      remaining: BigInt(800_000),
      fee: BigInt(20_000),
      payout: BigInt(780_000),
      feeBps: 250,
    });
  });

  it("pays the whole remainder when there is no fee", () => {
    expect(getArbiterResolutionBreakdown({ amount: "500", feeBps: 0 })).toEqual({
      remaining: BigInt(500),
      fee: BigInt(0),
      payout: BigInt(500),
      feeBps: 0,
    });
  });

  it("leaves fee and payout unknown when the rate is unknown", () => {
    expect(getArbiterResolutionBreakdown({ amount: "500", feeBps: null })).toEqual({
      remaining: BigInt(500),
      fee: null,
      payout: null,
      feeBps: null,
    });
  });

  it("returns null for unparseable amounts", () => {
    expect(getArbiterResolutionBreakdown({ amount: "abc", feeBps: 100 })).toBeNull();
  });

  it("formats bps as a percentage", () => {
    expect(formatFeeBps(250)).toBe("2.5%");
    expect(formatFeeBps(1_000)).toBe("10%");
    expect(formatFeeBps(1)).toBe("0.01%");
  });
});

describe("ArbiterActionPanel fee breakdown (#900)", () => {
  const breakdown = {
    remaining: BigInt(10_000_000),
    fee: BigInt(250_000),
    payout: BigInt(9_750_000),
    feeBps: 250,
  };

  it("shows the remaining amount, the fee and the payout", () => {
    render(
      <ArbiterActionPanel
        milestoneIndex={0}
        escrowAmount="10000000"
        onResolve={vi.fn()}
        feeBreakdown={breakdown}
        amountDecimals={7}
        amountSymbol="USDC"
      />
    );
    expect(screen.getByTestId("arbiter-fee-remaining")).toHaveTextContent("1 USDC");
    expect(screen.getByTestId("arbiter-fee-amount")).toHaveTextContent("0.025 USDC");
    expect(screen.getByTestId("arbiter-fee-breakdown")).toHaveTextContent("Arbiter fee (2.5%)");
    expect(screen.getByTestId("arbiter-fee-payout")).toHaveTextContent("0.975 USDC");
  });

  it("names the chosen side and repeats the numbers in the confirmation", () => {
    render(
      <ArbiterActionPanel
        milestoneIndex={0}
        escrowAmount="10000000"
        onResolve={vi.fn()}
        feeBreakdown={breakdown}
        amountDecimals={7}
        amountSymbol="USDC"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /refund to client/i }));
    expect(screen.getByTestId("arbiter-fee-breakdown")).toHaveTextContent("Client receives");
    expect(screen.getByTestId("arbiter-confirm-label")).toHaveTextContent(
      "0.975 USDC goes to the client and 0.025 USDC to the arbiter"
    );

    fireEvent.click(screen.getByRole("radio", { name: /release to freelancer/i }));
    expect(screen.getByTestId("arbiter-fee-breakdown")).toHaveTextContent("Freelancer receives");
    expect(screen.getByTestId("arbiter-confirm-label")).toHaveTextContent(
      "0.975 USDC goes to the freelancer"
    );
  });

  it("says the fee is unknown instead of guessing", () => {
    render(
      <ArbiterActionPanel
        milestoneIndex={0}
        onResolve={vi.fn()}
        feeBreakdown={{ remaining: BigInt(10_000_000), fee: null, payout: null, feeBps: null }}
      />
    );
    expect(screen.getByTestId("arbiter-fee-amount")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("arbiter-fee-payout")).toHaveTextContent("Unknown");
  });

  it("renders no breakdown when none is given", () => {
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    expect(screen.queryByTestId("arbiter-fee-breakdown")).not.toBeInTheDocument();
  });
});
