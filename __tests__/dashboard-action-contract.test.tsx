// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";
import { wrapFetchWithJobDetails } from "@/__tests__/helpers/job_details_fetch";

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
// Each escrow created through the factory is its own contract.
const JOB_CONTRACT = "C" + "J".repeat(55);

describe("Dashboard actions target the job's own contract", () => {
  const registerPendingAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue("tx-hash");
    mockUseWallet.mockReturnValue({
      address: CLIENT,
      signTransaction: vi.fn(),
      registerPendingAction,
    });
    const job = {
      id: JOB_CONTRACT,
      client: CLIENT,
      freelancer: "GFREELANCERADDRESS12345678901234567890123456",
      arbiter: "GARBITERADDRESS12345678901234567890123456789012",
      funded: false,
      milestones: [{ index: 0, amount: "250000000", status: "Pending" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [job], page: 1, limit: 5, total: 1 }),
      })
    );
    wrapFetchWithJobDetails();
  });

  it("funds through the job's contract, not the configured CONTRACT_ID", async () => {
    render(<Dashboard />);

    const expand = await screen.findByRole("button", { name: /Job #CJJJJJJJ/ });
    if (expand.getAttribute("aria-expanded") !== "true") fireEvent.click(expand);
    fireEvent.click(await screen.findByRole("button", { name: "Fund escrow" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: JOB_CONTRACT, method: "fund" })
    );
    // The signature-timeout retry rebuilds against the same contract.
    expect(registerPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: JOB_CONTRACT, method: "fund" })
    );
  });
});
