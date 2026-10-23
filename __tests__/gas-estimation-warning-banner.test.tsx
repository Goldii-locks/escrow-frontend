// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import GasEstimationWarningBanner from "@/app/components/GasEstimationWarningBanner";
import { HIGH_FEE_THRESHOLD_STROOPS } from "@/app/lib/ledger_usb_bridge";

// ---------------------------------------------------------------------------
// Mock useWallet so we can inject different gasWarning states without
// needing a full WalletProvider / StellarWalletsKit environment.
// ---------------------------------------------------------------------------
const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("GasEstimationWarningBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when gasWarning is null", () => {
    mockUseWallet.mockReturnValue({ gasWarning: null });

    const { container } = render(<GasEstimationWarningBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when hasWarning is false", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: false,
        highFee: false,
        simulationError: false,
        warningMessage: null,
      },
    });

    const { container } = render(<GasEstimationWarningBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a warning banner when fee exceeds standard bounds", () => {
    const fee = HIGH_FEE_THRESHOLD_STROOPS + 1;
    const xlm = (fee / 10_000_000).toFixed(7);
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: true,
        simulationError: false,
        warningMessage: `Estimated fee is unusually high (${fee} stroops / ${xlm} XLM). Review before signing.`,
      },
    });

    render(<GasEstimationWarningBanner />);

    const banner = screen.getByTestId("gas-estimation-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
    expect(banner).toHaveTextContent(`${fee} stroops`);
  });

  it("renders a warning banner when simulation reports an error string", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: false,
        simulationError: true,
        warningMessage: "Transaction simulation failed: HostError: trap",
      },
    });

    render(<GasEstimationWarningBanner />);

    const banner = screen.getByTestId("gas-estimation-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/simulation failed/i);
    expect(banner).toHaveTextContent("HostError: trap");
  });

  it("renders a generic simulation failure message when no error string is present", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: false,
        simulationError: true,
        warningMessage:
          "Transaction simulation failed. The contract may have rejected this operation.",
      },
    });

    render(<GasEstimationWarningBanner />);

    expect(screen.getByRole("alert")).toHaveTextContent(/contract may have rejected/i);
  });

  it("applies extra className prop to the banner", () => {
    mockUseWallet.mockReturnValue({
      gasWarning: {
        hasWarning: true,
        highFee: true,
        simulationError: false,
        warningMessage: "Estimated fee is unusually high (1000001 stroops / 0.1000001 XLM). Review before signing.",
      },
    });

    render(<GasEstimationWarningBanner className="mx-4 mt-4" />);

    const banner = screen.getByTestId("gas-estimation-warning-banner");
    expect(banner).toHaveClass("mx-4");
    expect(banner).toHaveClass("mt-4");
  });
});
