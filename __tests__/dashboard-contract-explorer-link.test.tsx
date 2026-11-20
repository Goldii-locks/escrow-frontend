// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";
import { wrapFetchWithJobDetails } from "@/__tests__/helpers/job_details_fetch";

const network = vi.hoisted(() => ({ passphrase: "" }));

vi.mock("@/app/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/config")>();
  return {
    ...actual,
    get NETWORK_PASSPHRASE() {
      return network.passphrase;
    },
  };
});

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({ address: CLIENT, signTransaction: vi.fn() }),
}));
vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}));
vi.mock("@/app/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("@/app/components/MilestoneCard", () => ({
  default: () => <div data-testid="milestone-card" />,
}));

const CLIENT = "GCLIENTADDRESS1234567890123456789012345678901234";
const JOB_CONTRACT = "C" + "J".repeat(55);

async function openJob() {
  render(<Dashboard />);
  const expand = await screen.findByRole("button", { name: /Job #CJJJJJJJ/ });
  if (expand.getAttribute("aria-expanded") !== "true") fireEvent.click(expand);
  const id = await screen.findByLabelText(`Contract ID: ${JOB_CONTRACT}`);
  return id.parentElement as HTMLElement;
}

describe("expanded job contract row (#856)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const job = {
      id: JOB_CONTRACT,
      client: CLIENT,
      freelancer: "GFREELANCERADDRESS12345678901234567890123456",
      arbiter: "GARBITERADDRESS12345678901234567890123456789012",
      funded: true,
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

  it.each([
    ["testnet", "Test SDF Network ; September 2015", "testnet"],
    ["mainnet", "Public Global Stellar Network ; September 2015", "public"],
  ])("links the job's contract on %s", async (_name, passphrase, segment) => {
    network.passphrase = passphrase;
    const row = await openJob();

    expect(within(row).getByText("Contract")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Copy contract ID" })).toBeInTheDocument();
    const link = within(row).getByRole("link", { name: "View on Stellar Expert" });
    expect(link).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/${segment}/contract/${JOB_CONTRACT}`
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the ID and copy button but no link on a custom network", async () => {
    network.passphrase = "Standalone Network ; February 2017";
    const row = await openJob();

    expect(within(row).getByRole("button", { name: "Copy contract ID" })).toBeInTheDocument();
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
  });
});
