// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(app)/admin/page";
import {
  getAddStatusBadge,
  getTokenStatusBadge,
  mapWhitelistResponse,
  sanitizeDisplayText,
  sanitizeTokenAddress,
} from "@/app/lib/admin_whitelist_panel";

const mockSubmit = vi.hoisted(() => vi.fn());
const mockValidateTokenContract = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/token_validation", () => ({
  validateTokenContract: mockValidateTokenContract,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/components/Navbar", () => ({ default: () => <div /> }));
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({ address: "GADMIN123", signTransaction: vi.fn() }),
}));
vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ loading: false, isAdminUser: true }),
}));
vi.mock("@/app/lib/transactions", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: mockSubmit,
}));

const MOCK_DATASET = {
  success: true,
  data: [
    { address: "CUSDC", symbol: "USDC", name: "USD Coin" },
    { token: "CXLM", name: "Lumens" },
    "CPLAIN",
  ],
};

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe("sanitization (#432)", () => {
  it("strips stray characters", () => {
    expect(sanitizeTokenAddress(" CAB C-12$3 ")).toBe("CABC123");
    expect(sanitizeDisplayText("<b>USDC</b>\u0000")).toBe("USDC");
  });
});

describe("token address validation (#873)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTokenContract.mockResolvedValue({
      valid: true,
      symbol: "USDC",
      decimals: 7,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects an invalid-checksum contract address inline", async () => {
    stubFetch({ success: true, data: [] });
    render(<AdminPage />);

    const input = await screen.findByLabelText(/token contract address/i);
    fireEvent.change(input, { target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } });

    expect(await screen.findByText(/invalid contract address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to whitelist/i })).toBeDisabled();
    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });

  it("shows a warning and blocks submit for a non-token contract", async () => {
    mockValidateTokenContract.mockResolvedValue({
      valid: false,
      error: "Not a SEP-41 token",
    });
    stubFetch({ success: true, data: [] });
    render(<AdminPage />);

    const input = await screen.findByLabelText(/token contract address/i);
    fireEvent.change(input, {
      target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
    });

    expect(await screen.findByText(/not a sep-41 token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to whitelist/i })).toBeDisabled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("shows symbol and decimals before enabling Add", async () => {
    stubFetch({ success: true, data: [] });
    render(<AdminPage />);

    const input = await screen.findByLabelText(/token contract address/i);
    fireEvent.change(input, {
      target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
    });

    expect(await screen.findByText(/USDC \(7 decimals\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to whitelist/i })).toBeEnabled();
  });
});

describe("backend data mapping (#433)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("maps the supported payload shapes and drops junk", () => {
    expect(mapWhitelistResponse(MOCK_DATASET)).toEqual([
      { address: "CUSDC", symbol: "USDC", name: "USD Coin" },
      { address: "CXLM", name: "Lumens" },
      { address: "CPLAIN" },
    ]);
    expect(mapWhitelistResponse({ tokens: ["CA", "CA", "<b>", 5] })).toEqual([{ address: "CA" }]);
    expect(mapWhitelistResponse({ error: "nope" })).toBeNull();
  });

  it("renders values loaded from the mock dataset", async () => {
    stubFetch(MOCK_DATASET);
    render(<AdminPage />);
    expect(await screen.findByText("CUSDC")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("Lumens")).toBeInTheDocument();
    expect(screen.getByText("CPLAIN")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(3);
  });
});

describe("status badges (#434)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("derives badges from transaction state", () => {
    const s = (phase: never, error: string | null = null) =>
      getTokenStatusBadge({ phase, error }).status;
    expect(s("idle" as never)).toBe("active");
    expect(s("signing" as never)).toBe("removing");
    expect(s("success" as never)).toBe("removed");
    expect(s("error" as never, "boom")).toBe("failed");
    expect(getAddStatusBadge("idle")).toBeNull();
    expect(getAddStatusBadge("submitting")?.status).toBe("adding");
    expect(getAddStatusBadge("error")?.status).toBe("failed");
  });

  it("renders an Active badge per token, and Failed after a failed removal", async () => {
    stubFetch({ success: true, data: ["CTOKEN1"] });
    mockSubmit.mockRejectedValue(new Error("rejected"));
    render(<AdminPage />);

    const badge = await screen.findByTestId("status-badge-CTOKEN1");
    expect(badge).toHaveAttribute("data-status", "active");
    expect(badge).toHaveTextContent("Active");

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() =>
      expect(screen.getByTestId("status-badge-CTOKEN1")).toHaveAttribute("data-status", "failed")
    );
  });
});

describe("confirmation modal (#435)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTokenContract.mockResolvedValue({
      valid: true,
      symbol: "NEW",
      decimals: 7,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("blocks add submit until the dialog is acknowledged and confirmed", async () => {
    stubFetch({ success: true, data: [] });
    mockSubmit.mockResolvedValue("HASH");
    render(<AdminPage />);

    fireEvent.change(await screen.findByLabelText(/token contract address/i), {
      target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
    });
    const addButton = screen.getByRole("button", { name: /add to whitelist/i });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    expect(screen.getByTestId("whitelist-confirm-modal")).toBeInTheDocument();
    expect(screen.getByTestId("whitelist-confirm-token")).toHaveTextContent(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
    );
    expect(mockSubmit).not.toHaveBeenCalled();

    const confirm = screen.getByRole("button", { name: /confirm & sign/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      method: "add_whitelisted_token",
      args: [
        { type: "address", value: "GADMIN123" },
        { type: "address", value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
      ],
    });
  });

  it("cancel closes the dialog without signing", async () => {
    stubFetch({ success: true, data: ["CTOKEN1"] });
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: /^remove$/i }));
    expect(screen.getByTestId("whitelist-confirm-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByTestId("whitelist-confirm-modal")).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
