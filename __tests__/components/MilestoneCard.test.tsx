/**
 * Unit tests for <MilestoneCard />
 *
 * Coverage strategy
 * ─────────────────
 * 1. Node rendering  – correct DOM structure, text content, CSS classes
 * 2. Status badges   – every known status gets the right colour tokens
 * 3. Unknown status  – graceful fallback styling
 * 4. Button visibility – business-logic rules for which action buttons appear
 * 5. Button interactions – onClick callbacks fire with the correct index arg
 * 6. Callback safety  – optional handlers are never called if omitted (no crash)
 * 7. Edge cases       – index 0, large index, zero-amount, very long amounts
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MilestoneCard from "@/app/components/MilestoneCard";

// ─── helpers ────────────────────────────────────────────────────────────────

interface MilestoneInput {
  index: number;
  amount: string;
  status: string;
}

interface RenderOptions {
  isClient?: boolean;
  isFreelancer?: boolean;
  onMarkDelivered?: jest.Mock;
  onApprove?: jest.Mock;
  onDispute?: jest.Mock;
}

function renderCard(milestone: MilestoneInput, opts: RenderOptions = {}) {
  const {
    isClient = false,
    isFreelancer = false,
    onMarkDelivered,
    onApprove,
    onDispute,
  } = opts;

  return render(
    <MilestoneCard
      milestone={milestone}
      isClient={isClient}
      isFreelancer={isFreelancer}
      onMarkDelivered={onMarkDelivered}
      onApprove={onApprove}
      onDispute={onDispute}
    />
  );
}

// ─── 1. Node rendering ───────────────────────────────────────────────────────

describe("MilestoneCard – node rendering", () => {
  it("renders the outer card container with expected layout classes", () => {
    const { container } = renderCard({ index: 0, amount: "500", status: "Pending" });
    const card = container.firstChild as HTMLElement;

    expect(card).toBeInTheDocument();
    expect(card.tagName).toBe("DIV");
    // Structural classes from the component
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("bg-gray-900");
    expect(card).toHaveClass("flex");
  });

  it("displays the human-readable milestone number (index + 1)", () => {
    renderCard({ index: 0, amount: "500", status: "Pending" });
    expect(screen.getByText("Milestone 1")).toBeInTheDocument();
  });

  it("displays the milestone number for a non-zero index", () => {
    renderCard({ index: 4, amount: "1000", status: "Pending" });
    expect(screen.getByText("Milestone 5")).toBeInTheDocument();
  });

  it("renders the amount with the 'stroops' unit label", () => {
    renderCard({ index: 0, amount: "12345", status: "Pending" });
    expect(screen.getByText("12345 stroops")).toBeInTheDocument();
  });

  it("renders amount as monospace font-mono text", () => {
    renderCard({ index: 0, amount: "999", status: "Pending" });
    const amountEl = screen.getByText("999 stroops");
    expect(amountEl).toHaveClass("font-mono");
  });

  it("renders the status badge text", () => {
    renderCard({ index: 0, amount: "100", status: "Released" });
    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  it("renders milestone label with muted gray colour class", () => {
    renderCard({ index: 2, amount: "300", status: "Pending" });
    const label = screen.getByText("Milestone 3");
    expect(label).toHaveClass("text-gray-400");
  });
});

// ─── 2. Status badge CSS classes ─────────────────────────────────────────────

describe("MilestoneCard – status badge styling", () => {
  const cases: Array<[string, string, string, string]> = [
    ["Pending",   "bg-yellow-500/10", "text-yellow-400", "border-yellow-500/20"],
    ["Delivered", "bg-blue-500/10",   "text-blue-400",   "border-blue-500/20"],
    ["Released",  "bg-green-500/10",  "text-green-400",  "border-green-500/20"],
    ["Disputed",  "bg-red-500/10",    "text-red-400",    "border-red-500/20"],
    ["Refunded",  "bg-gray-500/10",   "text-gray-400",   "border-gray-500/20"],
  ];

  test.each(cases)(
    'status "%s" renders badge with bg=%s text=%s border=%s',
    (status, bg, text, border) => {
      renderCard({ index: 0, amount: "100", status });
      const badge = screen.getByText(status);
      expect(badge).toHaveClass(bg);
      expect(badge).toHaveClass(text);
      expect(badge).toHaveClass(border);
    }
  );

  it("badge is a <span> element", () => {
    renderCard({ index: 0, amount: "100", status: "Pending" });
    const badge = screen.getByText("Pending");
    expect(badge.tagName).toBe("SPAN");
  });
});

// ─── 3. Unknown / fallback status ────────────────────────────────────────────

describe("MilestoneCard – unknown status fallback", () => {
  it("renders an unknown status string as badge text", () => {
    renderCard({ index: 0, amount: "100", status: "Cancelled" });
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("applies fallback classes when status is not in the colour map", () => {
    renderCard({ index: 0, amount: "100", status: "Cancelled" });
    const badge = screen.getByText("Cancelled");
    expect(badge).toHaveClass("bg-gray-800");
    expect(badge).toHaveClass("text-gray-400");
  });

  it("renders an empty-string status without crashing", () => {
    renderCard({ index: 0, amount: "100", status: "" });
    // The badge should exist but show no text — just verify no throw
    const { container } = renderCard({ index: 0, amount: "100", status: "" });
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ─── 4. Button visibility rules ──────────────────────────────────────────────

describe("MilestoneCard – button visibility", () => {
  // "Mark Delivered" — only for freelancer + Pending
  describe('"Mark Delivered" button', () => {
    it("shown to freelancer when status is Pending", () => {
      renderCard(
        { index: 0, amount: "100", status: "Pending" },
        { isFreelancer: true }
      );
      expect(screen.getByRole("button", { name: /mark delivered/i })).toBeInTheDocument();
    });

    it("hidden from freelancer when status is Delivered", () => {
      renderCard(
        { index: 0, amount: "100", status: "Delivered" },
        { isFreelancer: true }
      );
      expect(screen.queryByRole("button", { name: /mark delivered/i })).toBeNull();
    });

    it("hidden from freelancer when status is Released", () => {
      renderCard(
        { index: 0, amount: "100", status: "Released" },
        { isFreelancer: true }
      );
      expect(screen.queryByRole("button", { name: /mark delivered/i })).toBeNull();
    });

    it("hidden from client even when status is Pending", () => {
      renderCard(
        { index: 0, amount: "100", status: "Pending" },
        { isClient: true }
      );
      expect(screen.queryByRole("button", { name: /mark delivered/i })).toBeNull();
    });

    it("hidden from anonymous user", () => {
      renderCard({ index: 0, amount: "100", status: "Pending" });
      expect(screen.queryByRole("button", { name: /mark delivered/i })).toBeNull();
    });
  });

  // "Approve" — only for client + Delivered
  describe('"Approve" button', () => {
    it("shown to client when status is Delivered", () => {
      renderCard(
        { index: 0, amount: "100", status: "Delivered" },
        { isClient: true }
      );
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });

    it("hidden from client when status is Pending", () => {
      renderCard(
        { index: 0, amount: "100", status: "Pending" },
        { isClient: true }
      );
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    });

    it("hidden from client when status is Released", () => {
      renderCard(
        { index: 0, amount: "100", status: "Released" },
        { isClient: true }
      );
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    });

    it("hidden from freelancer even when status is Delivered", () => {
      renderCard(
        { index: 0, amount: "100", status: "Delivered" },
        { isFreelancer: true }
      );
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    });

    it("hidden from anonymous user", () => {
      renderCard({ index: 0, amount: "100", status: "Delivered" });
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    });
  });

  // "Dispute" — client OR freelancer + Pending or Delivered
  describe('"Dispute" button', () => {
    it("shown to client when status is Pending", () => {
      renderCard(
        { index: 0, amount: "100", status: "Pending" },
        { isClient: true }
      );
      expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
    });

    it("shown to client when status is Delivered", () => {
      renderCard(
        { index: 0, amount: "100", status: "Delivered" },
        { isClient: true }
      );
      expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
    });

    it("shown to freelancer when status is Pending", () => {
      renderCard(
        { index: 0, amount: "100", status: "Pending" },
        { isFreelancer: true }
      );
      expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
    });

    it("shown to freelancer when status is Delivered", () => {
      renderCard(
        { index: 0, amount: "100", status: "Delivered" },
        { isFreelancer: true }
      );
      expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
    });

    it("hidden when status is Released (client)", () => {
      renderCard(
        { index: 0, amount: "100", status: "Released" },
        { isClient: true }
      );
      expect(screen.queryByRole("button", { name: /dispute/i })).toBeNull();
    });

    it("hidden when status is Disputed (client)", () => {
      renderCard(
        { index: 0, amount: "100", status: "Disputed" },
        { isClient: true }
      );
      expect(screen.queryByRole("button", { name: /dispute/i })).toBeNull();
    });

    it("hidden when status is Refunded (freelancer)", () => {
      renderCard(
        { index: 0, amount: "100", status: "Refunded" },
        { isFreelancer: true }
      );
      expect(screen.queryByRole("button", { name: /dispute/i })).toBeNull();
    });

    it("hidden from anonymous user", () => {
      renderCard({ index: 0, amount: "100", status: "Pending" });
      expect(screen.queryByRole("button", { name: /dispute/i })).toBeNull();
    });
  });

  // No buttons at all for terminal states
  describe("terminal status – no action buttons", () => {
    it.each(["Released", "Disputed", "Refunded"])(
      "status %s shows no buttons even when both roles are true",
      (status) => {
        renderCard(
          { index: 0, amount: "100", status },
          { isClient: true, isFreelancer: true }
        );
        expect(screen.queryByRole("button")).toBeNull();
      }
    );
  });
});

// ─── 5. Button click callbacks ────────────────────────────────────────────────

describe("MilestoneCard – button interactions", () => {
  it("calls onMarkDelivered with the milestone index when clicked", async () => {
    const onMarkDelivered = jest.fn();
    renderCard(
      { index: 2, amount: "500", status: "Pending" },
      { isFreelancer: true, onMarkDelivered }
    );
    await userEvent.click(screen.getByRole("button", { name: /mark delivered/i }));
    expect(onMarkDelivered).toHaveBeenCalledTimes(1);
    expect(onMarkDelivered).toHaveBeenCalledWith(2);
  });

  it("calls onApprove with the milestone index when clicked", async () => {
    const onApprove = jest.fn();
    renderCard(
      { index: 3, amount: "750", status: "Delivered" },
      { isClient: true, onApprove }
    );
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(3);
  });

  it("calls onDispute (client) with the milestone index when clicked", async () => {
    const onDispute = jest.fn();
    renderCard(
      { index: 1, amount: "200", status: "Pending" },
      { isClient: true, onDispute }
    );
    await userEvent.click(screen.getByRole("button", { name: /dispute/i }));
    expect(onDispute).toHaveBeenCalledTimes(1);
    expect(onDispute).toHaveBeenCalledWith(1);
  });

  it("calls onDispute (freelancer) with the milestone index when clicked", async () => {
    const onDispute = jest.fn();
    renderCard(
      { index: 0, amount: "100", status: "Delivered" },
      { isFreelancer: true, onDispute }
    );
    await userEvent.click(screen.getByRole("button", { name: /dispute/i }));
    expect(onDispute).toHaveBeenCalledTimes(1);
    expect(onDispute).toHaveBeenCalledWith(0);
  });

  it("passes index 0 correctly (not falsy-skipped)", async () => {
    const onMarkDelivered = jest.fn();
    renderCard(
      { index: 0, amount: "100", status: "Pending" },
      { isFreelancer: true, onMarkDelivered }
    );
    await userEvent.click(screen.getByRole("button", { name: /mark delivered/i }));
    expect(onMarkDelivered).toHaveBeenCalledWith(0);
  });

  it("does not call handlers for other buttons on a single click", async () => {
    const onMarkDelivered = jest.fn();
    const onDispute = jest.fn();
    renderCard(
      { index: 0, amount: "100", status: "Pending" },
      { isFreelancer: true, onMarkDelivered, onDispute }
    );
    await userEvent.click(screen.getByRole("button", { name: /mark delivered/i }));
    expect(onMarkDelivered).toHaveBeenCalledTimes(1);
    expect(onDispute).not.toHaveBeenCalled();
  });
});

// ─── 6. Optional callback safety (no crash when handlers are undefined) ───────

describe("MilestoneCard – optional callback safety", () => {
  it("does not throw when onMarkDelivered is omitted and button is clicked", async () => {
    renderCard(
      { index: 0, amount: "100", status: "Pending" },
      { isFreelancer: true /* no onMarkDelivered */ }
    );
    await expect(
      userEvent.click(screen.getByRole("button", { name: /mark delivered/i }))
    ).resolves.not.toThrow();
  });

  it("does not throw when onApprove is omitted and button is clicked", async () => {
    renderCard(
      { index: 0, amount: "100", status: "Delivered" },
      { isClient: true /* no onApprove */ }
    );
    await expect(
      userEvent.click(screen.getByRole("button", { name: /approve/i }))
    ).resolves.not.toThrow();
  });

  it("does not throw when onDispute is omitted and button is clicked", async () => {
    renderCard(
      { index: 0, amount: "100", status: "Pending" },
      { isClient: true /* no onDispute */ }
    );
    await expect(
      userEvent.click(screen.getByRole("button", { name: /dispute/i }))
    ).resolves.not.toThrow();
  });
});

