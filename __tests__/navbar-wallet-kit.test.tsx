import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "@/app/components/Navbar";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
    { id: "xbull", label: "xBull" },
    { id: "hana", label: "Hana" },
  ],
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdminUser: false }),
}));

describe("Navbar wallet selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows wallet provider selector when disconnected", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      selectedWalletId: "freighter",
      setSelectedWalletId: vi.fn(),
    });

    render(<Navbar />);

    expect(screen.getByLabelText("Wallet provider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
  });

  it("updates selected wallet when changed", () => {
    const setSelectedWalletId = vi.fn();
    mockUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      selectedWalletId: "freighter",
      setSelectedWalletId,
    });

    render(<Navbar />);

    const select = screen.getByLabelText("Wallet provider") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "albedo" } });

    expect(setSelectedWalletId).toHaveBeenCalledWith("albedo");
  });
});
