import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/(app)/create/page";

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

describe("Create Job agreement panel (#669)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { tokens: [{ address: "CTOKEN", symbol: "USDC" }] },
        }),
      })
    );
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the agreement panel with form-derived auto-release days and arbiter", () => {
    render(<CreateJob />);

    // The panel is in the review section, which is always rendered.
    expect(screen.getByTestId("agreement-panel")).toBeInTheDocument();

    // The default auto-release days is 7 — scope to the panel to avoid
    // matching the deadline hint outside it.
    const panel = screen.getByTestId("agreement-panel");
    expect(within(panel).getByText(/7 days/)).toBeInTheDocument();

    // Change the arbiter and auto-release days, then verify the panel reflects them.
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "G" + "B".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Response Deadline (days)"), {
      target: { value: "14" },
    });

    expect(within(panel).getByText(/14 days/)).toBeInTheDocument();
    expect(within(panel).getByText(/GBBBBBBBBB/)).toBeInTheDocument();
  });

  it("keeps Create disabled until the agreement checkbox is ticked", async () => {
    render(<CreateJob />);

    // Fill in all required fields so the only remaining gate is the checkbox.
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

    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });

    // All fields are complete but the checkbox is not checked yet.
    const submitButton = screen.getByRole("button", { name: "Create Job" });
    expect(submitButton).toBeDisabled();

    // Tick the agreement checkbox.
    const checkbox = screen.getByTestId("agreement-checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Now Create should be enabled.
    expect(submitButton).not.toBeDisabled();
  });

  it("shows a hint message when everything is valid but the checkbox is not checked", async () => {
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

    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });

    expect(
      screen.getByText("Confirm the agreement in the review step to create a job.")
    ).toBeInTheDocument();
  });
});
