// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";

const mockUseWallet = vi.fn();
const mockSubmit = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("@/app/components/MilestoneCard", () => ({
  default: () => <div data-testid="milestone-card" />,
}));

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => ({
    getState: () => ({ phase: "idle", error: null, txHash: null }),
    isPending: () => false,
    setPhase: vi.fn(),
    setError: vi.fn(),
    setTxHash: vi.fn(),
  }),
}));

vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: (...args: unknown[]) => mockSubmit(...args),
}));

const CLIENT = "GCLIENTADDRESS1234567890123456789012345678901234";
const JOB_CONTRACT = "C" + "J".repeat(55);
const TOKEN_CONTRACT = "C" + "T".repeat(55);
const JOB = {
  id: JOB_CONTRACT,
  client: CLIENT,
  freelancer: "GFREELANCERADDRESS12345678901234567890123456",
  arbiter: "GARBITERADDRESS12345678901234567890123456789012",
  funded: false,
  token: TOKEN_CONTRACT,
  tokenSymbol: "USDC",
  tokenDecimals: 7,
  milestones: [
    { index: 0, amount: "250000000", status: "Pending" },
    { index: 1, amount: "150000000", status: "Pending" },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as unknown as Response;
}

/** The escrow needs 40 USDC; `balance` is the client's token balance in stroops. */
function stubFetch(balance: string | null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("/api/jobs/query")) {
      let method: string | undefined;
      try {
        method = (JSON.parse(String(init?.body ?? "{}")) as { method?: string }).method;
      } catch {
        method = undefined;
      }
      if (method === "balance") {
        return jsonResponse({ success: true, data: { result: balance } });
      }
      return jsonResponse({ success: true, data: {} });
    }
    if (/\/api\/jobs\/[^/?]+$/.test(target) && !target.includes("/by-wallet/")) {
      return jsonResponse({ success: true, data: JOB });
    }
    if (target.includes("/api/jobs")) {
      return jsonResponse({ success: true, data: [JOB], page: 1, limit: 5, total: 1 });
    }
    return jsonResponse({ success: true, data: {} });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function expandClientJob() {
  render(<Dashboard />);
  const expand = await screen.findByRole("button", { name: /Job #CJJJJJJJ/ });
  if (expand.getAttribute("aria-expanded") !== "true") fireEvent.click(expand);
  return screen.findByRole("button", { name: "Fund escrow" });
}

describe("Fund escrow balance check and confirmation (issue #845)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue("tx-hash");
    mockUseWallet.mockReturnValue({
      address: CLIENT,
      signTransaction: vi.fn(),
      registerPendingAction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables Fund and explains the shortfall when the balance is too low", async () => {
    stubFetch("100000000");
    const fundButton = await expandClientJob();

    await waitFor(() => expect(fundButton).toBeDisabled());
    expect(screen.getByTestId("fund-insufficient-balance")).toHaveTextContent(
      "Insufficient balance: you have 10 USDC, need 40 USDC"
    );

    fireEvent.click(fundButton);
    expect(screen.queryByTestId("fund-confirm-modal")).not.toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("opens the confirmation on sufficient balance and funds only after confirming", async () => {
    stubFetch("500000000");
    const fundButton = await expandClientJob();

    await waitFor(() => expect(fundButton).toBeEnabled());
    fireEvent.click(fundButton);

    const modal = await screen.findByTestId("fund-confirm-modal");
    expect(modal).toHaveTextContent("Confirm Fund Escrow");
    expect(screen.getByTestId("fund-confirm-modal-amount")).toHaveTextContent("40 USDC");
    expect(screen.getByTestId("fund-confirm-modal-token")).toHaveTextContent("USDC");
    expect(screen.getByTestId("fund-confirm-modal-escrow")).toHaveTextContent("CJJJ...JJJJ");
    expect(screen.getByTestId("fund-confirm-modal-warning")).toHaveTextContent(
      "Funds stay in the contract until released or refunded"
    );
    expect(mockSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fund-confirm-modal-confirm"));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: JOB_CONTRACT, method: "fund" })
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("fund-confirm-modal")).not.toBeInTheDocument()
    );
  });

  it("closes the confirmation without funding when cancelled", async () => {
    stubFetch("500000000");
    const fundButton = await expandClientJob();

    await waitFor(() => expect(fundButton).toBeEnabled());
    fireEvent.click(fundButton);
    await screen.findByTestId("fund-confirm-modal");

    fireEvent.click(screen.getByTestId("fund-confirm-modal-cancel"));
    expect(screen.queryByTestId("fund-confirm-modal")).not.toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
