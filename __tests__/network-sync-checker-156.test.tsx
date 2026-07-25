/**
 * Tests for Issue #156 – Display network mismatch warnings in network_sync_checker.
 *
 * Covers:
 *   - network_sync_checker utility functions
 *   - NetworkMismatchBanner rendering behaviour
 *   - useNetworkSyncChecker hook mismatch detection
 */

import { render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getNetworkName,
  buildMismatchMessage,
  runNetworkCheck,
  APP_NETWORK_NAME,
} from "@/app/lib/network_sync_checker";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import NetworkMismatchBanner from "@/app/components/NetworkMismatchBanner";
import type { NetworkSyncState } from "@/app/hooks/useNetworkSyncChecker";

// ---------------------------------------------------------------------------
// network_sync_checker utility tests
// ---------------------------------------------------------------------------
describe("getNetworkName", () => {
  it("returns 'Testnet' for the testnet passphrase", () => {
    expect(
      getNetworkName("Test SDF Network ; September 2015")
    ).toBe("Testnet");
  });

  it("returns 'Mainnet' for the public network passphrase", () => {
    expect(
      getNetworkName("Public Global Stellar Network ; September 2015")
    ).toBe("Mainnet");
  });

  it("returns 'Unknown Network' for an unrecognised passphrase", () => {
    expect(getNetworkName("some-random-passphrase")).toBe("Unknown Network");
  });
});

describe("buildMismatchMessage", () => {
  it("includes the wallet name, wallet network, and app network", () => {
    const msg = buildMismatchMessage("Freighter", "Mainnet", "Testnet");
    expect(msg).toContain("Freighter");
    expect(msg).toContain("Mainnet");
    expect(msg).toContain("Testnet");
  });

  it("falls back to 'an unknown network' when walletNetworkName is null", () => {
    const msg = buildMismatchMessage("Albedo", null, "Testnet");
    expect(msg).toContain("an unknown network");
  });
});

describe("runNetworkCheck", () => {
  it("reports mismatch=false when passphrases match", async () => {
    const getNetwork = vi.fn().mockResolvedValue({ networkPassphrase: NETWORK_PASSPHRASE });
    const result = await runNetworkCheck(getNetwork);
    expect(result.mismatch).toBe(false);
    expect(result.walletPassphrase).toBe(NETWORK_PASSPHRASE);
  });

  it("reports mismatch=true when passphrases differ", async () => {
    const getNetwork = vi
      .fn()
      .mockResolvedValue({ networkPassphrase: "Public Global Stellar Network ; September 2015" });
    const result = await runNetworkCheck(getNetwork);
    expect(result.mismatch).toBe(true);
    expect(result.walletNetworkName).toBe("Mainnet");
    expect(result.appNetworkName).toBe(APP_NETWORK_NAME);
  });

  it("propagates errors thrown by the getter", async () => {
    const getNetwork = vi.fn().mockRejectedValue(new Error("wallet unavailable"));
    await expect(runNetworkCheck(getNetwork)).rejects.toThrow("wallet unavailable");
  });
});

// ---------------------------------------------------------------------------
// NetworkMismatchBanner rendering tests
// ---------------------------------------------------------------------------
describe("NetworkMismatchBanner", () => {
  const baseState: NetworkSyncState = {
    isChecking: false,
    mismatch: false,
    result: null,
    error: null,
  };

  it("renders nothing when there is no mismatch", () => {
    const { container } = render(
      <NetworkMismatchBanner syncState={baseState} walletName="Freighter" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a spinner while checking", () => {
    render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: true }}
        walletName="Freighter"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/checking network/i)).toBeInTheDocument();
  });

  it("renders a warning banner on mismatch", () => {
    render(
      <NetworkMismatchBanner
        syncState={{
          ...baseState,
          mismatch: true,
          result: {
            mismatch: true,
            walletPassphrase: "Public Global Stellar Network ; September 2015",
            walletNetworkName: "Mainnet",
            appNetworkName: "Testnet",
          },
        }}
        walletName="Freighter"
      />
    );
    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Freighter");
    expect(banner).toHaveTextContent("Mainnet");
    expect(banner).toHaveTextContent("Testnet");
  });

  it("renders the banner with the correct data-testid on mismatch", () => {
    render(
      <NetworkMismatchBanner
        syncState={{
          ...baseState,
          mismatch: true,
          result: {
            mismatch: true,
            walletPassphrase: "Public Global Stellar Network ; September 2015",
            walletNetworkName: "Mainnet",
            appNetworkName: "Testnet",
          },
        }}
        walletName="Albedo"
      />
    );
    expect(screen.getByTestId("network-mismatch-banner")).toBeInTheDocument();
  });

  it("renders an error banner when the check itself failed", () => {
    render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, error: "wallet unavailable" }}
        walletName="Freighter"
      />
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("wallet unavailable");
  });

  it("renders dynamic wallet names in the mismatch message", () => {
    render(
      <NetworkMismatchBanner
        syncState={{
          ...baseState,
          mismatch: true,
          result: {
            mismatch: true,
            walletPassphrase: "Public Global Stellar Network ; September 2015",
            walletNetworkName: "Mainnet",
            appNetworkName: "Testnet",
          },
        }}
        walletName="xBull"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("xBull");
  });
});

// ---------------------------------------------------------------------------
// useNetworkSyncChecker hook tests
// ---------------------------------------------------------------------------
vi.mock("@creit.tech/stellar-wallets-kit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@creit.tech/stellar-wallets-kit")>();
  return {
    ...original,
    StellarWalletsKit: {
      ...((original as Record<string, unknown>).StellarWalletsKit ?? {}),
      getNetwork: vi.fn(),
    },
  };
});

// Static imports must come after vi.mock hoisting.
// We use a lazy import inside tests for the mocked module.
describe("useNetworkSyncChecker hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to idle state with no address", async () => {
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker(null));
    expect(result.current.isChecking).toBe(false);
    expect(result.current.mismatch).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("sets mismatch=false when wallet network matches app network", async () => {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker("GABC1234"));
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.mismatch).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets mismatch=true when wallet is on a different network", async () => {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker("GABC1234"));
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.mismatch).toBe(true);
    expect(result.current.result?.walletNetworkName).toBe("Mainnet");
  });

  it("sets error state when getNetwork throws", async () => {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("wallet not available")
    );
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker("GABC1234"));
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.error).toBe("wallet not available");
    expect(result.current.mismatch).toBe(false);
  });
});
