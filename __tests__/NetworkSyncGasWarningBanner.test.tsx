import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NetworkSyncGasWarningBanner from "@/app/components/NetworkSyncGasWarningBanner";
import { HIGH_FEE_THRESHOLD_STROOPS } from "@/app/lib/network_sync_checker";
import type { NetworkSyncSimulationResult } from "@/app/lib/network_sync_checker";

describe("NetworkSyncGasWarningBanner", () => {
  it("renders nothing when simulation is null", () => {
    const { container } = render(<NetworkSyncGasWarningBanner simulation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when fee is below threshold and no error", () => {
    const simulation: NetworkSyncSimulationResult = { fee: 100 };
    const { container } = render(<NetworkSyncGasWarningBanner simulation={simulation} />);
    expect(container.firstChild).toBeNull();
  });

  it("displays warning when fee exceeds threshold", () => {
    const simulation: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 500,
    };

    render(<NetworkSyncGasWarningBanner simulation={simulation} />);

    const banner = screen.getByTestId("network-sync-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
    expect(banner).toHaveTextContent(/1000500 stroops/);
  });

  it("displays warning when simulation has error string", () => {
    const simulation: NetworkSyncSimulationResult = {
      fee: 100,
      error: "HostError: contract trap",
    };

    render(<NetworkSyncGasWarningBanner simulation={simulation} />);

    const banner = screen.getByTestId("network-sync-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Transaction simulation failed/);
    expect(banner).toHaveTextContent(/HostError: contract trap/);
  });

  it("displays warning when simulation has simulationError object", () => {
    const simulation: NetworkSyncSimulationResult = {
      fee: 50,
      simulationError: { code: -1, message: "out of gas" },
    };

    render(<NetworkSyncGasWarningBanner simulation={simulation} />);

    const banner = screen.getByTestId("network-sync-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Transaction simulation failed/);
  });

  it("applies custom className when provided", () => {
    const simulation: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 100,
    };

    render(<NetworkSyncGasWarningBanner simulation={simulation} className="custom-class" />);

    const banner = screen.getByTestId("network-sync-gas-warning-banner");
    expect(banner).toHaveClass("custom-class");
  });

  it("uses warning theme classes", () => {
    const simulation: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 1,
    };

    render(<NetworkSyncGasWarningBanner simulation={simulation} />);

    const banner = screen.getByTestId("network-sync-gas-warning-banner");
    expect(banner).toHaveClass("bg-warning/40");
    expect(banner).toHaveClass("border-warning");
    expect(banner).toHaveClass("text-warning-soft");
  });
});
