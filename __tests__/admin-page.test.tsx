import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";

const mockUseWallet = vi.fn();
const mockIsAdmin = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => mockIsAdmin(),
}));

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    })
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts wallet connection when not connected", () => {
    mockUseWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: false });

    render(<AdminPage />);

    expect(
      screen.getByText(/connect your wallet to manage the whitelist/i)
    ).toBeInTheDocument();
  });

  it("shows loading spinner while checking admin status", () => {
    mockUseWallet.mockReturnValue({
      address: "GCLIENT123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: true, isAdminUser: false });

    render(<AdminPage />);

    expect(screen.getByText(/verifying admin access/i)).toBeInTheDocument();
  });

  it("shows access denied for non-admin users", () => {
    mockUseWallet.mockReturnValue({
      address: "GCLIENT123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: false });

    render(<AdminPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this page is restricted to the contract admin/i)
    ).toBeInTheDocument();
  });

  it("renders admin form and whitelist for admin users", async () => {
    mockUseWallet.mockReturnValue({
      address: "GADMIN123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    stubFetch({ success: true, data: ["CTOKEN1", "CTOKEN2"] });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/token contract address/i)).toBeInTheDocument();
      expect(screen.getByText("CTOKEN1")).toBeInTheDocument();
      expect(screen.getByText("CTOKEN2")).toBeInTheDocument();
    });
  });

  it("shows empty state when no tokens are whitelisted", async () => {
    mockUseWallet.mockReturnValue({
      address: "GADMIN123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    stubFetch({ success: true, data: [] });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/no whitelisted tokens found/i)).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockUseWallet.mockReturnValue({
      address: "GADMIN123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    stubFetch({ error: "Backend error" }, false);

    render(<AdminPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/could not connect to backend to load whitelist/i)
      ).toBeInTheDocument();
    });
  });

  it("renders add token form with proper labels", async () => {
    mockUseWallet.mockReturnValue({
      address: "GADMIN123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    stubFetch({ success: true, data: [] });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/token contract address/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add to whitelist/i })).toBeInTheDocument();
    });
  });

  it("renders remove buttons for each token", async () => {
    mockUseWallet.mockReturnValue({
      address: "GADMIN123",
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
    stubFetch({ success: true, data: ["CTOKEN1", "CTOKEN2"] });

    render(<AdminPage />);

    await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      expect(removeButtons).toHaveLength(2);
    });
  });
});
