import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import CreateJob from "@/app/(app)/create/page";

const mockSubmit = vi.fn();
const ADDRESS = Keypair.random().publicKey();
const FREELANCER = Keypair.random().publicKey();
const ARBITER = Keypair.random().publicKey();
const DRAFT_KEY = `create-job-draft:${ADDRESS}`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({ address: ADDRESS, signTransaction: vi.fn() }),
}));

vi.mock("@/app/lib/transactions", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/app/lib/transactions");
  return { ...actual, submitContractTransaction: (...args: unknown[]) => mockSubmit(...args) };
});

async function fillForm() {
  fireEvent.change(screen.getByLabelText("Freelancer Address"), {
    target: { value: FREELANCER },
  });
  fireEvent.change(screen.getByLabelText("Arbiter Address"), {
    target: { value: ARBITER },
  });
  await screen.findByRole("option", { name: "USDC" });
  fireEvent.change(screen.getByLabelText("Token Contract Address", { selector: "select" }), {
    target: { value: "CTOKEN" },
  });
  fireEvent.change(screen.getByLabelText("Milestone 1 amount in stroops"), {
    target: { value: "100" },
  });
}

describe("Create job draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.stubGlobal("alert", vi.fn());
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores the filled form after a remount", async () => {
    const { unmount } = render(<CreateJob />);
    await fillForm();
    await waitFor(() => expect(window.sessionStorage.getItem(DRAFT_KEY)).toContain(FREELANCER));
    unmount();

    render(<CreateJob />);

    expect(await screen.findByTestId("create-job-draft-banner")).toHaveTextContent(
      "Restored your draft"
    );
    expect(screen.getByLabelText("Freelancer Address")).toHaveValue(FREELANCER);
    expect(screen.getByLabelText("Arbiter Address")).toHaveValue(ARBITER);
    expect(screen.getByLabelText("Milestone 1 amount in stroops")).toHaveValue("100");
  });

  it("Discard resets the form and clears the draft", async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        freelancer: FREELANCER,
        arbiter: ARBITER,
        token: "CTOKEN",
        autoReleaseDays: "7",
        acceptedAssets: [],
        requirements: [],
        milestones: [{ amount: "100" }],
      })
    );
    render(<CreateJob />);

    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));

    expect(screen.getByLabelText("Freelancer Address")).toHaveValue("");
    expect(screen.queryByTestId("create-job-draft-banner")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("clears the draft after a successful creation", async () => {
    mockSubmit.mockResolvedValue("TXHASH");
    render(<CreateJob />);
    await fillForm();
    await waitFor(() => expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull());

    await act(async () => {
      fireEvent.click(screen.getByTestId("agreement-checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Create Job" }));
    });

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 600));
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
