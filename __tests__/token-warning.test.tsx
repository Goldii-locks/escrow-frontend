import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/(app)/create/page";

const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock the token validation so we can control the SEP-41 simulation result.
const mockValidateTokenContract = vi.fn();
vi.mock("@/app/lib/token_validation", () => ({
  validateTokenContract: (address: string) => mockValidateTokenContract(address),
}));

// A valid Stellar contract ID (C + 55 base32 chars).
const VALID_CONTRACT = "C" + "A".repeat(55);
const NON_TOKEN_CONTRACT = "C" + "B".repeat(55);
const WHITELISTED_TOKEN = "C" + "C".repeat(55);

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe("Create Job token warning (#668)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
    mockValidateTokenContract.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows no warning for a whitelisted token", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    render(<CreateJob />);

    // Wait for the whitelist to load.
    await screen.findByRole("option", { name: "USDC" });

    // Select the whitelisted token from the dropdown.
    const select = screen.getByLabelText("Token Contract Address", {
      selector: "select",
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: WHITELISTED_TOKEN } });

    // No warning should appear.
    expect(screen.queryByTestId("token-non-whitelist-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("token-validation-error")).not.toBeInTheDocument();
  });

  it("shows a warning and blocks until confirmed for a non-whitelisted token", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    // Simulate a valid SEP-41 token at a non-whitelisted address.
    mockValidateTokenContract.mockResolvedValue({
      valid: true,
      symbol: "USDC",
      decimals: 7,
    });

    render(<CreateJob />);
    await screen.findByRole("option", { name: "USDC" });

    // Enter a non-whitelisted contract address in the manual input.
    const manualInput = screen.getByLabelText("Token Contract Address", {
      selector: "input",
    });
    fireEvent.change(manualInput, { target: { value: VALID_CONTRACT } });

    // Advance past the debounce timer.
    await vi.advanceTimersByTimeAsync(600);

    // The warning should appear with the token info.
    await waitFor(() => {
      expect(screen.getByTestId("token-non-whitelist-warning")).toBeInTheDocument();
    });
    expect(screen.getByText(/Token: USDC \(7 decimals\)/)).toBeInTheDocument();

    // The confirmation checkbox should be present and unchecked.
    const checkbox = screen.getByTestId("token-confirm-checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Fill in remaining required fields so the only gate is the token confirm.
    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "G" + "F".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "G" + "B".repeat(55) },
    });
    fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
      target: { value: "100" },
    });
    // Tick the agreement checkbox.
    fireEvent.click(screen.getByTestId("agreement-checkbox"));

    const submitButton = screen.getByRole("button", { name: "Create Job" });
    expect(submitButton).toBeDisabled();

    // Confirm the non-whitelisted token.
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Now the submit button should be enabled.
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("shows an error for a non-token contract", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    // Simulate a failed SEP-41 validation (not a token contract).
    mockValidateTokenContract.mockResolvedValue({
      valid: false,
      error: "This contract does not implement the SEP-41 token interface.",
    });

    render(<CreateJob />);
    await screen.findByRole("option", { name: "USDC" });

    // Enter a non-token contract address.
    const manualInput = screen.getByLabelText("Token Contract Address", {
      selector: "input",
    });
    fireEvent.change(manualInput, { target: { value: NON_TOKEN_CONTRACT } });

    // Advance past the debounce timer.
    await vi.advanceTimersByTimeAsync(600);

    // The error should appear.
    await waitFor(() => {
      expect(screen.getByTestId("token-validation-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/not a valid token contract/i)).toBeInTheDocument();

    // No whitelist warning should be shown — only the error.
    expect(screen.queryByTestId("token-non-whitelist-warning")).not.toBeInTheDocument();
  });
});
