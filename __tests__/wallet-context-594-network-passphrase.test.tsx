/**
 * Tests for issue #594 — WalletContext must derive the kit init network and
 * the wallet-mismatch message from NETWORK_PASSPHRASE rather than hard-coding
 * Networks.TESTNET / "Testnet".
 *
 * Acceptance criteria (from the issue):
 *  - There is no Networks.TESTNET or literal "Testnet" in WalletContext.tsx.
 *  - A mainnet-passphrase build tells testnet wallets to switch to Mainnet.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { ToastProvider } from "@/app/context/ToastContext";

// ── kit mock ───────────────────────────────────────────────────────────────

const kitState = {
  init: vi.fn(),
  getAddress: vi.fn(),
  authModal: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  disconnect: vi.fn(),
  setWallet: vi.fn(),
};

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: {
    TESTNET: "Test SDF Network ; September 2015",
    PUBLIC: "Public Global Stellar Network ; September 2015",
    FUTURENET: "Test SDF Future Network ; October 2022",
  },
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

// Simulate a MAINNET build: NETWORK_PASSPHRASE = Public Global Stellar Network.
vi.mock("@/app/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/config")>()),
  NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
}));

// network_config is the source of truth for NETWORK_PASSPHRASE in network.ts;
// override it so buildNetworkMismatchMessage/assertWalletNetwork use mainnet too.
vi.mock("@/app/lib/network_config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/network_config")>()),
  NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
}));

vi.mock("@/app/lib/wallet_session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/wallet_session")>()),
  freighterActiveAddress: {
    getActiveAddress: vi.fn(() => null),
    setActiveAddress: vi.fn(),
    clear: vi.fn(),
  },
  verifyAndRehydrateFreighterAddress: vi.fn(async () => null),
}));

// ── harness ────────────────────────────────────────────────────────────────

function NetworkHarness() {
  const { networkMismatchMessage, connect } = useWallet();
  return (
    <div>
      <div data-testid="mismatch">{networkMismatchMessage ?? "none"}</div>
      <button onClick={() => void connect()}>connect</button>
    </div>
  );
}

function renderWithProviders() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <NetworkHarness />
      </WalletProvider>
    </ToastProvider>
  );
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("#594 — network passphrase propagated to kit init and mismatch message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Wallet is on testnet; app is on mainnet (mocked above).
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    kitState.authModal.mockResolvedValue({ address: "GMAINNETUSER" });
    kitState.getAddress.mockResolvedValue({ address: undefined });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("initialises the kit with the PUBLIC network on a mainnet build", async () => {
    renderWithProviders();

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(kitState.init).toHaveBeenCalled();
    });

    const initArgs = kitState.init.mock.calls[0][0] as { network: string };
    // The kit must be initialised with the mainnet passphrase, not the testnet one.
    expect(initArgs.network).toBe("Public Global Stellar Network ; September 2015");
    expect(initArgs.network).not.toBe("Test SDF Network ; September 2015");
  });

  it("shows the correct mismatch message when the wallet is on testnet but the app is on mainnet", async () => {
    renderWithProviders();

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      const msg = screen.getByTestId("mismatch").textContent ?? "";
      expect(msg).not.toBe("none");
    });

    const msg = screen.getByTestId("mismatch").textContent ?? "";
    // Must mention Mainnet (app expectation), not Testnet.
    expect(msg).toContain("Mainnet");
    // Must NOT say "expects Stellar Testnet" — that was the wrong message.
    expect(msg).not.toMatch(/expects Stellar Testnet/i);
    // Should tell the user to switch networks.
    expect(msg).toContain("Please switch networks");
  });

  it("shows no mismatch message when the wallet is on mainnet and the app is on mainnet", async () => {
    // Wallet now reports mainnet too.
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    renderWithProviders();

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(kitState.getNetwork).toHaveBeenCalled();
    });

    expect(screen.getByTestId("mismatch")).toHaveTextContent("none");
  });
});
