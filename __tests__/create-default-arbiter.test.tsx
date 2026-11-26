import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/(app)/create/page";
import { getDefaultArbiter } from "@/app/lib/default_arbiter";

const DEFAULT_ARBITER = "GBCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIZCA";
const DEFAULT_ARBITER_CONTRACT = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const mockSubmit = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({
    address: "GBBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGWKN",
    signTransaction: vi.fn(),
  }),
}));

vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  FACTORY_CONTRACT_ID: "C" + "F".repeat(55),
  submitContractTransaction: mockSubmit,
}));

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Freelancer Address"), {
    target: { value: "GBDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMGSF" },
  });
  await screen.findByRole("option", { name: "USDC" });
  fireEvent.change(screen.getByLabelText("Token Contract Address", { selector: "select" }), {
    target: { value: "CTOKEN" },
  });
  fireEvent.change(screen.getByLabelText("Milestone 1 amount"), {
    target: { value: "100" },
  });
}

/** create_escrow takes (client, freelancer, arbiter, ...). */
function submittedArbiter() {
  return mockSubmit.mock.calls[0][0].args[2].value;
}

describe("getDefaultArbiter — StrKey validation (#835)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns null when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", "");
    expect(getDefaultArbiter()).toBeNull();
  });

  it("accepts a valid G… address", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", DEFAULT_ARBITER);
    expect(getDefaultArbiter()).toBe(DEFAULT_ARBITER);
  });

  it("accepts a valid C… contract address (#835)", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", DEFAULT_ARBITER_CONTRACT);
    expect(getDefaultArbiter()).toBe(DEFAULT_ARBITER_CONTRACT);
  });

  it("returns null for a G… address with a bad checksum", () => {
    const bad = DEFAULT_ARBITER.slice(0, -1) + (DEFAULT_ARBITER.endsWith("A") ? "B" : "A");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", bad);
    expect(getDefaultArbiter()).toBeNull();
  });

  it("returns null for a C… address with a bad checksum", () => {
    const bad =
      DEFAULT_ARBITER_CONTRACT.slice(0, -1) + (DEFAULT_ARBITER_CONTRACT.endsWith("A") ? "B" : "A");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", bad);
    expect(getDefaultArbiter()).toBeNull();
  });

  it("returns null for a syntactically invalid value", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", "not-an-address");
    expect(getDefaultArbiter()).toBeNull();
  });
});

describe("Create form arbiter selector (Issue #658)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue("txhash");
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
    vi.unstubAllEnvs();
  });

  it("pre-selects the platform arbiter when configured and submits it", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_ARBITER", DEFAULT_ARBITER);
    render(<CreateJob />);

    expect(screen.getByLabelText("Milesto arbitration (recommended)")).toBeChecked();
    expect(screen.queryByLabelText("Arbiter Address")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/#security");

    await fillRequiredFields();
    fireEvent.click(screen.getByTestId("agreement-checkbox"));
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
    expect(
      screen.getByText("Invalid Stellar public key or contract address format")
    ).toBeInTheDocument();

    const custom = "GBBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEFZSP";
    fireEvent.change(input, { target: { value: custom } });
    await fillRequiredFields();
    fireEvent.click(screen.getByTestId("agreement-checkbox"));
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
