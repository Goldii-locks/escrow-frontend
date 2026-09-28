import { describe, expect, it, vi } from "vitest";
import {
  checkSimulationFeeWarning,
  warnOnSimulationFee,
  warnOnNetworkSyncSimulation,
  HIGH_FEE_THRESHOLD_STROOPS,
  type NetworkSyncSimulationResult,
  type SyncToastHandler,
} from "@/app/lib/network_sync_checker";

describe("network_sync_checker gas estimation warnings (#160)", () => {
  it("returns no warning for a normal fee", () => {
    const result: NetworkSyncSimulationResult = { fee: 100 };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(false);
    expect(state.highFee).toBe(false);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("warns when fee exceeds the high-fee threshold", () => {
    const result: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 1,
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(true);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toContain("unusually high");
    expect(state.warningMessage).toContain("1000001 stroops");
  });

  it("warns on simulation error string", () => {
    const result: NetworkSyncSimulationResult = {
      fee: 100,
      error: "HostError: value out of range",
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.simulationError).toBe(true);
    expect(state.warningMessage).toContain("Transaction simulation failed");
    expect(state.warningMessage).toContain("HostError: value out of range");
  });

  it("warns on simulationError object even when fee is normal", () => {
    const result: NetworkSyncSimulationResult = {
      fee: 50,
      simulationError: { code: -1, message: "contract trap" },
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.simulationError).toBe(true);
    expect(state.warningMessage).toContain("Transaction simulation failed");
  });

  it("prioritises simulation errors over high-fee warnings", () => {
    const result: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 500,
      error: "simulation timed out",
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.warningMessage).toContain("simulation timed out");
  });

  it("warnOnSimulationFee logs warnings to console", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 100,
    };

    const state = warnOnSimulationFee(result, { txId: "test-tx-123" });

    expect(state.hasWarning).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[network_sync_checker]"),
      expect.stringContaining("txId: test-tx-123")
    );

    warnSpy.mockRestore();
  });

  it("warnOnNetworkSyncSimulation displays toast on high fee", () => {
    const mockShowToast: SyncToastHandler = vi.fn();

    const result: NetworkSyncSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 200,
    };

    const state = warnOnNetworkSyncSimulation(result, mockShowToast);

    expect(state.hasWarning).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("unusually high"),
      "warning"
    );
  });

  it("warnOnNetworkSyncSimulation displays toast on simulation error", () => {
    const mockShowToast: SyncToastHandler = vi.fn();

    const result: NetworkSyncSimulationResult = {
      fee: 100,
      error: "Contract execution failed",
    };

    const state = warnOnNetworkSyncSimulation(result, mockShowToast);

    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Transaction simulation failed"),
      "warning"
    );
  });

  it("warnOnNetworkSyncSimulation does not toast when fee is normal", () => {
    const mockShowToast: SyncToastHandler = vi.fn();

    const result: NetworkSyncSimulationResult = { fee: 500 };

    const state = warnOnNetworkSyncSimulation(result, mockShowToast);

    expect(state.hasWarning).toBe(false);
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
