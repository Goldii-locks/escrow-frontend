/**
 * Issue #279 – Handle mobile viewports navigation styling in loading_spinner_skeleton
 *
 * Verifies the skeleton is height-constrained and internally scrollable on
 * small screens (rather than pushing surrounding controls off-screen), and
 * that it never traps pointer events so other elements stay clickable on
 * mobile viewports.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import Dashboard from "@/app/dashboard/page";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

describe("LoadingSkeleton – mobile viewport constraints (issue #279)", () => {
  it("caps height on mobile with max-h-[70vh] and scrolls internally", () => {
    render(<LoadingSkeleton />);
    const wrapper = screen.getByTestId("loading-skeleton-mobile-wrapper");
    expect(wrapper).toHaveClass("max-h-[70vh]");
    expect(wrapper).toHaveClass("overflow-y-auto");
  });

  it("removes the height cap on larger viewports (sm:max-h-none)", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("loading-skeleton-mobile-wrapper")).toHaveClass(
      "sm:max-h-none"
    );
  });

  it("contains overscroll within the wrapper instead of the page (overscroll-contain)", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("loading-skeleton-mobile-wrapper")).toHaveClass(
      "overscroll-contain"
    );
  });

  it("does not use fixed/absolute positioning that would trap pointer events", () => {
    render(<LoadingSkeleton />);
    const root = screen.getByTestId("loading-skeleton");
    expect(root).not.toHaveClass("fixed");
    expect(root).not.toHaveClass("absolute");
  });
});

describe("Dashboard – surrounding controls stay clickable while the skeleton is visible (issue #279)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });

  it("keeps role-filter buttons enabled and clickable while the loading skeleton is displayed", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();

    const clientFilter = screen.getByRole("button", { name: "As Client" });
    expect(clientFilter).not.toBeDisabled();

    fireEvent.click(clientFilter);
    expect(clientFilter).toHaveAttribute("aria-pressed", "true");
  });
});
