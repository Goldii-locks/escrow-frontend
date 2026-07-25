import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkSimulationFeeWarning,
  HIGH_FEE_THRESHOLD_STROOPS,
  warnOnSimulationFee,
  type LedgerSimulationResult,
} from "@/app/lib/ledger_usb_bridge";

describe("ledger_usb_bridge gas estimation warnings (#150)", () => {
  it("returns no warning for a normal fee", () => {
    const result: LedgerSimulationResult = { fee: 100 };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(false);
    expect(state.highFee).toBe(false);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("warns when fee exceeds the high-fee threshold", () => {
    const result: LedgerSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 1,
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.highFee).toBe(true);
    expect(state.simulationError).toBe(false);
    expect(state.warningMessage).toMatch(/unusually high/i);
    expect(state.warningMessage).toContain(String(HIGH_FEE_THRESHOLD_STROOPS + 1));
  });

  it("does not warn at exactly the threshold", () => {
    const state = checkSimulationFeeWarning({
      fee: HIGH_FEE_THRESHOLD_STROOPS,
    });
    expect(state.highFee).toBe(false);
    expect(state.hasWarning).toBe(false);
  });

  it("warns on simulation error string", () => {
    const result: LedgerSimulationResult = {
      fee: 100,
      error: "HostError: value out of range",
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.highFee).toBe(false);
    expect(state.warningMessage).toMatch(/simulation failed/i);
    expect(state.warningMessage).toContain("HostError: value out of range");
  });

  it("warns on simulationError object even when fee is normal", () => {
    const result: LedgerSimulationResult = {
      fee: 50,
      simulationError: { code: -1, message: "contract trap" },
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.hasWarning).toBe(true);
    expect(state.simulationError).toBe(true);
    expect(state.warningMessage).toMatch(/simulation failed/i);
  });

  it("simulation error takes precedence over high fee", () => {
    const result: LedgerSimulationResult = {
      fee: HIGH_FEE_THRESHOLD_STROOPS + 999,
      error: "HostError",
    };
    const state = checkSimulationFeeWarning(result);

    expect(state.simulationError).toBe(true);
    expect(state.highFee).toBe(false);
  });

  it("includes XLM equivalent in the high-fee warning message", () => {
    const fee = 5_000_000;
    const state = checkSimulationFeeWarning({ fee });

    expect(state.warningMessage).toContain("5000000");
    expect(state.warningMessage).toContain("XLM");
  });
});

describe("ledger_usb_bridge warnOnSimulationFee console output (#150)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("logs a HIGH FEE WARNING block when fee is too high", () => {
    const state = warnOnSimulationFee(
      { fee: HIGH_FEE_THRESHOLD_STROOPS + 100 },
      { txId: "tx-fee-1" }
    );

    expect(state.hasWarning).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[ledger_usb_bridge]");
    expect(logged).toContain("HIGH FEE WARNING");
    expect(logged).toContain("--- stack trace ---");
    expect(logged).toContain("txId: tx-fee-1");
  });

  it("logs a SIMULATION ERROR block when simulation fails", () => {
    const state = warnOnSimulationFee(
      { fee: 0, error: "HostError: value out of range" },
      { txId: "tx-sim-err" }
    );

    expect(state.simulationError).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIMULATION ERROR");
    expect(logged).toContain("--- stack trace ---");
  });

  it("does not log when fee is within bounds and no simulation error", () => {
    warnOnSimulationFee({ fee: 200 });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
