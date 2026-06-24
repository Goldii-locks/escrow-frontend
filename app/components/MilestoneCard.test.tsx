/**
 * MilestoneCard – Accessibility & behaviour test suite
 *
 * Covers:
 *  1. ARIA landmark / role presence
 *  2. Accessible names on the card, status badge, and every action button
 *  3. Keyboard navigability (Tab order, Enter / Space activation)
 *  4. Conditional rendering of action buttons per role × status
 *  5. Callback invocation with the correct milestone index
 *  6. Unknown-status fallback rendering
 *  7. Read-only view (no role, no actions)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MilestoneCard from "./MilestoneCard";

// ─── helpers ────────────────────────────────────────────────────────────────

const makeMilestone = (
  overrides: Partial<{ index: number; amount: string; status: string }> = {}
) => ({
  index: 0,
  amount: "5000000",
  status: "Pending",
  ...overrides,
});

interface RenderOptions {
  status?: string;
  index?: number;
  isClient?: boolean;
  isFreelancer?: boolean;
  onMarkDelivered?: ReturnType<typeof vi.fn>;
  onApprove?: ReturnType<typeof vi.fn>;
  onDispute?: ReturnType<typeof vi.fn>;
}

function renderCard(opts: RenderOptions = {}) {
  const {
    status = "Pending",
    index = 0,
    isClient = false,
    isFreelancer = false,
    onMarkDelivered = vi.fn(),
    onApprove = vi.fn(),
    onDispute = vi.fn(),
  } = opts;

  return render(
    <MilestoneCard
      milestone={makeMilestone({ index, status })}
      isClient={isClient}
      isFreelancer={isFreelancer}
      onMarkDelivered={onMarkDelivered}
      onApprove={onApprove}
      onDispute={onDispute}
    />
  );
}

// ─── 1. ARIA landmark / role ─────────────────────────────────────────────────

describe("ARIA landmark", () => {
  it("renders an <article> element", () => {
    renderCard();
    // getByRole('article') maps to the implicit role of <article>
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("article has an accessible name that identifies the milestone number", () => {
    renderCard({ index: 2, status: "Released" });
    const article = screen.getByRole("article");
    expect(article).toHaveAccessibleName(/Milestone 3/i);
  });

  it("article accessible name includes the status description", () => {
    renderCard({ status: "Delivered" });
    expect(screen.getByRole("article")).toHaveAccessibleName(
      /awaiting client approval/i
    );
  });
});

// ─── 2. Heading inside card ───────────────────────────────────────────────────

describe("Heading", () => {
  it("renders the milestone number as a heading", () => {
    renderCard({ index: 0 });
    expect(screen.getByRole("heading", { name: /Milestone 1/i })).toBeInTheDocument();
  });

  it("uses h3 (level 3) to fit within page hierarchy", () => {
    renderCard({ index: 4 });
    expect(
      screen.getByRole("heading", { level: 3, name: /Milestone 5/i })
    ).toBeInTheDocument();
  });
});

// ─── 3. Status badge ─────────────────────────────────────────────────────────

describe("Status badge", () => {
  const statuses = [
    "Pending",
    "Delivered",
    "Released",
    "Disputed",
    "Refunded",
  ] as const;

  statuses.forEach((status) => {
    it(`renders a status element with role="status" for "${status}"`, () => {
      renderCard({ status });
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it(`status badge for "${status}" has an accessible label`, () => {
      renderCard({ status });
      const badge = screen.getByRole("status");
      // The aria-label should be more descriptive than just the raw status word
      expect(badge).toHaveAttribute("aria-label");
      expect(badge.getAttribute("aria-label")).not.toBe("");
    });
  });

  it('shows visible text matching the status', () => {
    renderCard({ status: "Disputed" });
    expect(screen.getByRole("status")).toHaveTextContent("Disputed");
  });

  it("renders with a fallback style for an unknown status", () => {
    renderCard({ status: "Unknown" });
    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Unknown");
  });
});

// ─── 4. Conditional buttons – freelancer ─────────────────────────────────────

describe("Freelancer actions", () => {
  it("shows 'Mark Delivered' button on Pending milestone", () => {
    renderCard({ isFreelancer: true, status: "Pending" });
    expect(
      screen.getByRole("button", { name: /mark milestone 1 as delivered/i })
    ).toBeInTheDocument();
  });

  it("does NOT show 'Mark Delivered' on non-Pending milestone", () => {
    renderCard({ isFreelancer: true, status: "Delivered" });
    expect(
      screen.queryByRole("button", { name: /mark.*delivered/i })
    ).not.toBeInTheDocument();
  });

  it("shows 'Dispute' button on Pending milestone as freelancer", () => {
    renderCard({ isFreelancer: true, status: "Pending" });
    expect(
      screen.getByRole("button", { name: /dispute milestone 1/i })
    ).toBeInTheDocument();
  });

  it("shows 'Dispute' button on Delivered milestone as freelancer", () => {
    renderCard({ isFreelancer: true, status: "Delivered" });
    expect(
      screen.getByRole("button", { name: /dispute milestone 1/i })
    ).toBeInTheDocument();
  });

  it("does NOT show 'Dispute' on Released milestone as freelancer", () => {
    renderCard({ isFreelancer: true, status: "Released" });
    expect(
      screen.queryByRole("button", { name: /dispute/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT show 'Approve' button for a freelancer", () => {
    renderCard({ isFreelancer: true, status: "Delivered" });
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
  });
});

// ─── 5. Conditional buttons – client ─────────────────────────────────────────

describe("Client actions", () => {
  it("shows 'Approve' button on Delivered milestone as client", () => {
    renderCard({ isClient: true, status: "Delivered" });
    expect(
      screen.getByRole("button", { name: /approve milestone 1 and release funds/i })
    ).toBeInTheDocument();
  });

  it("does NOT show 'Approve' on Pending milestone as client", () => {
    renderCard({ isClient: true, status: "Pending" });
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
  });

  it("shows 'Dispute' button on Pending milestone as client", () => {
    renderCard({ isClient: true, status: "Pending" });
    expect(
      screen.getByRole("button", { name: /dispute milestone 1/i })
    ).toBeInTheDocument();
  });

  it("does NOT show 'Mark Delivered' button for a client", () => {
    renderCard({ isClient: true, status: "Pending" });
    expect(
      screen.queryByRole("button", { name: /mark.*delivered/i })
    ).not.toBeInTheDocument();
  });
});

// ─── 6. Read-only view (neither client nor freelancer) ───────────────────────

describe("Read-only view", () => {
  it("renders no action buttons when user has no role", () => {
    renderCard({ isClient: false, isFreelancer: false, status: "Pending" });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("still renders the status badge in read-only mode", () => {
    renderCard({ isClient: false, isFreelancer: false, status: "Released" });
    expect(screen.getByRole("status")).toHaveTextContent("Released");
  });
});

// ─── 7. Callback invocation ──────────────────────────────────────────────────

describe("Callbacks", () => {
  it("calls onMarkDelivered with the correct index on click", async () => {
    const onMarkDelivered = vi.fn();
    const user = userEvent.setup();
    renderCard({ isFreelancer: true, status: "Pending", index: 2, onMarkDelivered });

    await user.click(
      screen.getByRole("button", { name: /mark milestone 3 as delivered/i })
    );
    expect(onMarkDelivered).toHaveBeenCalledOnce();
    expect(onMarkDelivered).toHaveBeenCalledWith(2);
  });

  it("calls onApprove with the correct index on click", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderCard({ isClient: true, status: "Delivered", index: 1, onApprove });

    await user.click(
      screen.getByRole("button", { name: /approve milestone 2 and release funds/i })
    );
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onApprove).toHaveBeenCalledWith(1);
  });

  it("calls onDispute with the correct index on click", async () => {
    const onDispute = vi.fn();
    const user = userEvent.setup();
    renderCard({ isClient: true, status: "Pending", index: 3, onDispute });

    await user.click(
      screen.getByRole("button", { name: /dispute milestone 4/i })
    );
    expect(onDispute).toHaveBeenCalledOnce();
    expect(onDispute).toHaveBeenCalledWith(3);
  });

  it("does not throw when optional callbacks are omitted and buttons are clicked", async () => {
    const user = userEvent.setup();
    render(
      <MilestoneCard
        milestone={makeMilestone({ status: "Pending" })}
        isFreelancer
        isClient={false}
        // no callbacks provided
      />
    );

    // Should not throw
    await user.click(
      screen.getByRole("button", { name: /mark milestone 1 as delivered/i })
    );
    await user.click(
      screen.getByRole("button", { name: /dispute milestone 1/i })
    );
  });
});

// ─── 8. Keyboard navigability ────────────────────────────────────────────────

describe("Keyboard navigation", () => {
  it("all buttons are reachable via Tab", async () => {
    const user = userEvent.setup();
    renderCard({ isFreelancer: true, status: "Pending" });

    const buttons = screen.getAllByRole("button");
    // focus the document body first
    (document.body as HTMLElement).focus();

    for (const btn of buttons) {
      await user.tab();
      expect(btn).toHaveFocus();
    }
  });

  it("Enter key activates 'Mark Delivered' button", async () => {
    const onMarkDelivered = vi.fn();
    const user = userEvent.setup();
    renderCard({ isFreelancer: true, status: "Pending", onMarkDelivered });

    const btn = screen.getByRole("button", { name: /mark milestone 1 as delivered/i });
    btn.focus();
    await user.keyboard("{Enter}");
    expect(onMarkDelivered).toHaveBeenCalledOnce();
  });

  it("Space key activates 'Approve' button", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderCard({ isClient: true, status: "Delivered", onApprove });

    const btn = screen.getByRole("button", { name: /approve milestone 1 and release funds/i });
    btn.focus();
    await user.keyboard(" ");
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("Space key activates 'Dispute' button", async () => {
    const onDispute = vi.fn();
    const user = userEvent.setup();
    renderCard({ isClient: true, status: "Pending", onDispute });

    const btn = screen.getByRole("button", { name: /dispute milestone 1/i });
    btn.focus();
    await user.keyboard(" ");
    expect(onDispute).toHaveBeenCalledOnce();
  });
});

// ─── 9. Button type attribute ────────────────────────────────────────────────

describe("Button type attribute", () => {
  it.each([
    ["Mark Delivered", { isFreelancer: true, status: "Pending" }],
    ["Approve", { isClient: true, status: "Delivered" }],
    ["Dispute", { isClient: true, status: "Pending" }],
  ])('"%s" button has type="button"', (_label, opts) => {
    renderCard(opts);
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });
  });
});

// ─── 10. Amount display ──────────────────────────────────────────────────────

describe("Amount display", () => {
  it("renders the milestone amount with unit", () => {
    renderCard({ ...makeMilestone({ amount: "12500000" }) } as RenderOptions);
    expect(screen.getByText(/12500000 stroops/i)).toBeInTheDocument();
  });
});
