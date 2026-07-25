/**
 * Tests for Issue #158 – Trigger loading spinner states during
 * network_sync_checker calls.
 *
 * Covers:
 *   - useNetworkSyncSpinner hook:
 *       • isChecking starts as false
 *       • isChecking becomes true during the async operation
 *       • isChecking returns to false after the operation resolves
 *       • isChecking returns to false even when the operation rejects
 *   - NetworkMismatchBanner spinner rendering (isChecking state):
 *       • spinner is visible while isChecking=true
 *       • spinner disappears after isChecking=false
 *   - useNetworkSyncChecker hook:
 *       • isChecking transitions correctly during a check lifecycle
 */

import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import { useNetworkSyncSpinner } from "@/app/hooks/useNetworkSyncSpinner";
import NetworkMismatchBanner from "@/app/components/NetworkMismatchBanner";
import type { NetworkSyncState } from "@/app/hooks/useNetworkSyncChecker";

// ---------------------------------------------------------------------------
// useNetworkSyncSpinner
// ---------------------------------------------------------------------------
describe("useNetworkSyncSpinner", () => {
  it("starts with isChecking=false", () => {
    const { result } = renderHook(() => useNetworkSyncSpinner());
    expect(result.current.isChecking).toBe(false);
  });

  it("sets isChecking=true while the wrapped async fn is running", async () => {
    let resolveCheck!: () => void;
    const pending = new Promise<void>((res) => { resolveCheck = res; });

    const { result } = renderHook(() => useNetworkSyncSpinner());

    let wrapPromise!: Promise<void>;
    act(() => {
      wrapPromise = result.current.wrap(() => pending);
    });

    // Spinner should be on while the inner promise is pending.
    expect(result.current.isChecking).toBe(true);

    // Resolve the inner promise.
    await act(async () => { resolveCheck(); await wrapPromise; });

    expect(result.current.isChecking).toBe(false);
  });

  it("resets isChecking=false after the wrapped fn resolves", async () => {
    const { result } = renderHook(() => useNetworkSyncSpinner());
    await act(async () => {
      await result.current.wrap(async () => "done");
    });
    expect(result.current.isChecking).toBe(false);
  });

  it("resets isChecking=false even when the wrapped fn rejects", async () => {
    const { result } = renderHook(() => useNetworkSyncSpinner());
    await act(async () => {
      try {
        await result.current.wrap(async () => { throw new Error("check failed"); });
      } catch {
        // expected
      }
    });
    expect(result.current.isChecking).toBe(false);
  });

  it("propagates the return value of the wrapped fn", async () => {
    const { result } = renderHook(() => useNetworkSyncSpinner());
    let value: number | undefined;
    await act(async () => {
      value = await result.current.wrap(async () => 42);
    });
    expect(value).toBe(42);
  });

  it("re-throws errors from the wrapped fn", async () => {
    const { result } = renderHook(() => useNetworkSyncSpinner());
    await act(async () => {
      await expect(
        result.current.wrap(async () => { throw new Error("boom"); })
      ).rejects.toThrow("boom");
    });
  });
});

// ---------------------------------------------------------------------------
// NetworkMismatchBanner spinner rendering
// ---------------------------------------------------------------------------
describe("NetworkMismatchBanner spinner rendering", () => {
  const baseState: NetworkSyncState = {
    isChecking: false,
    mismatch: false,
    result: null,
    error: null,
  };

  it("renders the spinner status region when isChecking=true", () => {
    render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: true }}
        walletName="Freighter"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/checking network/i)).toBeInTheDocument();
  });

  it("does NOT render a spinner when isChecking=false and no mismatch", () => {
    const { container } = render(
      <NetworkMismatchBanner syncState={baseState} walletName="Freighter" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("spinner has aria-label for accessibility", () => {
    render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: true }}
        walletName="Freighter"
      />
    );
    expect(screen.getByRole("status", { name: /checking wallet network/i })).toBeInTheDocument();
  });

  it("transitions from spinner to mismatch banner without lingering spinner", () => {
    const { rerender } = render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: true }}
        walletName="Freighter"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(
      <NetworkMismatchBanner
        syncState={{
          isChecking: false,
          mismatch: true,
          error: null,
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

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("transitions from spinner to no banner when check passes", () => {
    const { rerender, container } = render(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: true }}
        walletName="Freighter"
      />
    );

    rerender(
      <NetworkMismatchBanner
        syncState={{ ...baseState, isChecking: false }}
        walletName="Freighter"
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useNetworkSyncChecker isChecking lifecycle (integration-level)
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

describe("useNetworkSyncChecker isChecking lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts isChecking=false when address is null", async () => {
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker(null));
    expect(result.current.isChecking).toBe(false);
  });

  it("is false after a successful check", async () => {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker("GABC1234"));
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("is false after a failed check (error path)", async () => {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("unreachable")
    );
    const { useNetworkSyncChecker } = await import("@/app/hooks/useNetworkSyncChecker");
    const { result } = renderHook(() => useNetworkSyncChecker("GABC1234"));
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.error).toBe("unreachable");
  });
});
