/**
 * LandingNav regression tests.
 *
 * The landing redesign took its nav styling from design/landing-reference.html,
 * which shows a marketing-only bar with no wallet controls. These tests pin the
 * requirement that the working controls survived that redesign: the notification
 * bell must still be mounted and still open its dropdown, and the wallet
 * selector plus Connect Wallet must still be present and still call into the
 * wallet context.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import LandingNav from "../LandingNav";

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

describe("LandingNav keeps the working controls", () => {
  it("mounts the notification bell", () => {
    render(<LandingNav />);
    expect(screen.getByRole("button", { name: /notification/i })).toBeInTheDocument();
  });

  it("opens the notification dropdown when the bell is clicked", () => {
    render(<LandingNav />);
    const bell = screen.getByRole("button", { name: /notification/i });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the wallet selector with every supported wallet", () => {
    render(<LandingNav />);
    const select = screen.getByLabelText("Wallet provider");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Freighter", "Albedo", "xBull", "Hana"]);
  });

  it("changing the wallet selector calls into the wallet context", () => {
    render(<LandingNav />);
    fireEvent.change(screen.getByLabelText("Wallet provider"), {
      target: { value: "albedo" },
    });
    expect(setSelectedWalletId).toHaveBeenCalledWith("albedo");
  });

  it("Connect Wallet is a real button and calls connect()", () => {
    render(<LandingNav />);
    const button = screen.getByRole("button", { name: "Connect Wallet" });
    fireEvent.click(button);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("shows Disconnect instead once an address is connected", () => {
    walletState.address = "GAODBHVR63Z56MVQRBEJSYM2H5423LJ4WAPUUBOFG4JYY72S6ROKVZRX";
    render(<LandingNav />);
    const button = screen.getByRole("button", { name: "Disconnect" });
    fireEvent.click(button);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
  });

  it("Launch App points at /dashboard", () => {
    render(<LandingNav />);
    const links = screen.getAllByRole("link", { name: /launch app/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/dashboard");
  });

  it("the marketing menu button is a real button with expanded state", () => {
    render(<LandingNav />);
    const menu = screen.getByRole("button", { name: /open menu/i });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(screen.getByRole("button", { name: /close menu/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
