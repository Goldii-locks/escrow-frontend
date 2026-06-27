import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  it("uses semantic design tokens and keeps submit disabled for partial milestone data", () => {
    render(<CreateJob />);

    expect(screen.getByTestId("create-job-form-page")).toHaveClass("bg-surface-page");

    const freelancer = screen.getByLabelText("Freelancer Address");
    expect(freelancer).toHaveClass("bg-surface-field");
    expect(freelancer).toHaveClass("focus-visible:ring-accent-soft");

    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
    expect(
      screen.getByText("Complete each milestone amount to continue.")
    ).toBeInTheDocument();
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

  it("enables submit when required datasets are complete", () => {
    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "GFREELANCER" },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "GARBITER" },
    });
    fireEvent.change(screen.getByLabelText("Token Contract Address"), {
      target: { value: "CTOKEN" },
    });
    fireEvent.change(screen.getByLabelText("Milestone 1 amount"), {
      target: { value: "100" },
    });

    expect(screen.getByRole("button", { name: "Create Job" })).not.toBeDisabled();
  });
});
