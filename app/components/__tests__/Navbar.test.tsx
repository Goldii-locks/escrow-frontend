/**
 * Navbar regression tests.
 *
 * These moved here from LandingNav.test.tsx when the notification bell and the
 * wallet controls were taken off the public marketing nav. Navbar is the nav
 * for every signed-in route (/dashboard, /create, /admin), so this is where
 * those controls now have to keep working.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Navbar from "../Navbar";

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

  it("renders the wallet selector with every supported wallet", () => {
    render(<Navbar />);
    const select = screen.getByRole("combobox", { name: "Wallet provider" });
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Freighter", "Albedo", "xBull", "Hana"]);
  });

  it("changing the wallet selector calls into the wallet context", () => {
    render(<Navbar />);
    fireEvent.change(screen.getByRole("combobox", { name: "Wallet provider" }), {
      target: { value: "albedo" },
    });
    expect(setSelectedWalletId).toHaveBeenCalledWith("albedo");
  });

  it("Connect Wallet is a real button and calls connect()", () => {
    render(<Navbar />);
    const button = screen.getByRole("button", { name: "Connect Wallet" });
    fireEvent.click(button);
    expect(connect).toHaveBeenCalledTimes(1);
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
