import { fireEvent, render, screen, within } from "@testing-library/react";
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

const mockSubmitContractTransaction = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/lib/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/transactions")>();
  return {
    ...actual,
    submitContractTransaction: (...args: unknown[]) =>
      mockSubmitContractTransaction(...args),
  };
});

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

    const scopeStep = screen.getByRole("tab", { name: /2. Scope/i });
    fireEvent.click(scopeStep);
    expect(scopeStep).toHaveAttribute("aria-selected", "true");
    expect(scopeStep).toHaveClass("border-accent-soft");
  });

  it("renders a milestone empty state and supports recovery action", () => {
    render(<CreateJob />);

    fireEvent.click(screen.getByRole("button", { name: "Add milestone" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No milestones available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add first milestone" }));
    expect(
      screen.getByLabelText("Milestone 1 amount in stroops")
    ).toBeInTheDocument();
  });

  it("renders asset and requirement placeholders for empty list data and recovers from them", () => {
    render(<CreateJob />);

    expect(screen.getByTestId("asset-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No accepted assets selected")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No delivery requirements added")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("asset-empty-state")).getByRole("button", {
        name: "Add accepted asset",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Add first requirement" }));

    expect(screen.getByLabelText("Accepted asset 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Requirement 1")).toBeInTheDocument();
  });

  it("enables submit when required datasets are complete", async () => {
    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "G" + "F".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "G" + "B".repeat(55) },
    });

    // Wait for the whitelist to load, then select the token from the dropdown.
    await screen.findByRole("option", { name: "USDC" });
    const tokenSelect = screen.getByLabelText("Token Contract Address", {
      selector: "select",
    }) as HTMLSelectElement;
    fireEvent.change(tokenSelect, { target: { value: "CTOKEN" } });
    expect(tokenSelect.value).toBe("CTOKEN");

    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });

    expect(screen.getByRole("button", { name: "Create Job" })).not.toBeDisabled();
  });

  it("renders milestone amount input as type=text with inputMode=decimal and shows inline errors immediately for 0, -1, 1e7, or abc, then submits valid values", async () => {
    mockSubmitContractTransaction.mockResolvedValue("tx_valid_123");
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "G" + "F".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "G" + "B".repeat(55) },
    });

    await screen.findByRole("option", { name: "USDC" });
    const tokenSelect = screen.getByLabelText("Token Contract Address", {
      selector: "select",
    }) as HTMLSelectElement;
    fireEvent.change(tokenSelect, { target: { value: "CTOKEN" } });

    const milestoneInput = screen.getByLabelText("Milestone 1 amount in stroops");
    expect(milestoneInput).toHaveAttribute("type", "text");
    expect(milestoneInput).toHaveAttribute("inputMode", "decimal");
    expect(milestoneInput).not.toHaveAttribute("step");
    expect(milestoneInput).not.toHaveAttribute("min");

    for (const invalidValue of ["0", "-1", "1e7", "abc"]) {
      fireEvent.change(milestoneInput, { target: { value: invalidValue } });
      expect(screen.getByTestId("milestone-error-0")).toBeInTheDocument();
      expect(milestoneInput).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
    }

    fireEvent.change(milestoneInput, { target: { value: "100" } });
    expect(screen.queryByTestId("milestone-error-0")).not.toBeInTheDocument();
    expect(milestoneInput).toHaveAttribute("aria-invalid", "false");

    const submitButton = screen.getByRole("button", { name: "Create Job" });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await screen.findByText(/Job Created!/i);
    expect(mockSubmitContractTransaction).toHaveBeenCalledTimes(1);
    expect(mockSubmitContractTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "initialize",
        args: expect.arrayContaining([
          {
            type: "vec",
            value: [{ type: "i128", value: "100" }],
          },
        ]),
      })
    );
  });
});
