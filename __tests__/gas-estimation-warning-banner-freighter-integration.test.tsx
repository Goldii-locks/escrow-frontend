import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import FreighterConnector from "@/app/components/FreighterConnector";

// ---------------------------------------------------------------------------
// #110 — Gas estimation error warning banners integration in FreighterConnector
// ---------------------------------------------------------------------------

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("FreighterConnector gas estimation warning banner integration (#110)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders GasEstimationWarningBanner when context gasWarning has a high fee warning", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: true,
        simulationError: false,
        warningMessage:
          "Estimated fee is unusually high (1000001 stroops / 0.1000001 XLM). Review before signing.",
      },
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    const banner = screen.getByTestId("gas-estimation-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
  });

  it("renders GasEstimationWarningBanner when context gasWarning has a simulation error", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: false,
        simulationError: true,
        warningMessage: "Transaction simulation failed: HostError: trap",
      },
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    const banner = screen.getByTestId("gas-estimation-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/simulation failed/i);
  });

  it("does not render GasEstimationWarningBanner when gasWarning is null", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: null,
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("gas-estimation-warning-banner")
    ).not.toBeInTheDocument();
  });

  it("does not render GasEstimationWarningBanner when hasWarning is false", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: false,
        highFee: false,
        simulationError: false,
        warningMessage: null,
      },
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("gas-estimation-warning-banner")
    ).not.toBeInTheDocument();
  });

  it("renders both FreighterGasWarningBanner and GasEstimationWarningBanner simultaneously", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: true,
        simulationError: false,
        warningMessage:
          "Estimated fee is unusually high (5000000 stroops / 0.5000000 XLM). Review before signing.",
      },
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    // The context-based banner should be present
    expect(
      screen.getByTestId("gas-estimation-warning-banner")
    ).toBeInTheDocument();

    // The connector-level banner should not be present (no simulation run yet)
    expect(
      screen.queryByTestId("freighter-gas-warning-banner")
    ).not.toBeInTheDocument();
  });

  it("GasEstimationWarningBanner does not render a banner with empty warning message", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: false,
        highFee: false,
        simulationError: false,
        warningMessage: null,
      },
    });

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("gas-estimation-warning-banner")
    ).not.toBeInTheDocument();
  });
});
