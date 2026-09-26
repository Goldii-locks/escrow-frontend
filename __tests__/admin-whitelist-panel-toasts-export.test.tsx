import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import {
  buildWhitelistCsv,
  downloadWhitelistCsv,
  escapeCsvCell,
  whitelistErrorToast,
  whitelistExportEmptyToast,
  whitelistExportFilename,
  whitelistExportSuccessToast,
  whitelistSuccessToast,
} from "@/app/lib/admin_whitelist_panel";

const mockUseWallet = vi.fn();
const mockIsAdmin = vi.fn();
const mockShowToast = vi.fn();
const mockSubmit = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));
vi.mock("@/app/hooks/useIsAdmin", () => ({ useIsAdmin: () => mockIsAdmin() }));
vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock("@/app/lib/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
  submitContractTransaction: (...args: unknown[]) => mockSubmit(...args),
}));

function stubFetch(data: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data }),
    }),
  );
}

// #529 routes add/remove through a confirmation dialog before signing.
function confirmPendingAction() {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));
}

function renderAdmin(tokens: string[] = ["CTOKEN1", "CTOKEN2"]) {
  mockUseWallet.mockReturnValue({
    address: "GADMIN123",
    signTransaction: vi.fn(),
  });
  mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
  stubFetch(tokens);
  return render(<AdminPage />);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("admin_whitelist_panel CSV helpers", () => {
  it("builds rows with a header and correct cell values", () => {
    expect(buildWhitelistCsv(["CAAA", "CBBB"])).toBe(
      "#,Token Address\r\n1,CAAA\r\n2,CBBB",
    );
    expect(buildWhitelistCsv([])).toBe("#,Token Address");
  });

  it("escapes quotes/commas and neutralises formula injection", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell(7)).toBe("7");
  });

  it("builds a dated filename", () => {
    expect(whitelistExportFilename(new Date("2026-09-25T10:00:00Z"))).toBe(
      "whitelisted-tokens-2026-09-25.csv",
    );
  });

  it("downloads a CSV blob containing the token values", async () => {
    let blob: Blob | undefined;
    const createUrl = vi.fn((b: Blob) => ((blob = b), "blob:x"));
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("tokens.csv");
        expect(this.href).toContain("blob:x");
      });

    downloadWhitelistCsv(["CAAA", "CBBB"], "tokens.csv");

    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    expect(blob?.type).toContain("text/csv");
    expect(await blob!.text()).toContain("1,CAAA\r\n2,CBBB");
    click.mockRestore();
  });
});

describe("admin_whitelist_panel toast builders", () => {
  it("builds success, error, and export toasts", () => {
    expect(whitelistSuccessToast("add", "CTOKEN1")).toEqual({
      type: "success",
      message: "Token CTOKEN1 added to the whitelist.",
    });
    expect(whitelistErrorToast("remove", "CTOKEN1", "boom")).toEqual({
      type: "error",
      message: "Failed to remove token CTOKEN1: boom",
    });
    expect(whitelistExportEmptyToast().type).toBe("warning");
    expect(whitelistExportSuccessToast(1).message).toBe(
      "Exported 1 whitelisted token.",
    );
  });
});

describe("AdminPage whitelist panel", () => {
  it("lays out form and list in a bounded responsive grid", async () => {
    renderAdmin();
    const grid = await screen.findByTestId("whitelist-grid");
    expect(grid.className).toContain("lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]");
    expect(grid.className).toContain("lg:items-start");
    expect(screen.getByRole("main").className).toContain("max-w-5xl");
    // The address sits inside the truncating label column (#529 adds the
    // token symbol above it).
    expect(screen.getByText("CTOKEN1").parentElement?.className).toContain(
      "min-w-0",
    );
  });

  it("toasts success after adding a token", async () => {
    mockSubmit.mockResolvedValue("HASH1");
    renderAdmin();
    fireEvent.change(await screen.findByLabelText(/token contract address/i), {
      target: { value: "CNEW" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to whitelist/i }));
    confirmPendingAction();

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        "Token CNEW added to the whitelist.",
        "success",
      ),
    );
  });

  it("toasts an error when removing a token fails", async () => {
    mockSubmit.mockRejectedValue(new Error("network down"));
    renderAdmin();
    const [remove] = await screen.findAllByRole("button", { name: /^remove$/i });
    fireEvent.click(remove);
    confirmPendingAction();

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Failed to remove token CTOKEN1"),
        "error",
      ),
    );
  });

  it("exports the CSV and toasts; warns when the list is empty", async () => {
    const createUrl = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const { unmount } = renderAdmin();
    await screen.findByText("CTOKEN1");
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(mockShowToast).toHaveBeenCalledWith(
      "Exported 2 whitelisted tokens.",
      "success",
    );
    unmount();

    renderAdmin([]);
    await screen.findByText(/no whitelisted tokens found/i);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(mockShowToast).toHaveBeenLastCalledWith(
      "No whitelisted tokens to export.",
      "warning",
    );
    click.mockRestore();
  });

  it("toasts when the whitelist fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("x")));
    mockUseWallet.mockReturnValue({ address: "GADMIN123", signTransaction: vi.fn() });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    render(<AdminPage />);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        "Could not connect to backend to load whitelist.",
        "error",
      ),
    );
  });
});
