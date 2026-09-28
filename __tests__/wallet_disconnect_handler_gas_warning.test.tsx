import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletDisconnectGasWarningBanner from "@/app/components/WalletDisconnectGasWarningBanner";
import {
  DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS,
  checkDisconnectSimulationFeeWarning,
  warnOnDisconnectSimulationFee,
  type WalletDisconnectSimulationResult,
} from "@/app/lib/wallet_disconnect_handler";

// ---------------------------------------------------------------------------
// checkDisconnectSimulationFeeWarning — fee bounds
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler checkDisconnectSimulationFeeWarning (#240)", () => {
  it("returns no warning for a fee well within standard bounds", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: 100 });
    expect(state.hasWarning).toBe(false);
    expect(state.highFee).toBe(false);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("returns no warning for a zero fee", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: 0 });
    expect(state.hasWarning).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("returns no warning for a fee exactly at the threshold", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS,
    });
    expect(state.hasWarning).toBe(false);
    expect(state.highFee).toBe(false);
  });

  it("warns when the fee exceeds the threshold by one stroop", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS + 1,
    });
    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(true);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toMatch(/unusually high/i);
  });

  it("warns when fee limits exceed standard bounds", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: 5_000_000 });
    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(true);
    expect(state.warningMessage).toContain("5000000 stroops");
  });

  it("renders the fee in XLM alongside stroops", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: 20_000_000 });
    expect(state.warningMessage).toContain("2.0000000 XLM");
  });

  it("tells the user to review before signing on a high fee", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: 9_999_999 });
    expect(state.warningMessage).toMatch(/review before signing/i);
  });

  it("exposes the documented 0.1 XLM threshold", () => {
    expect(DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS).toBe(1_000_000);
  });
});

// ---------------------------------------------------------------------------
// checkDisconnectSimulationFeeWarning — simulation errors
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler simulation error handling (#240)", () => {
  it("warns with the RPC error string when the simulation reports an error", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: 100,
      error: "HostError: contract trapped",
    });
    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.warningMessage).toContain("HostError: contract trapped");
  });

  it("falls back to generic copy when only simulationError is present", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: 100,
      simulationError: { code: 42 },
    });
    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.warningMessage).toMatch(/simulation failed/i);
    expect(state.warningMessage).toMatch(/contract may have rejected/i);
  });

  it("prefers the simulation error over the high-fee warning", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: 50_000_000,
      error: "simulation unavailable",
    });
    expect(state.simulationError).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.warningMessage).toContain("simulation unavailable");
  });

  it("treats a NaN fee as an untrustworthy estimate", () => {
    const state = checkDisconnectSimulationFeeWarning({ fee: Number.NaN });
    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.warningMessage).toMatch(/invalid fee estimate/i);
  });

  it("treats an Infinite fee as an untrustworthy estimate", () => {
    const state = checkDisconnectSimulationFeeWarning({
      fee: Number.POSITIVE_INFINITY,
    });
    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
  });

  it("returns a quiet state for a null simulation result", () => {
    const state = checkDisconnectSimulationFeeWarning(null);
    expect(state.hasWarning).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("returns a quiet state for an undefined simulation result", () => {
    const state = checkDisconnectSimulationFeeWarning(undefined);
    expect(state.hasWarning).toBe(false);
    expect(state.warningMessage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// warnOnDisconnectSimulationFee — console logging
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler warnOnDisconnectSimulationFee (#240)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("logs a HIGH FEE WARNING when the fee exceeds bounds", () => {
    const state = warnOnDisconnectSimulationFee({ fee: 8_000_000 });
    expect(state.highFee).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[wallet_disconnect_handler]");
    expect(logged).toContain("HIGH FEE WARNING");
  });

  it("logs a SIMULATION ERROR when the simulation failed", () => {
    warnOnDisconnectSimulationFee({ fee: 100, error: "boom" });
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIMULATION ERROR");
  });

  it("does not log when the fee is within standard bounds", () => {
    warnOnDisconnectSimulationFee({ fee: 100 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log for a null simulation result", () => {
    warnOnDisconnectSimulationFee(null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WalletDisconnectGasWarningBanner — banner rendering
// ---------------------------------------------------------------------------

describe("WalletDisconnectGasWarningBanner (#240)", () => {
  const highFee: WalletDisconnectSimulationResult = { fee: 7_500_000 };

  it("displays the warning banner when fee limits exceed standard bounds", () => {
    render(<WalletDisconnectGasWarningBanner simulation={highFee} />);

    const banner = screen.getByTestId("wallet-disconnect-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/unusually high/i);
  });

  it("marks the banner as an alert for assistive technology", () => {
    render(<WalletDisconnectGasWarningBanner simulation={highFee} />);
    expect(
      screen.getByTestId("wallet-disconnect-gas-warning-banner"),
    ).toHaveAttribute("role", "alert");
  });

  it("flags the high-fee case on the banner element", () => {
    render(<WalletDisconnectGasWarningBanner simulation={highFee} />);
    const banner = screen.getByTestId("wallet-disconnect-gas-warning-banner");
    expect(banner).toHaveAttribute("data-high-fee", "true");
    expect(banner).toHaveAttribute("data-simulation-error", "false");
  });

  it("displays the simulation error banner when the simulation failed", () => {
    render(
      <WalletDisconnectGasWarningBanner
        simulation={{ fee: 100, error: "contract trapped" }}
      />,
    );
    const banner = screen.getByTestId("wallet-disconnect-gas-warning-banner");
    expect(banner).toHaveTextContent("contract trapped");
    expect(banner).toHaveAttribute("data-simulation-error", "true");
  });

  it("does not render when the fee is within standard bounds", () => {
    const { container } = render(
      <WalletDisconnectGasWarningBanner simulation={{ fee: 500 }} />,
    );
    expect(
      screen.queryByTestId("wallet-disconnect-gas-warning-banner"),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when no simulation has run yet", () => {
    const { container } = render(
      <WalletDisconnectGasWarningBanner simulation={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("appends a caller-supplied className", () => {
    render(
      <WalletDisconnectGasWarningBanner
        simulation={highFee}
        className="mb-4"
      />,
    );
    expect(
      screen.getByTestId("wallet-disconnect-gas-warning-banner"),
    ).toHaveClass("mb-4");
  });
});
