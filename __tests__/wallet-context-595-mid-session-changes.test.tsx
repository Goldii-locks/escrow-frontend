/**
 * Tests for issue #595 — mid-session wallet changes must be detected and
 * surfaced through the WalletContext.
 *
 * Acceptance criteria (from the issue):
 *  - An address change updates context and shows a "Switched to G…" toast.
 *  - A network change shows the mismatch banner.
 *  - A mismatch at sign time aborts with a clear "Wallet account changed" message.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { ToastProvider } from "@/app/context/ToastContext";
import { freighterActiveAddress } from "@/app/lib/wallet_session";

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

vi.mock("@/app/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/config")>()),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
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

// ── toast mock (capture calls for assertions) ──────────────────────────────

const showToastMock = vi.fn();

vi.mock("@/app/context/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/context/ToastContext")>()),
  useToast: () => ({ showToast: showToastMock }),
}));

// ── test harness ───────────────────────────────────────────────────────────

function WalletHarness() {
  const { address, networkMismatchMessage, connect, signTransaction, setSelectedWalletId } =
    useWallet();

  const handleSign = () => {
    void signTransaction("some-xdr").catch((e: Error) => {
      const el = document.getElementById("sign-error");
      if (el) el.textContent = e.message;
    });
  };

  return (
    <div>
      <div data-testid="address">{address ?? "none"}</div>
      <div data-testid="mismatch">{networkMismatchMessage ?? "none"}</div>
      <button onClick={() => void connect()}>connect</button>
      <button onClick={() => setSelectedWalletId("albedo")}>select-albedo</button>
      <button onClick={handleSign}>sign</button>
      <div id="sign-error" data-testid="sign-error" />
    </div>
  );
}

function renderWithProviders() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>
    </ToastProvider>
  );
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("#595 — mid-session wallet changes are detected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default: wallet and app are both on testnet — no mismatch.
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    kitState.getAddress.mockResolvedValue({ address: "GORIGINALADDRESS" });
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  // ── address change ─────────────────────────────────────────────────────

  it("address change: context address updates and a 'Switched to…' toast appears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderWithProviders();

    // Connect the wallet.
    kitState.authModal.mockResolvedValue({ address: "GORIGINALADDRESS" });
    screen.getByText("connect").click();

    // Flush connect's async work.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GORIGINALADDRESS");

    // Simulate the user switching accounts in Freighter mid-session. Only
    // Freighter's silently cached active account is polled; getAddress()
    // would open a prompt in other wallets.
    vi.mocked(freighterActiveAddress.getActiveAddress).mockReturnValue({
      address: "GNEWADDRESS1234",
    } as ReturnType<typeof freighterActiveAddress.getActiveAddress>);

    // Advance past the 3-second polling interval and flush async work.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    // The context address must update to the new account.
    expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS1234");

    // A "Switched to…" toast must have been shown.
    const toastMessages = showToastMock.mock.calls.map((c) => String(c[0]));
    const switchedToast = toastMessages.find((m) => m.toLowerCase().includes("switched"));
    expect(switchedToast).toBeDefined();
  });

  it("never polls getAddress() for wallets where it opens a prompt (Albedo)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders();

    await act(async () => {
      screen.getByText("select-albedo").click();
    });
    kitState.authModal.mockResolvedValue({ address: "GORIGINALADDRESS" });
    screen.getByText("connect").click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GORIGINALADDRESS");
    const callsAfterConnect = kitState.getAddress.mock.calls.length;

    // Several polling intervals pass; Albedo's getAddress() opens a popup,
    // so the poll must not call it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(kitState.getAddress.mock.calls.length).toBe(callsAfterConnect);
  });

  // ── network change ─────────────────────────────────────────────────────

  it("network change: shows the mismatch banner when the wallet moves to a different network", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderWithProviders();

    kitState.authModal.mockResolvedValue({ address: "GORIGINALADDRESS" });
    screen.getByText("connect").click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GORIGINALADDRESS");

    // No banner yet — wallet and app are on the same network.
    expect(screen.getByTestId("mismatch")).toHaveTextContent("none");

    // Simulate the wallet switching to mainnet mid-session.
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    // The mismatch banner must appear.
    const msg = screen.getByTestId("mismatch").textContent ?? "";
    expect(msg).not.toBe("none");
    expect(msg).toContain("Please switch networks");
  });

  // ── sign-time assertion ────────────────────────────────────────────────

  it("sign time: signTransaction aborts with 'Wallet account changed' if address drifts", async () => {
    renderWithProviders();

    // Connect as GORIGINALADDRESS.
    kitState.authModal.mockResolvedValue({ address: "GORIGINALADDRESS" });
    await act(async () => {
      screen.getByText("connect").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GORIGINALADDRESS");
    });

    // The wallet now reports a DIFFERENT address (user switched between
    // building the transaction and signing it).
    vi.mocked(freighterActiveAddress.getActiveAddress).mockReturnValue({
      address: "GSWITCHEDADDRESS",
    } as ReturnType<typeof freighterActiveAddress.getActiveAddress>);

    await act(async () => {
      screen.getByText("sign").click();
      // Allow async pre-sign assertion to complete.
      await new Promise((r) => setTimeout(r, 200));
    });

    await waitFor(() => {
      const err = screen.getByTestId("sign-error").textContent ?? "";
      expect(err).toContain("Wallet account changed");
      // Truncated original address.
      expect(err).toContain("GORI");
      // Truncated switched-to address.
      expect(err).toContain("GSWI");
    });

    // The underlying kit signTransaction must NOT have been called.
    expect(kitState.signTransaction).not.toHaveBeenCalled();
  });
});
