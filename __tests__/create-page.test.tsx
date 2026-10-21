import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/(app)/create/page";

const mockPush = vi.fn();
const mockUseWallet = vi.fn();
const mockShowToast = vi.fn();
const mockSubmitContractTransaction = vi.fn();
const CLIENT_ADDRESS = `G${"C".repeat(55)}`;
const PLATFORM_ADMIN = `G${"A".repeat(55)}`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: (...args: unknown[]) => mockSubmitContractTransaction(...args),
}));

describe("Create page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitContractTransaction.mockResolvedValue("TX_HASH");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_ADMIN", PLATFORM_ADMIN);
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
    vi.stubGlobal("alert", vi.fn());
    mockUseWallet.mockReturnValue({
      address: CLIENT_ADDRESS,
      signTransaction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
    expect(screen.getByText("Complete each milestone amount to continue.")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Milestone 1 amount in stroops")).toBeInTheDocument();
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

    // The agreement checkbox (issue #669) must be ticked before Create is enabled.
    fireEvent.click(screen.getByTestId("agreement-checkbox"));

    expect(screen.getByRole("button", { name: "Create Job" })).not.toBeDisabled();
  });

  it("renders the success screen after a confirmed create and surfaces a toast instead of alert()", async () => {
    mockSubmitContractTransaction.mockResolvedValue("ABC123TXHASH");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "G" + "F".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "G" + "B".repeat(55) },
    });
    await screen.findByRole("option", { name: "USDC" });
    fireEvent.change(screen.getByLabelText("Token Contract Address", { selector: "select" }), {
      target: { value: "CTOKEN" },
    });
    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByTestId("agreement-checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Job" }));

    expect(await screen.findByText("Job Created!")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View transaction on Stellar Expert/ })
    ).toHaveAttribute("href", "https://stellar.expert/explorer/testnet/tx/ABC123TXHASH");
    expect(screen.getByRole("button", { name: "Go to Dashboard" })).toBeInTheDocument();
    expect(mockShowToast).toHaveBeenCalledWith("Job created successfully!", "success");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("passes the configured platform admin, not the client, as initialize admin", async () => {
    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: `G${"F".repeat(55)}` },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: `G${"B".repeat(55)}` },
    });
    await screen.findByRole("option", { name: "USDC" });
    fireEvent.change(
      screen.getByLabelText("Token Contract Address", { selector: "select" }),
      { target: { value: "CTOKEN" } },
    );
    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByTestId("agreement-checkbox"));

    fireEvent.submit(screen.getByTestId("create-job-form"));

    expect(mockSubmitContractTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "initialize",
        args: [
          { type: "address", value: PLATFORM_ADMIN },
          { type: "address", value: CLIENT_ADDRESS },
          { type: "address", value: `G${"F".repeat(55)}` },
          { type: "address", value: `G${"B".repeat(55)}` },
          { type: "address", value: "CTOKEN" },
          { type: "u64", value: "604800" },
          { type: "vec", value: [{ type: "i128", value: "100" }] },
        ],
      }),
    );
    expect(mockSubmitContractTransaction.mock.calls[0][0].args[0].value).not.toBe(
      CLIENT_ADDRESS,
    );
  });

  it("blocks submission when the platform admin matches the client", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_ADMIN", CLIENT_ADDRESS);
    render(<CreateJob />);

    expect(
      screen.getByText(
        "Platform administrator must be different from the connected client wallet.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
    fireEvent.submit(screen.getByTestId("create-job-form"));
    expect(mockSubmitContractTransaction).not.toHaveBeenCalled();
  });

  it("requires a configured platform admin", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_ADMIN", "");
    render(<CreateJob />);

    expect(
      screen.getByText(
        "Platform administrator is not configured. Set NEXT_PUBLIC_PLATFORM_ADMIN to a valid Stellar account before creating escrows.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
  });

  it("rejects a freelancer address that matches the client", () => {
    render(<CreateJob />);
    const freelancerInput = screen.getByLabelText("Freelancer Address");

    fireEvent.change(freelancerInput, { target: { value: CLIENT_ADDRESS } });

    expect(freelancerInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(
        "Freelancer address must be different from the client address.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
  });

  it("rejects an arbiter address that matches the client", () => {
    render(<CreateJob />);
    const arbiterInput = screen.getByLabelText("Arbiter Address");

    fireEvent.change(arbiterInput, { target: { value: CLIENT_ADDRESS } });

    expect(arbiterInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(
        "Arbiter address must be different from the client address.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
  });

  it("rejects matching freelancer and arbiter addresses", () => {
    render(<CreateJob />);
    const sharedAddress = `G${"F".repeat(55)}`;
    const freelancerInput = screen.getByLabelText("Freelancer Address");
    const arbiterInput = screen.getByLabelText("Arbiter Address");

    fireEvent.change(freelancerInput, { target: { value: sharedAddress } });
    fireEvent.change(arbiterInput, { target: { value: sharedAddress } });

    expect(freelancerInput).toHaveAttribute("aria-invalid", "true");
    expect(arbiterInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getAllByText(
        "Freelancer and arbiter addresses must be different.",
      ),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
  });

  it("validates a configured default arbiter against the freelancer", () => {
    const defaultArbiter = `G${"F".repeat(55)}`;
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", defaultArbiter);
    render(<CreateJob />);

    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: defaultArbiter },
    });

    expect(
      screen.getAllByText(
        "Freelancer and arbiter addresses must be different.",
      ),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
  });
});