// ─── 7. Edge cases ────────────────────────────────────────────────────────────

describe("MilestoneCard – edge cases", () => {
  it("renders a zero-amount milestone correctly", () => {
    renderCard({ index: 0, amount: "0", status: "Pending" });
    expect(screen.getByText("0 stroops")).toBeInTheDocument();
  });

  it("renders a very large amount string without truncation", () => {
    const big = "9999999999999";
    renderCard({ index: 0, amount: big, status: "Pending" });
    expect(screen.getByText(`${big} stroops`)).toBeInTheDocument();
  });

  it("renders a high milestone index (e.g. 99) as Milestone 100", () => {
    renderCard({ index: 99, amount: "100", status: "Pending" });
    expect(screen.getByText("Milestone 100")).toBeInTheDocument();
  });

  it("when both isClient and isFreelancer are true on Pending, all three buttons appear", () => {
    renderCard(
      { index: 0, amount: "100", status: "Pending" },
      { isClient: true, isFreelancer: true }
    );
    expect(screen.getByRole("button", { name: /mark delivered/i })).toBeInTheDocument();
    // Approve is not shown for Pending even for client
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
  });

  it("when both isClient and isFreelancer are true on Delivered, Approve and Dispute appear", () => {
    renderCard(
      { index: 0, amount: "100", status: "Delivered" },
      { isClient: true, isFreelancer: true }
    );
    // Mark Delivered is not shown for Delivered status
    expect(screen.queryByRole("button", { name: /mark delivered/i })).toBeNull();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
  });

  it("snapshot – Pending milestone as freelancer", () => {
    const { container } = renderCard(
      { index: 0, amount: "500", status: "Pending" },
      { isFreelancer: true, onMarkDelivered: jest.fn(), onDispute: jest.fn() }
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot – Released milestone (no buttons)", () => {
    const { container } = renderCard(
      { index: 2, amount: "1500", status: "Released" },
      { isClient: true }
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
