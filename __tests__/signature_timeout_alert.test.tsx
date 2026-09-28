import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignatureTimeoutAlert from "@/app/components/SignatureTimeoutAlert";
import WalletLoaderOverlay from "@/app/components/WalletLoaderOverlay";
import { endWalletOperation, startWalletOperation } from "@/app/lib/wallet_state_context";

// WalletProvider pulls @creit.tech/stellar-wallets-kit at module scope, whose
// bundled UMD dependencies are not Node-ESM-importable. These suites never
// exercise provider-driven wallet state (they render the components with bare
// props), so `useWallet` is stubbed with the same defaults the real
// WalletContext provides via `createContext`. The real wallet library modules
// (wallet_state_context, freighter_connector, albedo_connector,
// ledger_usb_bridge) stay under test.
const walletContextMock = vi.hoisted(() => ({
  useWallet: () => ({
    address: null,
    assembleMultiSigTransaction: vi.fn(async () => ({
      uniqueSigners: 0,
      splitsValidated: 0,
    })),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    isConnecting: false,
    networkMismatchMessage: null,
    selectedWalletId: "albedo",
    setSelectedWalletId: vi.fn(),
    signTransaction: vi.fn(async () => ""),
    signatureTimeoutError: null,
    signatureTimeoutXdr: null,
    clearSignatureTimeout: vi.fn(),
    simulationResult: null,
    setSimulationResult: vi.fn(),
    gasWarning: null,
  }),
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: walletContextMock.useWallet,
}));

describe("SignatureTimeoutAlert", () => {
  it("renders timeout details and logs a formatted stack trace", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SignatureTimeoutAlert isOpen error={new Error("signature failed")} transactionId="tx-1" />);

    expect(screen.getByTestId("signature-timeout-alert")).toBeInTheDocument();
    expect(screen.getByText("Signature request timed out")).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("--- stack trace ---"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("tx-1"));
    warnSpy.mockRestore();
  });

  it("reports malformed transaction structures", async () => {
    render(<SignatureTimeoutAlert isOpen transactionXdr="not-valid-xdr" />);

    await waitFor(() => {
      expect(screen.getByTestId("signature-timeout-transaction-error")).toBeInTheDocument();
    });
  });

  it("shows the retry spinner and clears loader state when retry completes", async () => {
    let resolveRetry!: () => void;
    const onRetry = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveRetry = resolve;
      })
    );
    render(
      <>
        <SignatureTimeoutAlert isOpen onRetry={onRetry} />
        <WalletLoaderOverlay />
      </>
    );

    screen.getByTestId("signature-timeout-retry").click();
    await waitFor(() => expect(screen.getByTestId("wallet-loader-overlay")).toBeInTheDocument());
    expect(screen.getByTestId("signature-timeout-retry")).toBeDisabled();

    resolveRetry();
    await waitFor(() => expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render when there is no timeout or network warning", () => {
    render(<SignatureTimeoutAlert />);
    expect(screen.queryByTestId("signature-timeout-alert")).not.toBeInTheDocument();
  });

  it("keeps the loader counter balanced when an external operation is active", async () => {
    render(<WalletLoaderOverlay />);
    // The overlay subscribes to module-level wallet state, so these calls
    // update React from outside the render cycle; act() flushes them before
    // the assertions read the DOM.
    act(() => startWalletOperation());
    expect(screen.getByTestId("wallet-loader-overlay")).toBeInTheDocument();
    act(() => endWalletOperation());
    await waitFor(() => expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument());
  });
});
