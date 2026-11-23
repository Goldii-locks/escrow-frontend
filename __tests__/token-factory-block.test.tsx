// @vitest-environment jsdom
/**
 * Tests for the factory-configured token hard-block (issue #833).
 *
 * When FACTORY_CONTRACT_ID is set, any token not on the factory's allowed list
 * must be blocked outright — no SEP-41 confirmation path is offered.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock FACTORY_CONTRACT_ID as non-empty before importing anything ───────────
const FACTORY = "CFACTORY000000000000000000000000000000000000000000000001";

vi.mock("@/app/lib/transactions", () => ({
  CONTRACT_ID: FACTORY,
  FACTORY_CONTRACT_ID: FACTORY,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

const mockUseWallet = vi.fn();
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

// SEP-41 validation should never be called on the factory path.
const mockValidateTokenContract = vi.fn();
vi.mock("@/app/lib/token_validation", () => ({
  validateTokenContract: (...args: unknown[]) => mockValidateTokenContract(...args),
}));

// ── import page after mocks ───────────────────────────────────────────────────
import CreateJob from "@/app/(app)/create/page";

// ── constants ─────────────────────────────────────────────────────────────────

const WHITELISTED_TOKEN = "CBBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUHSPU";
const UNLISTED_TOKEN = "CBAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUDN7R";

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("Create Job factory token hard-block (#833)", () => {
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

  it("shows no warning for a token on the factory's allowed list", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    render(<CreateJob />);

    await screen.findByRole("option", { name: "USDC" });

    const select = screen.getByLabelText("Token Contract Address", {
      selector: "select",
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: WHITELISTED_TOKEN } });

    expect(screen.queryByTestId("token-not-accepted")).not.toBeInTheDocument();
    expect(screen.queryByTestId("token-non-whitelist-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("token-confirm-checkbox")).not.toBeInTheDocument();
  });

  it("blocks with a hard error (no checkbox) for an unlisted token", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    render(<CreateJob />);

    await screen.findByRole("option", { name: "USDC" });

    const manualInput = screen.getByLabelText("Token Contract Address", {
      selector: "input",
    });
    fireEvent.change(manualInput, { target: { value: UNLISTED_TOKEN } });

    // The hard-block panel should appear immediately — no debounce needed.
    await waitFor(() => {
      expect(screen.getByTestId("token-not-accepted")).toBeInTheDocument();
    });
    expect(screen.getByText(/This token isn't accepted for new escrows/i)).toBeInTheDocument();

    // No confirm checkbox — the user must not be able to proceed.
    expect(screen.queryByTestId("token-confirm-checkbox")).not.toBeInTheDocument();

    // SEP-41 validation must NOT have been called.
    await vi.runAllTimersAsync();
    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });

  it("keeps the submit button disabled for an unlisted token", async () => {
    stubFetch({
      success: true,
      data: { tokens: [{ address: WHITELISTED_TOKEN, symbol: "USDC" }] },
    });
    render(<CreateJob />);

    await screen.findByRole("option", { name: "USDC" });

    const manualInput = screen.getByLabelText("Token Contract Address", {
      selector: "input",
    });
    fireEvent.change(manualInput, { target: { value: UNLISTED_TOKEN } });

    // Fill in all other required fields so the token is the only gate.
    fireEvent.change(screen.getByLabelText("Freelancer Address"), {
      target: { value: "GBDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMGSF" },
    });
    fireEvent.change(screen.getByLabelText("Arbiter Address"), {
      target: { value: "GBBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEFZSP" },
    });
    fireEvent.change(screen.getByLabelText("Milestone 1 amount"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByTestId("agreement-checkbox"));

    const submitButton = screen.getByRole("button", { name: "Create Job" });
    expect(submitButton).toBeDisabled();
  });
});
