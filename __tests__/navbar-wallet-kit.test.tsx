// @vitest-environment jsdom
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

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdminUser: false }),
}));

describe("Navbar wallet selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Milestone logo and product name as the brand", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      networkMismatchMessage: null,
      selectedWalletId: "freighter",
      setSelectedWalletId: vi.fn(),
    });

    render(<Navbar />);

    const brandLink = screen.getByRole("link", { name: "Milestone home" });
    expect(brandLink).toBeInTheDocument();
    // The logo is an inline SVG with aria-hidden, so the accessible name
    // comes from the "Milestone" text node.
    expect(brandLink).toHaveTextContent("Milestone");
    // The padlock emoji must not be present.
    expect(brandLink).not.toHaveTextContent("🔐");
    expect(brandLink).not.toHaveTextContent("Escrow");
    // The LandingLogo SVG should be rendered inside the link.
    expect(brandLink.querySelector("svg")).not.toBeNull();
  });

  it("opens the wallet selector modal when Connect Wallet is clicked", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      networkMismatchMessage: null,
      selectedWalletId: "freighter",
      setSelectedWalletId: vi.fn(),
    });

    render(<Navbar />);

    expect(screen.queryByLabelText("Wallet provider")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an install link when no wallet extension is detected", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      networkMismatchMessage: null,
      selectedWalletId: "freighter",
      setSelectedWalletId: vi.fn(),
    });

    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(screen.getByRole("link", { name: /install/i })).toHaveAttribute("href");
  });

  it("displays network mismatch warning when provided", () => {
    mockUseWallet.mockReturnValue({
      address: "G1234567890",
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      networkMismatchMessage:
        "Network mismatch: your Freighter is on Mainnet but this app expects Stellar Testnet.",
      selectedWalletId: "freighter",
      setSelectedWalletId: vi.fn(),
    });

    render(<Navbar />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Network mismatch/)).toBeInTheDocument();
  });
});
