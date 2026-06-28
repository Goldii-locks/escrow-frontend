import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const mockPush = vi.fn();
const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("Create page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [{ address: "CTOKEN", symbol: "USDC" }] }),
      }),
    );
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses semantic design tokens and keeps submit disabled for partial milestone data", () => {
    render(<CreateJob />);

    expect(screen.getByTestId("create-job-form-page")).toHaveClass("bg-surface-page");

    const freelancer = screen.getByLabelText("Freelancer Address");
    expect(freelancer).toHaveClass("bg-surface-field");
    expect(freelancer).toHaveClass("focus-visible:ring-accent-soft");
    expect(freelancer).toHaveClass("hover:border-accent-soft");

    const submitButton = screen.getByRole("button", { name: "Create Job" });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass("disabled:cursor-not-allowed");
    expect(
      screen.getByText("Complete each milestone amount to continue.")
    ).toBeInTheDocument();
  });

  it("supports keyboard focus cues and wizard section selection", () => {
    render(<CreateJob />);

    const freelancer = screen.getByLabelText("Freelancer Address");
    freelancer.focus();

    expect(freelancer).toHaveFocus();
    expect(freelancer).toHaveClass("focus-visible:ring-2");

    const scopeStep = screen.getByRole("button", { name: /2. Scope/i });
    fireEvent.click(scopeStep);
    expect(scopeStep).toHaveAttribute("aria-pressed", "true");
    expect(scopeStep).toHaveClass("border-accent-soft");
  });

  it("renders a milestone empty state and supports recovery action", () => {
    render(<CreateJob />);

    fireEvent.click(screen.getByRole("button", { name: "+ Add Milestone" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No milestones available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add first milestone" }));
    expect(screen.getByLabelText("Milestone 1 amount")).toBeInTheDocument();
  });

  it("renders asset and requirement placeholders for empty list data and recovers from them", () => {
    render(<CreateJob />);

    expect(screen.getByTestId("asset-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No accepted assets selected")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No delivery requirements added")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add accepted asset" }));
    fireEvent.click(screen.getByRole("button", { name: "Add first requirement" }));

    expect(screen.getByLabelText("Accepted asset 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Requirement 1")).toBeInTheDocument();
  });

  it("enables submit when required datasets are complete", async () => {
    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "GFREELANCER" },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "GARBITER" },
    });

    // Wait for the whitelist to load, then select the token from the dropdown.
    await screen.findByRole("option", { name: "USDC" });
    const tokenSelect = screen.getByLabelText("Token Contract Address") as HTMLSelectElement;
    fireEvent.change(tokenSelect, { target: { value: "CTOKEN" } });
    expect(tokenSelect.value).toBe("CTOKEN");

    fireEvent.change(screen.getByLabelText("Milestone 1 amount"), {
      target: { value: "100" },
    });

    expect(screen.getByRole("button", { name: "Create Job" })).not.toBeDisabled();
  });
});
