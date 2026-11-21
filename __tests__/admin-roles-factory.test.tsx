// @vitest-environment jsdom
/**
 * /admin with delegated roles (#838) and factory + per-escrow administration
 * (#837).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(app)/admin/page";
import { selectEscrow, TEST_ESCROW_ID } from "@/__tests__/helpers/admin_escrow";

const { FACTORY, mockSubmit, mockAccess, mockAllowedTokens, mockWasmHash } = vi.hoisted(() => ({
  FACTORY: "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ",
  mockSubmit: vi.fn(),
  mockAccess: vi.fn(),
  mockAllowedTokens: vi.fn(),
  mockWasmHash: vi.fn(),
}));

const WALLET = "G" + "W".repeat(55);
const NEW_TOKEN = "C" + "T".repeat(55);
const WASM_HASH = "ab".repeat(32);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({ address: WALLET, signTransaction: vi.fn(async () => "SIGNED") }),
}));

// Access is per contract: the test decides what the wallet holds on the
// factory and on each escrow.
vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: (_address: string | null, contractId: string) => mockAccess(contractId),
}));

vi.mock("@/app/lib/transactions", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/transactions")>()),
  FACTORY_CONTRACT_ID: FACTORY,
  submitContractTransaction: mockSubmit,
}));

vi.mock("@/app/lib/factory_admin", async (importActual) => ({
  ...(await importActual<typeof import("@/app/lib/factory_admin")>()),
  fetchFactoryAllowedTokens: mockAllowedTokens,
  fetchFactoryWasmHash: mockWasmHash,
}));

// The real switch reads the freeze state from the backend; the page wiring
// (which contract, which method) is what is under test here.
vi.mock("@/app/components/ContractPauseSwitch", () => ({
  default: ({
    contractId,
    onToggle,
  }: {
    contractId?: string;
    onToggle?: (next: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="contract-pause-toggle"
      data-contract={contractId}
      onClick={() => onToggle?.(true)}
    >
      Freeze Contract
    </button>
  ),
}));

type Access = { loading: boolean; isAdminUser: boolean; roles: string[] };
const none: Access = { loading: false, isAdminUser: false, roles: [] };

function grant({ factory = none, escrow = none }: { factory?: Access; escrow?: Access }) {
  mockAccess.mockImplementation((contractId: string) =>
    contractId === FACTORY ? factory : contractId ? escrow : none
  );
}

function stubBackend() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes("whitelisted-tokens")
          ? { success: true, data: ["CTOKEN1"] }
          : String(url).includes("/by-wallet/")
            ? { success: true, data: [] }
            : { success: true, data: { funded: false } },
    }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stubBackend();
  mockSubmit.mockResolvedValue("TXHASH");
  mockAllowedTokens.mockResolvedValue([]);
  mockWasmHash.mockResolvedValue(WASM_HASH);
});

afterEach(() => vi.unstubAllGlobals());

describe("delegated roles gate the escrow controls (#838)", () => {
  it("an Operator can use the pause switch without whitelist access", async () => {
    grant({ escrow: { ...none, roles: ["Operator"] } });
    render(<AdminPage />);
    selectEscrow();

    const toggle = await screen.findByTestId("contract-pause-toggle");
    expect(screen.queryByLabelText(/token contract address/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("whitelist-restricted")).toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      contractId: TEST_ESCROW_ID,
      method: "admin_pause_escrow",
      args: [{ type: "address", value: WALLET }],
    });
    // No whitelist is loaded for a wallet that can't manage it.
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("whitelisted-tokens"))
    ).toBe(false);
  });

  it("a FeeManager can manage the whitelist without pause access", async () => {
    grant({ escrow: { ...none, roles: ["FeeManager"] } });
    render(<AdminPage />);
    selectEscrow();

    expect(await screen.findByText("CTOKEN1")).toBeInTheDocument();
    expect(screen.getByLabelText(/token contract address/i)).toBeInTheDocument();
    expect(screen.queryByTestId("contract-pause-toggle")).not.toBeInTheDocument();
    expect(screen.getByTestId("pause-restricted")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/token contract address/i), {
      target: { value: "CNEWTOKEN" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to whitelist/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      contractId: TEST_ESCROW_ID,
      method: "add_whitelisted_token",
    });
  });

  it("shows the wallet's roles on the selected escrow in the header", async () => {
    grant({ escrow: { ...none, roles: ["Operator", "Resolver"] } });
    render(<AdminPage />);
    selectEscrow();

    const roles = await screen.findByTestId("admin-wallet-roles");
    expect(within(roles).getByTestId("admin-role-badge-Operator")).toBeInTheDocument();
    expect(within(roles).getByTestId("admin-role-badge-Resolver")).toBeInTheDocument();
    expect(within(roles).queryByTestId("admin-role-badge-FeeManager")).toBeNull();
    expect(within(roles).queryByTestId("admin-role-badge-Admin")).toBeNull();
    expect(screen.getByTestId("admin-contract-id")).toHaveAttribute("title", TEST_ESCROW_ID);
  });

  it("denies a wallet with no admin status or role on the selected escrow", async () => {
    grant({});
    render(<AdminPage />);
    selectEscrow();

    expect(await screen.findByTestId("admin-access-denied")).toBeInTheDocument();
    expect(screen.queryByTestId("contract-pause-toggle")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/token contract address/i)).not.toBeInTheDocument();
  });
});

describe("factory administration and the escrow picker (#837)", () => {
  it("lets the factory admin add a token to the factory", async () => {
    grant({ factory: { ...none, isAdminUser: true } });
    render(<AdminPage />);

    const panel = await screen.findByTestId("factory-admin-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("factory-wasm-hash")).toHaveTextContent(WASM_HASH)
    );
    expect(mockAllowedTokens).toHaveBeenCalledWith(FACTORY, expect.anything());

    fireEvent.change(within(panel).getByLabelText("Allow a token"), {
      target: { value: NEW_TOKEN },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Allow token" }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      contractId: FACTORY,
      method: "allow_token",
      args: [
        { type: "address", value: WALLET },
        { type: "address", value: NEW_TOKEN },
      ],
    });
    // The list is re-read after the token is allowed.
    await waitFor(() => expect(mockAllowedTokens).toHaveBeenCalledTimes(2));
  });

  it("rejects a malformed factory token before signing", async () => {
    grant({ factory: { ...none, isAdminUser: true } });
    render(<AdminPage />);

    const panel = await screen.findByTestId("factory-admin-panel");
    fireEvent.change(within(panel).getByLabelText("Allow a token"), {
      target: { value: "not-a-token" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Allow token" }));

    expect(within(panel).getByRole("alert")).toHaveTextContent(/token contract id/i);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("lists allowed tokens and removes one with disallow_token", async () => {
    mockAllowedTokens.mockResolvedValue([NEW_TOKEN]);
    grant({ factory: { ...none, isAdminUser: true } });
    render(<AdminPage />);

    const row = await screen.findByTestId(`factory-token-${NEW_TOKEN}`);
    fireEvent.click(
      within(row).getByRole("button", { name: `Remove ${NEW_TOKEN} from the factory` })
    );

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      contractId: FACTORY,
      method: "disallow_token",
    });
  });

  it("hides the factory section from wallets that are not the factory admin", async () => {
    grant({ escrow: { ...none, isAdminUser: true } });
    render(<AdminPage />);
    selectEscrow();

    await screen.findByTestId("contract-pause-toggle");
    expect(screen.queryByTestId("factory-admin-panel")).not.toBeInTheDocument();
  });

  it("pauses the escrow chosen in the picker, not a configured contract", async () => {
    const OTHER_ESCROW = "C" + "Q".repeat(55);
    grant({
      factory: { ...none, isAdminUser: true },
      escrow: { ...none, isAdminUser: true },
    });
    render(<AdminPage />);

    // Nothing to pause until an escrow is chosen.
    expect(screen.getByTestId("escrow-not-selected")).toBeInTheDocument();
    expect(screen.queryByTestId("contract-pause-toggle")).not.toBeInTheDocument();

    selectEscrow(OTHER_ESCROW);
    const toggle = await screen.findByTestId("contract-pause-toggle");
    expect(toggle).toHaveAttribute("data-contract", OTHER_ESCROW);
    expect(screen.getByTestId("escrow-picker-selected")).toHaveTextContent(OTHER_ESCROW);

    fireEvent.click(toggle);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({
      contractId: OTHER_ESCROW,
      method: "admin_pause_escrow",
    });
  });

  it("rejects a malformed escrow contract ID in the picker", () => {
    grant({ factory: { ...none, isAdminUser: true } });
    render(<AdminPage />);
    selectEscrow("CNOTVALID");

    expect(screen.getByText(/that is not a contract id/i)).toBeInTheDocument();
    expect(screen.getByTestId("escrow-not-selected")).toBeInTheDocument();
  });
});
