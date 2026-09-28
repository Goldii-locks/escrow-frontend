/**
 * Empty-state suite for ArbiterActionPanel: descriptive placeholders render
 * when the panel receives no usable milestone, and when an arbiter's job has
 * an empty list of disputes (on the panel helpers and on the dashboard).
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArbiterActionPanel, {
  ArbiterPanelPlaceholder,
} from "@/app/components/ArbiterActionPanel";
import Dashboard from "@/app/dashboard/page";
import {
  ARBITER_EMPTY_COPY,
  getArbiterJobEmptyState,
  isValidMilestoneIndex,
  type ArbiterEmptyVariant,
} from "@/app/lib/arbiter_action_panel";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));

describe("isValidMilestoneIndex", () => {
  it.each([0, 1, 42])("accepts %s", (value) => {
    expect(isValidMilestoneIndex(value)).toBe(true);
  });

  it.each([null, undefined, -1, 1.5, NaN, Infinity, "0", {}])(
    "rejects %s",
    (value) => {
      expect(isValidMilestoneIndex(value)).toBe(false);
    },
  );
});

describe("getArbiterJobEmptyState", () => {
  it.each([null, undefined, []])("reports no-milestones for %s", (list) => {
    expect(getArbiterJobEmptyState(list)).toBe("no-milestones");
  });

  it("reports no-milestones for a non-array value", () => {
    expect(
      getArbiterJobEmptyState({} as unknown as Parameters<typeof getArbiterJobEmptyState>[0]),
    ).toBe("no-milestones");
  });

  it("reports no-disputes when no milestone is disputed", () => {
    expect(
      getArbiterJobEmptyState([
        { status: "Pending" },
        { status: "Released" },
        null,
        { status: undefined },
      ]),
    ).toBe("no-disputes");
  });

  it("returns null once any milestone is disputed", () => {
    expect(
      getArbiterJobEmptyState([{ status: "Released" }, { status: "Disputed" }]),
    ).toBeNull();
  });
});

describe("ArbiterPanelPlaceholder", () => {
  const variants = Object.keys(ARBITER_EMPTY_COPY) as ArbiterEmptyVariant[];

  it.each(variants)("renders descriptive copy for %s", (variant) => {
    render(<ArbiterPanelPlaceholder variant={variant} />);
    const copy = ARBITER_EMPTY_COPY[variant];
    const placeholder = screen.getByTestId("arbiter-panel-placeholder");
    expect(placeholder).toHaveAttribute("data-variant", variant);
    expect(screen.getByTestId("arbiter-panel-placeholder-title")).toHaveTextContent(
      copy.title,
    );
    expect(
      screen.getByTestId("arbiter-panel-placeholder-description"),
    ).toHaveTextContent(copy.description);
  });

  it.each(variants)("%s copy is a full sentence, not bare text", (variant) => {
    const { title, description } = ARBITER_EMPTY_COPY[variant];
    expect(title.length).toBeGreaterThan(5);
    expect(description.length).toBeGreaterThan(40);
    expect(description.trim()).toMatch(/\.$/);
  });

  it("is a polite status named by its title", () => {
    render(<ArbiterPanelPlaceholder variant="no-disputes" />);
    const status = screen.getByRole("status", {
      name: ARBITER_EMPTY_COPY["no-disputes"].title,
    });
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("hides its decorative icon from assistive tech", () => {
    render(<ArbiterPanelPlaceholder variant="no-milestone" />);
    const icon = screen.getByText(ARBITER_EMPTY_COPY["no-milestone"].icon);
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a dashed, muted card distinct from the live panel", () => {
    render(<ArbiterPanelPlaceholder variant="no-disputes" />);
    expect(screen.getByTestId("arbiter-panel-placeholder")).toHaveClass(
      "border-dashed",
      "text-center",
      "w-full",
    );
  });

  it("forwards className", () => {
    render(<ArbiterPanelPlaceholder variant="no-disputes" className="mt-8" />);
    expect(screen.getByTestId("arbiter-panel-placeholder")).toHaveClass("mt-8");
  });
});

describe("ArbiterActionPanel with empty data", () => {
  it.each([undefined, null, -1, 2.5, NaN])(
    "renders the no-milestone placeholder for milestoneIndex=%s",
    (milestoneIndex) => {
      render(<ArbiterActionPanel milestoneIndex={milestoneIndex} onResolve={vi.fn()} />);
      expect(screen.getByTestId("arbiter-panel-placeholder")).toHaveAttribute(
        "data-variant",
        "no-milestone",
      );
      expect(screen.queryByTestId("arbiter-action-panel")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    },
  );

  it("renders the placeholder without any props at all", () => {
    render(<ArbiterActionPanel />);
    expect(screen.getByText("No dispute selected")).toBeInTheDocument();
  });

  it("swaps from the placeholder to the live panel when data arrives", () => {
    const { rerender } = render(<ArbiterActionPanel milestoneIndex={null} onResolve={vi.fn()} />);
    expect(screen.getByTestId("arbiter-panel-placeholder")).toBeInTheDocument();
    rerender(<ArbiterActionPanel milestoneIndex={3} onResolve={vi.fn()} />);
    expect(screen.queryByTestId("arbiter-panel-placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Milestone 4/ })).toBeInTheDocument();
  });

  it("falls back to generic copy when no amount is given", () => {
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    expect(screen.getByText(/Decide where the disputed funds go\./)).toBeInTheDocument();
  });
});

describe("Dashboard — arbiter empty dispute list", () => {
  const job = (milestones: Array<{ index: number; amount: string; status: string }>) => ({
    id: "job-1",
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: "GARBITER",
    funded: true,
    milestones,
  });

  function stubBackend(payload: ReturnType<typeof job>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes("/by-wallet/")
            ? { success: true, data: [payload], page: 1, limit: 5, total: 1 }
            : { success: true, data: payload },
      })),
    );
  }

  // The dashboard auto-expands the first job, so no click is needed.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the no-disputes placeholder to the arbiter when nothing is disputed", async () => {
    mockUseWallet.mockReturnValue({ address: "GARBITER", signTransaction: vi.fn() });
    stubBackend(
      job([
        { index: 0, amount: "100", status: "Pending" },
        { index: 1, amount: "200", status: "Released" },
      ]),
    );
    render(<Dashboard />);

    const placeholder = await screen.findByTestId("arbiter-panel-placeholder");
    expect(placeholder).toHaveAttribute("data-variant", "no-disputes");
    expect(placeholder).toHaveTextContent("No disputes need your decision");
    expect(screen.getAllByTestId("milestone-card")).toHaveLength(2);
  });

  it("shows the resolution panel instead once a milestone is disputed", async () => {
    mockUseWallet.mockReturnValue({ address: "GARBITER", signTransaction: vi.fn() });
    stubBackend(
      job([
        { index: 0, amount: "100", status: "Pending" },
        { index: 1, amount: "200", status: "Disputed" },
      ]),
    );
    render(<Dashboard />);

    await screen.findByTestId("arbiter-action-panel");
    expect(screen.queryByTestId("arbiter-panel-placeholder")).not.toBeInTheDocument();
  });

  it("does not show the arbiter placeholder to the client", async () => {
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
    stubBackend(job([{ index: 0, amount: "100", status: "Pending" }]));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("milestone-card")).toHaveLength(1);
    });
    expect(screen.queryByTestId("arbiter-panel-placeholder")).not.toBeInTheDocument();
  });

  it("leaves a milestone-less job to the existing milestone empty state", async () => {
    mockUseWallet.mockReturnValue({ address: "GARBITER", signTransaction: vi.fn() });
    stubBackend(job([]));
    render(<Dashboard />);

    await screen.findByTestId("milestone-empty-state");
    expect(screen.queryByTestId("arbiter-panel-placeholder")).not.toBeInTheDocument();
  });
});
