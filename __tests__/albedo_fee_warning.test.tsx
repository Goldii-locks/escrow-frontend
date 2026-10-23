// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AlbedoFeeWarningBar from "@/app/components/AlbedoFeeWarningBar";
import { DEFAULT_FEE_LIMIT_STROOPS } from "@/app/lib/albedo_connector";

describe("AlbedoFeeWarningBar", () => {
  // -------------------------------------------------------------------------
  // Visibility rules
  // -------------------------------------------------------------------------

  it("renders a warning bar when the estimated fee exceeds the default limit", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: DEFAULT_FEE_LIMIT_STROOPS + 1 }}
      />
    );

    const bar = screen.getByTestId("albedo-fee-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/High fee detected/i);
  });

  it("does not render when fee is within the default limit", () => {
    const { container } = render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: DEFAULT_FEE_LIMIT_STROOPS }}
      />
    );

    expect(
      screen.queryByTestId("albedo-fee-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when simulation has no fee data", () => {
    const { container } = render(<AlbedoFeeWarningBar simulation={{}} />);

    expect(
      screen.queryByTestId("albedo-fee-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  // -------------------------------------------------------------------------
  // Content assertions
  // -------------------------------------------------------------------------

  it("displays the estimated fee in stroops and XLM in the banner", () => {
    render(
      <AlbedoFeeWarningBar simulation={{ minResourceFee: 2_000_000 }} />
    );

    const bar = screen.getByTestId("albedo-fee-warning-bar");
    expect(bar).toHaveTextContent(/2000000 stroops/);
    expect(bar).toHaveTextContent(/XLM/);
  });

  it("tells the user to review before signing", () => {
    render(
      <AlbedoFeeWarningBar simulation={{ minResourceFee: 5_000_000 }} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Review the transaction before signing/i
    );
  });

  it("renders when the fee comes from the classic fee field", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ fee: String(DEFAULT_FEE_LIMIT_STROOPS + 200) }}
      />
    );

    expect(screen.getByTestId("albedo-fee-warning-bar")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Custom fee limit
  // -------------------------------------------------------------------------

  it("respects a custom feeLimitStroops prop — hides when under limit", () => {
    const { container } = render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: 200_000 }}
        feeLimitStroops={250_000}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("respects a custom feeLimitStroops prop — shows when over limit", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: 300_000 }}
        feeLimitStroops={250_000}
      />
    );

    expect(screen.getByTestId("albedo-fee-warning-bar")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/High fee detected/i);
  });

  it("with a very low custom limit, triggers warning for a small fee", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: 1_000 }}
        feeLimitStroops={500}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  it("has role=alert for screen reader accessibility", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: DEFAULT_FEE_LIMIT_STROOPS + 1 }}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("accepts and applies an additional className", () => {
    render(
      <AlbedoFeeWarningBar
        simulation={{ minResourceFee: DEFAULT_FEE_LIMIT_STROOPS + 1 }}
        className="mt-4"
      />
    );

    const bar = screen.getByTestId("albedo-fee-warning-bar");
    expect(bar.className).toContain("mt-4");
  });
});
