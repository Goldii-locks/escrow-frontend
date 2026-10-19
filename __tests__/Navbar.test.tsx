/**
 * Navbar regression tests.
 *
 * These moved here from LandingNav.test.tsx when the notification bell and the
 * wallet controls were taken off the public marketing nav. Navbar is the nav
 * for every signed-in route (/dashboard, /create, /admin), so this is where
 * those controls now have to keep working.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import Navbar from "@/app/components/Navbar";

const connect = vi.fn();
const disconnect = vi.fn();
const setSelectedWalletId = vi.fn();

let walletState: Record<string, unknown>;

vi.mock("@/app/context/WalletContext", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/app/context/WalletContext",
  );
  return {
    ...actual,
    useWallet: () => walletState,
  };
});

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdminUser: false }),
}));

beforeEach(() => {
  connect.mockClear();
  disconnect.mockClear();
  setSelectedWalletId.mockClear();
  walletState = {
    address: null,
    connect,
    disconnect,
    isConnecting: false,
    networkMismatchMessage: null,
    selectedWalletId: "freighter",
    setSelectedWalletId,
  };
});

describe("Navbar owns the bell and the wallet controls", () => {
  it("mounts the notification bell", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: /notification/i })).toBeInTheDocument();
  });

  it("opens the notification dropdown when the bell is clicked", () => {
    render(<Navbar />);
    const bell = screen.getByRole("button", { name: /notification/i });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");
  });

  it("Connect Wallet opens the selector modal listing every supported wallet (#611)", () => {
    render(<Navbar />);
    expect(screen.queryByRole("combobox", { name: "Wallet provider" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    const dialog = screen.getByRole("dialog", { name: "Select Wallet" });
    const list = within(dialog).getByTestId("wallet-selector-list");
    const ids = within(list)
      .getAllByRole("button")
      .map((b) => b.getAttribute("data-testid"));
    expect(ids).toEqual([
      "wallet-selector-option-freighter",
      "wallet-selector-option-albedo",
      "wallet-selector-option-xbull",
      "wallet-selector-option-hana",
      "wallet-selector-option-lobstr",
    ]);
    expect(connect).not.toHaveBeenCalled();
  });

  it("picking a wallet selects it and connects that wallet", async () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    fireEvent.click(screen.getByTestId("wallet-selector-option-albedo"));

    await waitFor(() => expect(connect).toHaveBeenCalledWith("albedo"));
    expect(setSelectedWalletId).toHaveBeenCalledWith("albedo");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Select Wallet" })).not.toBeInTheDocument();
  });

  it("shows Disconnect instead once an address is connected", () => {
    walletState.address = "GAODBHVR63Z56MVQRBEJSYM2H5423LJ4WAPUUBOFG4JYY72S6ROKVZRX";
    render(<Navbar />);
    const button = screen.getByRole("button", { name: "Disconnect" });
    fireEvent.click(button);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
  });

  it("surfaces a network mismatch as an alert", () => {
    walletState.networkMismatchMessage = "Wallet is on PUBLIC, app expects TESTNET";
    render(<Navbar />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Wallet is on PUBLIC, app expects TESTNET/,
    );
  });
});
