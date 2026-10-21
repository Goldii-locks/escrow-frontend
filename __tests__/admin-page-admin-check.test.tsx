import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(app)/admin/page";

/**
 * End-to-end admin check (#599): unlike admin-page.test.tsx, useIsAdmin is
 * NOT mocked. Only the backend is, so this exercises the real
 * useIsAdmin → isAdmin → fetchAdminAddress → get_escrow_state path.
 */

const ADMIN = "G" + "A".repeat(55);
const OTHER = "G" + "B".repeat(55);

const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

/** A backend whose get_escrow_state view reports ADMIN as the admin. */
function stubBackend() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/jobs/query") && init?.method === "POST") {
      const { method } = JSON.parse(String(init.body));
      if (method !== "get_escrow_state") {
        return json({ success: false, error: "Unsupported query method" }, false);
      }
      return json({
        success: true,
        data: { contractId: "CCONTRACT", method, result: { admin: ADMIN } },
      });
    }
    if (url.includes("/api/jobs/query")) {
      return json({ success: true, data: { result: false } });
    }
    if (url.includes("whitelist")) {
      return json({ success: true, data: ["CTOKEN1"] });
    }
    return json({ success: true, data: { funded: false } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AdminPage admin check against a mocked backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBackend();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the admin panels for the wallet the contract reports as admin", async () => {
    mockUseWallet.mockReturnValue({ address: ADMIN, signTransaction: vi.fn() });

    render(<AdminPage />);

    expect(await screen.findByLabelText(/token contract address/i)).toBeInTheDocument();
    expect(await screen.findByText("CTOKEN1")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-access-denied")).not.toBeInTheDocument();
  });

  it("shows the access-denied gate for any other wallet", async () => {
    mockUseWallet.mockReturnValue({ address: OTHER, signTransaction: vi.fn() });

    render(<AdminPage />);

    expect(await screen.findByTestId("admin-access-denied")).toBeInTheDocument();
    expect(screen.queryByLabelText(/token contract address/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("whitelist"))).toBe(
        false
      )
    );
  });
});
