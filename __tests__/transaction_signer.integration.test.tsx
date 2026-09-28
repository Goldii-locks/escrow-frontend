import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { ToastProvider } from "@/app/context/ToastContext";
import TransactionSigner from "@/app/components/TransactionSigner";
import type { TransactionSignerNetwork } from "@/app/lib/transaction_signer";

// ---------------------------------------------------------------------------
// Mocks — mirror wallet_state_context.test.tsx
// ---------------------------------------------------------------------------

const kitState = {
  getAddress: vi.fn(),
  authModal: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(),
  setWallet: vi.fn(),
};

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  StellarWalletsKit: {
    init: (...args: unknown[]) => kitState.init(...args),
    getAddress: (...args: unknown[]) => kitState.getAddress(...args),
    authModal: (...args: unknown[]) => kitState.authModal(...args),
    getNetwork: (...args: unknown[]) => kitState.getNetwork(...args),
    signTransaction: (...args: unknown[]) => kitState.signTransaction(...args),
    disconnect: (...args: unknown[]) => kitState.disconnect(...args),
    setWallet: (...args: unknown[]) => kitState.setWallet(...args),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@/app/lib/freighter_connector", () => ({
  freighterActiveAddress: {
    setActiveAddress: vi.fn(),
    clear: vi.fn(),
  },
  verifyAndRehydrateFreighterAddress: vi.fn(async () => null),
}));

vi.mock("@/app/lib/ledger_usb_bridge", () => ({
  ledgerActiveAddresses: {
    clear: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

// ---------------------------------------------------------------------------
// Harness — bridges WalletContext → TransactionSigner
// ---------------------------------------------------------------------------

/**
 * A test harness that:
 * 1. Uses the real WalletProvider to get wallet state
 * 2. Exposes a Connect button so tests can trigger the flow
 * 3. When connected, renders TransactionSigner with the wallet's network info
 */
function TransactionSignerHarness({
  walletNetwork = "testnet",
}: {
  walletNetwork?: TransactionSignerNetwork;
}) {
  const {
    address,
    connect,
    disconnect,
    networkMismatchMessage,
    signTransaction,
  } = useWallet();

  // The app network is always testnet (matches NETWORK_PASSPHRASE default)
  const appNetwork: TransactionSignerNetwork = "testnet";

  // walletNetwork is passed directly by the caller.

  return (
    <div>
      {address ? (
        <>
          <span data-testid="connected-address">{address}</span>
          {networkMismatchMessage && (
            <div data-testid="context-mismatch-message">
              {networkMismatchMessage}
            </div>
          )}
          <TransactionSigner
            walletNetwork={walletNetwork}
            appNetwork={appNetwork}
            signTransaction={() => signTransaction("fake-xdr")}
          />
          <button type="button" onClick={disconnect}>
            disconnect
          </button>
        </>
      ) : (
        <button type="button" onClick={() => void connect()}>
          connect
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("TransactionSigner + WalletContext integration (#216)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: TESTNET_PASSPHRASE,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // Network match — no warning
  // -------------------------------------------------------------------------

  it("shows no warning bar when wallet and app are both on testnet", async () => {
    kitState.authModal.mockResolvedValue({ address: "GTESTNET123456" });

    render(
      <ToastProvider>
        <WalletProvider>
          <TransactionSignerHarness walletNetwork="testnet" />
        </WalletProvider>
      </ToastProvider>
    );

    // Connect
    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected-address")).toHaveTextContent(
        "GTESTNET123456"
      );
    });

    // TransactionSigner should be visible with no warning bar
    expect(screen.getByTestId("transaction-signer")).toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-signer-network-warning-bar")
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Network mismatch — warning bar visible
  // -------------------------------------------------------------------------

  it("shows warning bar when wallet is on mainnet but app expects testnet", async () => {
    kitState.authModal.mockResolvedValue({ address: "GMAINNET123456" });

    render(
      <ToastProvider>
        <WalletProvider>
          <TransactionSignerHarness walletNetwork="mainnet" />
        </WalletProvider>
      </ToastProvider>
    );

    // Connect
    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected-address")).toHaveTextContent(
        "GMAINNET123456"
      );
    });

    // TransactionSigner shows the warning bar
    const bar = screen.getByTestId("transaction-signer-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
  });

  // -------------------------------------------------------------------------
  // Network mismatch — sign button disabled
  // -------------------------------------------------------------------------

  it("disables the Sign Transaction button on network mismatch", async () => {
    kitState.authModal.mockResolvedValue({ address: "GMAINNET123456" });

    render(
      <ToastProvider>
        <WalletProvider>
          <TransactionSignerHarness walletNetwork="mainnet" />
        </WalletProvider>
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected-address")).toBeInTheDocument();
    });

    const signButton = screen.getByRole("button", {
      name: "Sign Transaction",
    });
    expect(signButton).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Sign flow — successful signing on matching network
  // -------------------------------------------------------------------------

  it("allows signing when networks match and transitions to signed status", async () => {
    kitState.authModal.mockResolvedValue({ address: "GTESTNET123456" });
    kitState.signTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr" });

    render(
      <ToastProvider>
        <WalletProvider>
          <TransactionSignerHarness walletNetwork="testnet" />
        </WalletProvider>
      </ToastProvider>
    );

    // Connect
    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("transaction-signer")).toBeInTheDocument();
    });

    // No warning bar when networks match
    expect(
      screen.queryByTestId("transaction-signer-network-warning-bar")
    ).not.toBeInTheDocument();

    // Sign — click and wait for status transition
    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("signed");
    });
  });

  // -------------------------------------------------------------------------
  // Disconnect clears state
  // -------------------------------------------------------------------------

  it("disconnect clears the wallet and hides the TransactionSigner", async () => {
    kitState.authModal.mockResolvedValue({ address: "GTESTNET123456" });
    kitState.disconnect.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <WalletProvider>
          <TransactionSignerHarness walletNetwork="testnet" />
        </WalletProvider>
      </ToastProvider>
    );

    // Connect
    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("transaction-signer")).toBeInTheDocument();
    });

    // Disconnect
    await act(async () => {
      screen.getByText("disconnect").click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("transaction-signer")).not.toBeInTheDocument();
    });

    // The connect button should be back
    expect(screen.getByText("connect")).toBeInTheDocument();
  });
});
