/**
 * MilestoneCard – accessibility & behaviour test suite
 *
 * Covers:
 *  1. ARIA semantics  (role, aria-label, role="status")
 *  2. Keyboard navigability  (tab order, Enter / Space activation)
 *  3. Colour-contrast class audit  (upgraded *-300 text tokens)
 *  4. Conditional button rendering per role & status
 *  5. Callback wiring
 *  6. Unknown-status fallback
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MilestoneCard from "../MilestoneCard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MilestoneOverride {
  index?: number;
  amount?: string;
  status?: string;
}

interface PropsOverride {
  isClient?: boolean;
  isFreelancer?: boolean;
  onMarkDelivered?: (i: number) => void;
  onApprove?: (i: number) => void;
  onDispute?: (i: number) => void;
}

function renderCard(
  milestoneOverrides: MilestoneOverride = {},
  propsOverrides: PropsOverride = {}
) {
  const milestone = {
    index: 0,
    amount: "1000000",
    status: "Pending",
    ...milestoneOverrides,
  };
  const props = {
    isClient: false,
    isFreelancer: false,
    ...propsOverrides,
  };
  return render(<MilestoneCard milestone={milestone} {...props} />);
}

// ---------------------------------------------------------------------------
// 1. ARIA Semantics
// ---------------------------------------------------------------------------

describe("ARIA semantics", () => {
  it('renders an <article> with role="article" implicitly', () => {
    renderCard();
    // <article> exposes the "article" role in the accessibility tree
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("article aria-label includes the milestone number and status", () => {
    renderCard({ index: 2, status: "Released" });
    const article = screen.getByRole("article");
    expect(article).toHaveAccessibleName(/Milestone 3/i);
    expect(article).toHaveAccessibleName(/Released/i);
  });

  it('status badge has role="status"', () => {
    renderCard({ status: "Pending" });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("status badge aria-label includes milestone number and status text", () => {
    renderCard({ index: 0, status: "Delivered" });
    const badge = screen.getByRole("status");
    expect(badge).toHaveAccessibleName(/Milestone 1 status: Delivered/i);
  });

  it("milestone heading is rendered as h3 for document hierarchy", () => {
    renderCard({ index: 1 });
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Milestone 2"
    );
  });

  it("amount paragraph is visible and contains the amount", () => {
    renderCard({ amount: "5000000" });
    expect(screen.getByText(/5000000/)).toBeInTheDocument();
  });

  it("stroops abbreviation has a title attribute for screen-reader clarity", () => {
    renderCard();
    const abbr = document.querySelector("abbr[title]") as HTMLElement;
    expect(abbr).toBeInTheDocument();
    expect(abbr.getAttribute("title")).toMatch(/stroops/i);
  });
});

// ---------------------------------------------------------------------------
// 2. Colour-contrast class audit (upgraded tokens)
// ---------------------------------------------------------------------------

describe("Colour-contrast classes (WCAG AA compliant tokens)", () => {
  const statusTokenMap: Record<string, string> = {
    Pending: "text-yellow-300",
    Delivered: "text-blue-300",
    Released: "text-green-300",
    Disputed: "text-red-300",
    Refunded: "text-gray-300",
  };

  for (const [status, expectedClass] of Object.entries(statusTokenMap)) {
    it(`${status} badge uses ${expectedClass} for sufficient contrast`, () => {
      renderCard({ status });
      const badge = screen.getByRole("status");
      // The class should be present on the element (Tailwind utility token)
      expect(badge.className).toContain(expectedClass);
    });
  }

  it("milestone label uses text-gray-300 (not text-gray-400) for contrast", () => {
    renderCard({ index: 0 });
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.className).toContain("text-gray-300");
    expect(heading.className).not.toContain("text-gray-400");
  });
});

// ---------------------------------------------------------------------------
// 3. Conditional button rendering
// ---------------------------------------------------------------------------

describe("Conditional button rendering", () => {
  describe("Mark Delivered button", () => {
    it("shown to freelancer when status is Pending", () => {
      renderCard({ status: "Pending" }, { isFreelancer: true });
      expect(
        screen.getByRole("button", { name: /mark milestone 1 as delivered/i })
      ).toBeInTheDocument();
    });

    it("hidden from client when status is Pending", () => {
      renderCard({ status: "Pending" }, { isClient: true });
      expect(
        screen.queryByRole("button", { name: /mark.*delivered/i })
      ).not.toBeInTheDocument();
    });

    it("hidden from freelancer when status is not Pending", () => {
      renderCard({ status: "Delivered" }, { isFreelancer: true });
      expect(
        screen.queryByRole("button", { name: /mark.*delivered/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Approve button", () => {
    it("shown to client when status is Delivered", () => {
      renderCard({ status: "Delivered" }, { isClient: true });
      expect(
        screen.getByRole("button", { name: /approve milestone 1/i })
      ).toBeInTheDocument();
    });

    it("hidden from freelancer when status is Delivered", () => {
      renderCard({ status: "Delivered" }, { isFreelancer: true });
      expect(
        screen.queryByRole("button", { name: /approve/i })
      ).not.toBeInTheDocument();
    });

    it("hidden from client when status is Pending", () => {
      renderCard({ status: "Pending" }, { isClient: true });
      expect(
        screen.queryByRole("button", { name: /approve/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Dispute button", () => {
    it.each(["Pending", "Delivered"])(
      "shown to client when status is %s",
      (status) => {
        renderCard({ status }, { isClient: true });
        expect(
          screen.getByRole("button", { name: /dispute milestone 1/i })
        ).toBeInTheDocument();
      }
    );

    it.each(["Pending", "Delivered"])(
      "shown to freelancer when status is %s",
      (status) => {
        renderCard({ status }, { isFreelancer: true });
        expect(
          screen.getByRole("button", { name: /dispute milestone 1/i })
        ).toBeInTheDocument();
      }
    );

    it.each(["Released", "Disputed", "Refunded"])(
      "hidden for both roles when status is %s",
      (status) => {
        renderCard({ status }, { isClient: true, isFreelancer: true });
        expect(
          screen.queryByRole("button", { name: /dispute/i })
        ).not.toBeInTheDocument();
      }
    );
  });

  it("no buttons rendered when viewer is neither client nor freelancer", () => {
    renderCard({ status: "Pending" }, { isClient: false, isFreelancer: false });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Keyboard navigability
// ---------------------------------------------------------------------------

describe("Keyboard navigability", () => {
  it("Mark Delivered button is reachable via Tab", async () => {
    const user = userEvent.setup();
    renderCard({ status: "Pending" }, { isFreelancer: true });
    await user.tab();
    expect(
      screen.getByRole("button", { name: /mark milestone 1 as delivered/i })
    ).toHaveFocus();
  });

  it("Approve button is reachable via Tab", async () => {
    const user = userEvent.setup();
    renderCard({ status: "Delivered" }, { isClient: true });
    await user.tab();
    expect(
      screen.getByRole("button", { name: /approve milestone 1/i })
    ).toHaveFocus();
  });

  it("Dispute button is reachable via Tab when Approve is also present", async () => {
    const user = userEvent.setup();
    renderCard({ status: "Delivered" }, { isClient: true });
    await user.tab(); // Approve
    await user.tab(); // Dispute
    expect(
      screen.getByRole("button", { name: /dispute milestone 1/i })
    ).toHaveFocus();
  });

  it("Enter key activates Mark Delivered button", async () => {
    const user = userEvent.setup();
    const onMarkDelivered = vi.fn();
    renderCard(
      { index: 0, status: "Pending" },
      { isFreelancer: true, onMarkDelivered }
    );
    const btn = screen.getByRole("button", {
      name: /mark milestone 1 as delivered/i,
    });
    btn.focus();
    await user.keyboard("{Enter}");
    expect(onMarkDelivered).toHaveBeenCalledWith(0);
  });

  it("Space key activates Approve button", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    renderCard({ index: 0, status: "Delivered" }, { isClient: true, onApprove });
    const btn = screen.getByRole("button", { name: /approve milestone 1/i });
    btn.focus();
    await user.keyboard(" ");
    expect(onApprove).toHaveBeenCalledWith(0);
  });

  it("Space key activates Dispute button", async () => {
    const user = userEvent.setup();
    const onDispute = vi.fn();
    renderCard(
      { index: 0, status: "Pending" },
      { isClient: true, onDispute }
    );
    const btn = screen.getByRole("button", { name: /dispute milestone 1/i });
    btn.focus();
    await user.keyboard(" ");
    expect(onDispute).toHaveBeenCalledWith(0);
  });

  it("all visible buttons have focus-visible ring classes for keyboard users", () => {
    renderCard(
      { status: "Delivered" },
      { isClient: true, isFreelancer: true }
    );
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-visible:ring-2");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Callback wiring
// ---------------------------------------------------------------------------

describe("Callback wiring", () => {
  it("onMarkDelivered is called with the correct index on click", async () => {
    const user = userEvent.setup();
    const onMarkDelivered = vi.fn();
    renderCard(
      { index: 2, status: "Pending" },
      { isFreelancer: true, onMarkDelivered }
    );
    await user.click(
      screen.getByRole("button", { name: /mark milestone 3 as delivered/i })
    );
    expect(onMarkDelivered).toHaveBeenCalledTimes(1);
    expect(onMarkDelivered).toHaveBeenCalledWith(2);
  });

  it("onApprove is called with the correct index on click", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    renderCard({ index: 1, status: "Delivered" }, { isClient: true, onApprove });
    await user.click(
      screen.getByRole("button", { name: /approve milestone 2/i })
    );
    expect(onApprove).toHaveBeenCalledWith(1);
  });

  it("onDispute is called with the correct index on click", async () => {
    const user = userEvent.setup();
    const onDispute = vi.fn();
    renderCard(
      { index: 3, status: "Pending" },
      { isClient: true, onDispute }
    );
    await user.click(
      screen.getByRole("button", { name: /dispute milestone 4/i })
    );
    expect(onDispute).toHaveBeenCalledWith(3);
  });

  it("does not throw when optional callbacks are omitted", async () => {
    const user = userEvent.setup();
    renderCard({ status: "Pending" }, { isFreelancer: true });
    // No onMarkDelivered provided – should not throw
    await expect(
      user.click(
        screen.getByRole("button", { name: /mark milestone 1 as delivered/i })
      )
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Unknown status fallback
// ---------------------------------------------------------------------------

describe("Unknown status fallback", () => {
  it("renders without crashing for an unrecognised status", () => {
    renderCard({ status: "UnknownState" });
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("UnknownState");
  });

  it("applies fallback classes (bg-gray-800, text-gray-300) for unknown status", () => {
    renderCard({ status: "UnknownState" });
    const badge = screen.getByRole("status");
    // fallback style must still have a reasonable text color
    expect(badge.className).toContain("text-gray-300");
  });
});

// ---------------------------------------------------------------------------
// 7. Multiple milestones share no aria-label collision
// ---------------------------------------------------------------------------

describe("Multi-milestone list", () => {
  it("each card has a unique accessible name", () => {
    const milestones = [
      { index: 0, amount: "1000", status: "Pending" },
      { index: 1, amount: "2000", status: "Delivered" },
      { index: 2, amount: "3000", status: "Released" },
    ];

    const { container } = render(
      <ul>
        {milestones.map((m) => (
          <li key={m.index}>
            <MilestoneCard
              milestone={m}
              isClient={false}
              isFreelancer={false}
            />
          </li>
        ))}
      </ul>
    );

    const articles = container.querySelectorAll("article");
    const labels = Array.from(articles).map((a) =>
      a.getAttribute("aria-label")
    );
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(milestones.length);
  });
});
