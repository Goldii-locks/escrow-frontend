import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LedgerLoaderOverlay from "@/app/components/LedgerLoaderOverlay";
import {
  isLedgerLoading,
  startLedgerOperation,
  endLedgerOperation,
  resetLedgerOperations,
  withLedgerLoader,
  signWithTimeout,
  signCatchingRejection,
  connectLedgerDevice,
  openLedgerApp,
  getLedgerAddress,
  type LedgerSignResult,
} from "@/app/lib/ledger_usb_bridge";

describe("LedgerLoaderOverlay and Ledger Operation Loader Tracking", () => {
  beforeEach(() => {
    resetLedgerOperations();
  });

  afterEach(() => {
    resetLedgerOperations();
  });

  it("is initially hidden and does not render the overlay", () => {
    render(<LedgerLoaderOverlay />);
    expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    expect(isLedgerLoading()).toBe(false);
  });

  it("becomes visible when an operation starts and hides when it ends", async () => {
    render(<LedgerLoaderOverlay />);

    startLedgerOperation();
    expect(isLedgerLoading()).toBe(true);

    // Wait for state subscription to update the UI
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });
    expect(screen.getByText("Ledger Operation in Progress")).toBeInTheDocument();

    endLedgerOperation();
    expect(isLedgerLoading()).toBe(false);

    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("becomes hidden when the wrapped operation completes successfully", async () => {
    render(<LedgerLoaderOverlay />);

    const result = await withLedgerLoader(async () => {
      expect(isLedgerLoading()).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
      });
      return "success";
    });

    expect(result).toBe("success");
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("becomes hidden when the wrapped operation fails/throws", async () => {
    render(<LedgerLoaderOverlay />);

    const operationPromise = withLedgerLoader(async () => {
      expect(isLedgerLoading()).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
      });
      throw new Error("simulated failure");
    });

    await expect(operationPromise).rejects.toThrow("simulated failure");
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("handles overlapping/concurrent operations correctly with a reference counter", async () => {
    render(<LedgerLoaderOverlay />);

    startLedgerOperation(); // op 1
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    startLedgerOperation(); // op 2
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    endLedgerOperation(); // op 1 ends
    expect(isLedgerLoading()).toBe(true); // Still loading because of op 2
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    endLedgerOperation(); // op 2 ends
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("shows loader for signWithTimeout and hides on success", async () => {
    render(<LedgerLoaderOverlay />);

    const request = { xdr: "AAAA..." };
    // Create a promise that resolves after a small delay so we can capture the loading state
    const signFn = vi.fn().mockImplementation(
      (xdr: string): Promise<LedgerSignResult> =>
        new Promise<LedgerSignResult>((resolve) =>
          setTimeout(() => resolve({ signedXdr: "signed-xdr" }), 150)
        )
    );

    const promise = signWithTimeout(request, signFn, 5000);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    const result = await promise;
    expect(result.signedXdr).toBe("signed-xdr");
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("shows loader for signWithTimeout and hides on timeout", async () => {
    render(<LedgerLoaderOverlay />);

    const request = { xdr: "AAAA..." };
    const signFn = vi.fn((): Promise<LedgerSignResult> => new Promise(() => {})); // Never resolves

    // Set timeout to 150ms so we can test it using real time quickly
    const promise = signWithTimeout(request, signFn, 150);
    expect(isLedgerLoading()).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    await expect(promise).rejects.toThrow("Ledger signature timed out");
    expect(isLedgerLoading()).toBe(false);

    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("shows loader for signCatchingRejection and hides on success", async () => {
    render(<LedgerLoaderOverlay />);

    const signFn = vi.fn().mockImplementation(
      (): Promise<LedgerSignResult> =>
        new Promise<LedgerSignResult>((resolve) =>
          setTimeout(() => resolve({ signedXdr: "signed-xdr" }), 150)
        )
    );
    const showToast = vi.fn();

    const promise = signCatchingRejection(signFn, showToast);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    const result = await promise;
    expect(result?.signedXdr).toBe("signed-xdr");
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("shows loader for signCatchingRejection and hides on user rejection", async () => {
    render(<LedgerLoaderOverlay />);

    const signFn = vi.fn().mockImplementation(
      (): Promise<LedgerSignResult> =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("user rejected transaction")), 150)
        )
    );
    const showToast = vi.fn();

    const promise = signCatchingRejection(signFn, showToast);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });

    const result = await promise;
    expect(result).toBeNull();
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("shows loader for dummy connect/openApp/getAddress operations and hides correctly", async () => {
    render(<LedgerLoaderOverlay />);

    const connectPromise = connectLedgerDevice(100);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });
    await connectPromise;
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });

    const openAppPromise = openLedgerApp(100);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });
    await openAppPromise;
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });

    const getAddressPromise = getLedgerAddress(100);
    expect(isLedgerLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("ledger-loader-overlay")).toBeInTheDocument();
    });
    const address = await getAddressPromise;
    expect(address).toBe("G...");
    expect(isLedgerLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("ledger-loader-overlay")).not.toBeInTheDocument();
    });
  });
});
