import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

describe("Dashboard – disconnected wallet state", () => {
  const connect = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      connect,
      isConnecting: false,
    });
  });

  it("renders a connect button that triggers connect()", () => {
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-connect-wallet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("links to the onboarding steps", () => {
    render(<Dashboard />);

    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/#how-it-works"
    );
  });

  it("disables the button while connecting", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
      connect,
      isConnecting: true,
    });
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
  });
});
