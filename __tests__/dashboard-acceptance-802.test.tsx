// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: (...args: unknown[]) => mockSubmit(...args),
}));

const CLIENT = "GCLIENTADDRESS1234567890123456789012345678901234";
const FREELANCER = "GFREELANCERADDRESS12345678901234567890123456";
const ARBITER = "GARBITERADDRESS12345678901234567890123456789012";
const ADMIN = "GADMINADDRESS12345678901234567890123456789012345";
const JOB_CONTRACT = "C" + "J".repeat(55);

function job() {
  return {
    id: JOB_CONTRACT,
    client: CLIENT,
    freelancer: FREELANCER,
    arbiter: ARBITER,
    funded: true,
    latestLedger: 10,
    milestones: [{ index: 0, amount: "250000000", status: "Pending" }],
  };
}

/** Routes every dashboard request; history starts without acceptance events. */
function stubBackend() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const target = String(url);
      const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

      if (target.includes("/history")) {
        return json({
          success: true,
          events: [{ id: 1, event_type: "init", ledger_sequence: 1, timestamp: 1 }],
          total: 1,
          page: 1,
          limit: 100,
        });
      }
      if (target.includes("/by-wallet/")) {
        return json({ success: true, data: [job()], page: 1, limit: 5, total: 1 });
      }
      if (target.includes("/api/jobs/query")) {
        return json({
          success: true,
          data: { result: { admin: ADMIN, job: job() } },
        });
      }
      if (/\/api\/jobs\/[^/?]+$/.test(target)) {
        return json({ success: true, data: job() });
      }
      return json({ success: true });
    })
  );
}

async function openJob() {
  render(<Dashboard />);
  const expand = await screen.findByRole("button", { name: /Job #CJJJJJJJ/ });
  if (expand.getAttribute("aria-expanded") !== "true") fireEvent.click(expand);
}

describe("Dashboard job acceptance (#802)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue("tx-hash");
    stubBackend();
  });

  it("lets the freelancer accept the job on-chain", async () => {
    const registerPendingAction = vi.fn();
    mockUseWallet.mockReturnValue({
      address: FREELANCER,
      signTransaction: vi.fn(),
      connect: vi.fn(),
      isConnecting: false,
      registerPendingAction,
    });

    await openJob();

    fireEvent.click(await screen.findByRole("button", { name: "Accept job" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: JOB_CONTRACT,
        method: "accept_job",
        args: [{ type: "address", value: FREELANCER }],
      })
    );
    expect(registerPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: JOB_CONTRACT, method: "accept_job" })
    );

    // Acceptance never reverses, so the CTA disappears as soon as the tx lands.
    await waitFor(() => expect(screen.queryByTestId("accept-job-button")).not.toBeInTheDocument());
  });

  it("lets the arbiter accept as arbiter on-chain", async () => {
    mockUseWallet.mockReturnValue({
      address: ARBITER,
      signTransaction: vi.fn(),
      connect: vi.fn(),
      isConnecting: false,
      registerPendingAction: vi.fn(),
    });

    await openJob();

    fireEvent.click(await screen.findByRole("button", { name: "Accept as arbiter" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: JOB_CONTRACT,
        method: "accept_arbiter",
        args: [{ type: "address", value: ARBITER }],
      })
    );
    await waitFor(() =>
      expect(screen.queryByTestId("accept-arbiter-button")).not.toBeInTheDocument()
    );
  });

  it("shows the waiting explanation from indexed acceptance events", async () => {
    mockUseWallet.mockReturnValue({
      address: FREELANCER,
      signTransaction: vi.fn(),
      connect: vi.fn(),
      isConnecting: false,
      registerPendingAction: vi.fn(),
    });

    // The freelancer has accepted, the arbiter has not.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const target = String(url);
        const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
        if (target.includes("/history")) {
          return json({
            success: true,
            events: [
              { id: 1, event_type: "init", ledger_sequence: 1, timestamp: 1 },
              {
                id: 2,
                event_type: "acceptjob",
                ledger_sequence: 2,
                timestamp: 2,
                data_json: JSON.stringify({ acceptance_mask: 1 }),
              },
            ],
            total: 2,
            page: 1,
            limit: 100,
          });
        }
        if (target.includes("/by-wallet/")) {
          return json({ success: true, data: [job()], page: 1, limit: 5, total: 1 });
        }
        if (target.includes("/api/jobs/query")) {
          return json({ success: true, data: { result: { admin: ADMIN, job: job() } } });
        }
        if (/\/api\/jobs\/[^/?]+$/.test(target)) {
          return json({ success: true, data: job() });
        }
        return json({ success: true });
      })
    );

    await openJob();

    expect(await screen.findByTestId("job-acceptance-waiting")).toHaveTextContent(
      "Waiting for the arbiter to accept"
    );
    expect(screen.queryByTestId("accept-job-button")).not.toBeInTheDocument();
  });
});
