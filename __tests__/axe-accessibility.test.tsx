/**
 * Automated accessibility checks on the four main routes (#677).
 *
 * Each route page is rendered in a jsdom environment with the minimum
 * context/dependency mocks required to produce a representative DOM.
 * axe-core runs against the rendered container and asserts
 * `toHaveNoViolations()`.
 *
 * Known issues that axe reports but are outside the scope of this PR are
 * listed in the allowlist object below with a link to the relevant ticket.
 * The allowlist is intentionally empty — every violation should be a real
 * failure that gets fixed or a documented known issue.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";

import Home from "@/app/page";
import Dashboard from "@/app/dashboard/page";
import CreateJob from "@/app/create/page";
import AdminPage from "@/app/admin/page";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockUseWallet = vi.fn();
const mockUseToast = vi.fn();
const mockIsAdmin = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/app/hooks/useIsAdmin", () => ({
  useIsAdmin: () => mockIsAdmin(),
}));

// Navbar pulls in wallet-kit at module scope — stub it so the page renders
// without the SDK import chain.
vi.mock("@/app/components/Navbar", () => ({
  default: () => <nav data-testid="navbar">Navbar</nav>,
}));

// MilestoneCard and LoadingSkeleton have their own wallet/contract deps that
// are not needed for a11y scanning of the page layout.
vi.mock("@/app/components/MilestoneCard", () => ({
  default: ({
    milestone,
  }: {
    milestone: { index: number; amount: string; status: string };
  }) => (
    <article data-testid="milestone-card">
      <h3>Milestone {milestone.index + 1}</h3>
      <p>Status: {milestone.status}</p>
      <p>Amount: {milestone.amount}</p>
    </article>
  ),
}));

vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => (
    <div data-testid="loading-skeleton" role="status" aria-label="Loading">
      Loading…
    </div>
  ),
}));

vi.mock("@/app/components/DisputeRaiseModal", () => ({
  default: () => null,
}));

vi.mock("@/app/components/ArbiterActionPanel", () => ({
  ArbiterPanelPlaceholder: () => null,
}));

vi.mock("@/app/components/AdminWhitelistSkeleton", () => ({
  default: () => (
    <div data-testid="admin-skeleton" role="status" aria-label="Loading">
      Loading…
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

/** A representative set of jobs for the dashboard with varied statuses. */
const FIXTURE_JOBS = {
  success: true,
  data: [
    {
      id: "job-1",
      client: "GCLIENT1",
      freelancer: "GFREELANCER1",
      milestones: [
        { index: 0, amount: "10000000", status: "Pending" },
        { index: 1, amount: "50000000", status: "Released", releasedAmount: "50000000" },
        { index: 2, amount: "30000000", status: "PartiallyReleased", releasedAmount: "15000000" },
      ],
    },
  ],
  page: 1,
  limit: 5,
  total: 1,
};

const EMPTY_JOBS = {
  success: true,
  data: [],
  page: 1,
  limit: 5,
  total: 0,
};

const WHITELIST_FIXTURE = {
  success: true,
  data: [
    { address: "CTOKEN1", symbol: "USDC", decimals: 6, status: "active" },
    { address: "CTOKEN2", symbol: "USDT", decimals: 6, status: "active" },
  ],
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockUseWallet.mockReturnValue({
    address: "GTEST123456",
    signTransaction: vi.fn(async () => "signed-xdr"),
    selectedWalletId: "freighter",
    setSelectedWalletId: vi.fn(),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    isConnecting: false,
    networkMismatchMessage: null,
    assembleMultiSigTransaction: vi.fn(async () => ({
      uniqueSigners: 0,
      splitsValidated: 0,
    })),
    signatureTimeoutError: null,
    signatureTimeoutXdr: null,
    clearSignatureTimeout: vi.fn(),
    lastPendingAction: null,
    registerPendingAction: vi.fn(),
    retryLastAction: vi.fn(async () => null),
    simulationResult: null,
    setSimulationResult: vi.fn(),
    gasWarning: null,
  });

  mockUseToast.mockReturnValue({
    showToast: vi.fn(),
    toasts: [],
    hideToast: vi.fn(),
  });

  mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Renders a page, waits for async effects to settle, then runs axe.
 */
async function renderAndAxe(ui: React.ReactElement) {
  const { container } = render(ui);
  // Let any async effects (fetch, rehydrate, etc.) settle before scanning.
  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });
  const results = await axe.run(container);
  expect(results).toHaveNoViolations();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.sequential("axe accessibility — landing page (/)", () => {
  it("has no axe violations", async () => {
    await renderAndAxe(<Home />);
  });
});

describe.sequential("axe accessibility — dashboard (/dashboard)", () => {
  it("has no axe violations with fixture jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => FIXTURE_JOBS,
      })
    );

    await renderAndAxe(<Dashboard />);
  });

  it("has no axe violations in empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => EMPTY_JOBS,
      })
    );

    await renderAndAxe(<Dashboard />);
  });
});

describe.sequential("axe accessibility — create page (/create)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { tokens: [{ address: "CTOKEN", symbol: "USDC", decimals: 6 }] } }),
      })
    );
  });

  it("has no axe violations on step 1 (job details)", async () => {
    await renderAndAxe(<CreateJob />);
  });
});

describe.sequential("axe accessibility — admin page (/admin)", () => {
  it("has no axe violations with whitelist loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => WHITELIST_FIXTURE,
      })
    );

    await renderAndAxe(<AdminPage />);
  });

  it("has no axe violations when wallet not connected", async () => {
    mockUseWallet.mockReturnValue({
      address: null,
      signTransaction: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: false });

    await renderAndAxe(<AdminPage />);
  });

  it("has no axe violations for non-admin users", async () => {
    mockIsAdmin.mockReturnValue({ loading: false, isAdminUser: false });

    await renderAndAxe(<AdminPage />);
  });
});
