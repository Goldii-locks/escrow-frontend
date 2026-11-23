import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "@/app/components/Navbar";

const mockUseWallet = vi.hoisted(() => vi.fn());
const mockUseArbiterDisputes = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [{ id: "freighter", label: "Freighter" }],
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdminUser: false }),
}));

vi.mock("@/app/hooks/useArbiterDisputes", () => ({
  useArbiterDisputes: (address: string | null) => mockUseArbiterDisputes(address),
}));

function connect(address: string | null) {
  mockUseWallet.mockReturnValue({
    address,
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnecting: false,
    networkMismatchMessage: null,
    selectedWalletId: "freighter",
    setSelectedWalletId: vi.fn(),
  });
}

function disputes(count: number) {
  mockUseArbiterDisputes.mockReturnValue({
    entries: Array.from({ length: count }, (_, i) => ({
      jobId: `job-${i}`,
      milestoneIndex: 0,
    })),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Navbar arbitration link and badge (#881)", () => {
  it("links to the arbitration view with a dispute count badge", () => {
    connect("GARBITER");
    disputes(3);

    render(<Navbar />);

    const link = screen.getByRole("link", {
      name: "Arbitration (3 disputes awaiting decision)",
    });
    expect(link).toHaveAttribute("href", "/arbitrate");
    expect(screen.getByTestId("arbitration-nav-badge")).toHaveTextContent("3");
    expect(mockUseArbiterDisputes).toHaveBeenCalledWith("GARBITER");
  });

  it("uses singular wording for a single dispute", () => {
    connect("GARBITER");
    disputes(1);

    render(<Navbar />);

    expect(
      screen.getByRole("link", {
        name: "Arbitration (1 dispute awaiting decision)",
      }),
    ).toBeInTheDocument();
  });

  it("shows the link without a badge when there are no disputes", () => {
    connect("GARBITER");
    disputes(0);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Arbitration" })).toHaveAttribute(
      "href",
      "/arbitrate",
    );
    expect(screen.queryByTestId("arbitration-nav-badge")).not.toBeInTheDocument();
  });

  it("hides the arbitration link when no wallet is connected", () => {
    connect(null);
    disputes(0);

    render(<Navbar />);

    expect(screen.queryByRole("link", { name: /arbitration/i })).not.toBeInTheDocument();
  });
});