import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const DEFAULT_ARBITER = "G" + "D".repeat(55);
const mockSubmit = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({ address: "G" + "C".repeat(55), signTransaction: vi.fn() }),
}));

vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: mockSubmit,
}));

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Freelancer Address"), {
    target: { value: "G" + "F".repeat(55) },
  });
  await screen.findByRole("option", { name: "USDC" });
  fireEvent.change(screen.getByLabelText("Token Contract Address", { selector: "select" }), {
    target: { value: "CTOKEN" },
  });
  fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
    target: { value: "100" },
  });
}

function submittedArbiter() {
  return mockSubmit.mock.calls[0][0].args[3].value;
}

describe("Create form arbiter selector (Issue #658)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue("txhash");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { tokens: [{ address: "CTOKEN", symbol: "USDC" }] } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("pre-selects the platform arbiter when configured and submits it", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", DEFAULT_ARBITER);
    render(<CreateJob />);

    expect(screen.getByLabelText("Milesto arbitration (recommended)")).toBeChecked();
    expect(screen.queryByLabelText("Arbiter Address")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/#security");

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create Job" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(submittedArbiter()).toBe(DEFAULT_ARBITER);
  });

  it("validates and submits a custom arbiter address", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", DEFAULT_ARBITER);
    render(<CreateJob />);

    fireEvent.click(screen.getByLabelText("Custom address"));
    const input = screen.getByLabelText("Arbiter Address");
    fireEvent.change(input, { target: { value: "not-a-key" } });
    expect(screen.getByText("Invalid Stellar public key format")).toBeInTheDocument();

    const custom = "G" + "B".repeat(55);
    fireEvent.change(input, { target: { value: custom } });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create Job" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(submittedArbiter()).toBe(custom);
  });

  it("shows only the custom address field when no default is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", "");
    render(<CreateJob />);

    expect(screen.queryByLabelText("Milesto arbitration (recommended)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Arbiter Address")).toBeInTheDocument();
  });
});
