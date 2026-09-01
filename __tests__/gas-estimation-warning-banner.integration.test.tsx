import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWallet, WalletProvider } from "@/app/context/WalletContext";
import { HIGH_FEE_THRESHOLD_STROOPS } from "@/app/lib/ledger_usb_bridge";

// -------------------------------------------------------------------------------------

// Integration note: verify WalletContext derives gasWarning correctly from 
// setSimulationResult so the banner reflects real context state changes. 
// -------------------------------------------------------------------------------------

// Minimal stubs needed by WalletProvider internals.
vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  StellarWalletsKit: {
    init: vi.fn(),
    getNetwork: vi.fn().mockResolvedValue({ networkPassphrase: "Test SDF Network ; September 2015" }),
    getAddress: vi.fn().mockResolvedValue({ address: null }),
    authModal: vi.fn(),
    setWallet: vi.fn(),
    signTransaction: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@/app/lib/contract", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

vi.mock("@/app/lib/ledger_usb_bridge", async () => {
  // Import real implementations so checkSimulationFeeWarning logic is preserved
  const {
    checkSimulationFeeWarning,
    HIGH_FEE_THRESHOLD_STROOPS,
  } = await vi.importActual<typeof import("@/app/lib/ledger_usb_bridge")>(
    "@/app/lib/ledger_usb_bridge"
  );
  return {
    checkSimulationFeeWarning,
    HIGH_FEE_THRESHOLD_STROOPS,
    ledgerActiveAddresses: { clear: vi.fn() },
  };
});

vi.mock("@/app/lib/freighter_connector", () => ({
  freighterActiveAddress: { setActiveAddress: vi.fn(), clear: vi.fn() },
  verifyAndRehydrateFreighterAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("WalletContext gas warning integration", () => {
  it("gasWarning is null when no simulationResult has been set", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    expect(result.current.gasWarning).toBeNull();
    expect(result.current.simulationResult).toBeNull();
  });

  it("gasWarning reflects hasWarning=true when fee exceeds threshold", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    act(() => {
      result.current.setSimulationResult({
        fee: HIGH_FEE_THRESHOLD_STROOPS + 500,
      });
    });

    expect(result.current.gasWarning?.hasWarning).toBe(true);
    expect(result.current.gasWarning?.highFee).toBe(true);
    expect(result.current.gasWarning?.simulationError).toBe(false);
    expect(result.current.gasWarning?.warningMessage).toMatch(/unusually high/i);
  });

  it("gasWarning reflects simulationError=true when simulation has an error", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    act(() => {
      result.current.setSimulationResult({
        fee: 100,
        error: "HostError: trap",
      });
    });

    expect(result.current.gasWarning?.hasWarning).toBe(true);
    expect(result.current.gasWarning?.simulationError).toBe(true);
    expect(result.current.gasWarning?.warningMessage).toMatch(/simulation failed/i);
  });

  it("gasWarning is null after simulationResult is cleared", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    act(() => {
      result.current.setSimulationResult({ fee: HIGH_FEE_THRESHOLD_STROOPS + 1 });
    });
    expect(result.current.gasWarning?.hasWarning).toBe(true);

    act(() => {
      result.current.setSimulationResult(null);
    });
    expect(result.current.gasWarning).toBeNull();
  });

  it("gasWarning has hasWarning=false when fee is within bounds", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    act(() => {
      result.current.setSimulationResult({ fee: 100 });
    });

    expect(result.current.gasWarning?.hasWarning).toBe(false);
    expect(result.current.gasWarning?.warningMessage).toBeNull();
  });
});
