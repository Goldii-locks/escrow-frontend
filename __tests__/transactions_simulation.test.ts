import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitContractTransaction } from "@/app/lib/transactions";

describe("submitContractTransaction simulation result wiring (#631)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls setSimulationResult with simulation data from build-tx response", async () => {
    const setSimulationResult = vi.fn();
    const signTransaction = vi.fn(async () => "signed-xdr");

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: "AAAA...", simulationResult: { fee: 1_500_000 } }),
    } as Response);

    await expect(
      submitContractTransaction({
        method: "initialize",
        args: [],
        sourceAddress: "GCLIENT",
        signTransaction,
        setSimulationResult,
      })
    ).rejects.toThrow();

    expect(setSimulationResult).toHaveBeenCalledWith({
      fee: 1_500_000,
    });
  });

  it("does not call setSimulationResult when not provided", async () => {
    const signTransaction = vi.fn(async () => "signed-xdr");

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: "AAAA...", simulationResult: { fee: 1_500_000 } }),
    } as Response);

    await expect(
      submitContractTransaction({
        method: "initialize",
        args: [],
        sourceAddress: "GCLIENT",
        signTransaction,
      })
    ).rejects.toThrow();

    expect(signTransaction).toHaveBeenCalled();
  });

  it("does not call setSimulationResult when response has no simulationResult", async () => {
    const setSimulationResult = vi.fn();
    const signTransaction = vi.fn(async () => "signed-xdr");

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: "AAAA..." }),
    } as Response);

    await expect(
      submitContractTransaction({
        method: "initialize",
        args: [],
        sourceAddress: "GCLIENT",
        signTransaction,
        setSimulationResult,
      })
    ).rejects.toThrow();

    expect(setSimulationResult).not.toHaveBeenCalled();
  });
});
