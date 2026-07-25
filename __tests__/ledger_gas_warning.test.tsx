import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LedgerGasWarningBanner from "@/app/components/LedgerGasWarningBanner";
import { HIGH_FEE_THRESHOLD_STROOPS } from "@/app/lib/ledger_usb_bridge";

describe("LedgerGasWarningBanner (#150)", () => {
  it("renders a warning when fee exceeds standard bounds", () => {
    render(
      <LedgerGasWarningBanner
        simulation={{ fee: HIGH_FEE_THRESHOLD_STROOPS + 1 }}
      />
    );

    const banner = screen.getByTestId("ledger-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
  });

  it("renders a warning when simulation reports an error", () => {
    render(
      <LedgerGasWarningBanner
        simulation={{ fee: 100, error: "HostError: trap" }}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/simulation failed/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/HostError: trap/);
  });

  it("does not render when fee is within bounds", () => {
    const { container } = render(
      <LedgerGasWarningBanner simulation={{ fee: 100 }} />
    );

    expect(
      screen.queryByTestId("ledger-gas-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when simulation is null", () => {
    const { container } = render(
      <LedgerGasWarningBanner simulation={null} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
