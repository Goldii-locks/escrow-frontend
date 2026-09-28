/**
 * Accessibility suite for ArbiterActionPanel.
 *
 * Covers ARIA landmarks and labelling, error wiring (aria-invalid /
 * aria-describedby / live regions), and keyboard navigability. Colour
 * contrast is audited against the design tokens in arbiter_action_panel.test.ts.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import MilestoneCard from "@/app/components/MilestoneCard";

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) =>
  render(
    <ArbiterActionPanel
      milestoneIndex={2}
      displayAmount="30 XLM"
      escrowAmount="300000000"
      onResolve={vi.fn()}
      {...props}
    />,
  );

describe("ArbiterActionPanel — ARIA", () => {
  it("is a labelled region named after the milestone", () => {
    renderPanel();
    const region = screen.getByRole("region", {
      name: "Resolve dispute — Milestone 3",
    });
    expect(region).toBe(screen.getByTestId("arbiter-action-panel"));
  });

  it("describes the region with the finality warning", () => {
    renderPanel();
    expect(screen.getByRole("region")).toHaveAccessibleDescription(
      /disputed 30 XLM goes\. This decision is final/,
    );
  });

  it("uses a heading for the panel title", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { level: 3, name: /Milestone 3/ }),
    ).toBeInTheDocument();
  });

  it("groups the outcomes in a named, required radio group", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Outcome" });
    expect(group).toHaveAttribute("aria-required", "true");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName("Release to Freelancer for Milestone 3");
    expect(radios[1]).toHaveAccessibleName("Refund to Client for Milestone 3");
  });

  it("labels the confirmation checkbox and marks it required", () => {
    renderPanel();
    const checkbox = screen.getByRole("checkbox", {
      name: "I understand this decision is final.",
    });
    expect(checkbox).toHaveAttribute("aria-required", "true");
  });

  it("gives the submit button an accessible name", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Resolve Dispute" })).toBeInTheDocument();
  });

  it("marks the region busy while a resolution is pending", () => {
    const { rerender } = renderPanel();
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "false");
    rerender(
      <ArbiterActionPanel milestoneIndex={2} onResolve={vi.fn()} isPending />,
    );
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
  });

  it("hides the spinner from assistive tech", () => {
    renderPanel({ isPending: true });
    expect(screen.getByTestId("button-spinner")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not flag fields invalid before a submit attempt", () => {
    renderPanel();
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("checkbox")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("links field errors via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Resolve Dispute" }));

    const group = screen.getByRole("group", { name: "Outcome" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription(
      "Select how the disputed funds should be distributed.",
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription(
      "Confirm that you understand this decision is final.",
    );
  });

  it("announces field errors through polite alerts", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Resolve Dispute" }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    alerts.forEach((alert) => expect(alert).toHaveAttribute("aria-live", "polite"));
  });

  it("announces panel errors assertively and links them to the button", () => {
    renderPanel({ onResolve: undefined });
    const alert = screen.getByTestId("arbiter-panel-alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByRole("button")).toHaveAccessibleDescription(alert.textContent!);
  });

  it("mirrors disabled into aria-disabled on the submit button", () => {
    renderPanel({ isPending: true });
    const button = screen.getByTestId("arbiter-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("uses unique ids across multiple panels", () => {
    render(
      <>
        <ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />
        <ArbiterActionPanel milestoneIndex={1} onResolve={vi.fn()} />
      </>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const [first, second] = screen.getAllByRole("radio", { name: /Release/ });
    expect(first).not.toHaveAttribute("name", second.getAttribute("name")!);
  });
});

describe("ArbiterActionPanel — keyboard navigation", () => {
  it("tabs through radio group, checkbox, then submit", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.tab();
    expect(screen.getByRole("radio", { name: /Release/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Resolve Dispute" })).toHaveFocus();
  });

  it("selects an outcome with Space and moves between outcomes with arrow keys", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: /Release/ })).toBeChecked();

    await user.keyboard("{ArrowDown}");
    const refund = screen.getByRole("radio", { name: /Refund/ });
    expect(refund).toHaveFocus();
    expect(refund).toBeChecked();
  });

  it("toggles the confirmation with Space", async () => {
    const user = userEvent.setup();
    renderPanel();
    screen.getByRole("checkbox").focus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("completes a resolution from the keyboard alone", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    renderPanel({ onResolve });

    await user.tab(); // release radio
    await user.keyboard("{ArrowDown}"); // refund
    await user.tab(); // checkbox
    await user.keyboard(" ");
    await user.tab(); // submit
    await user.keyboard("{Enter}");

    expect(onResolve).toHaveBeenCalledWith(2, false);
  });

  it("skips disabled controls in the tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ArbiterActionPanel milestoneIndex={0} isPending onResolve={vi.fn()} />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });
});

describe("MilestoneCard — arbiter panel integration", () => {
  const idle = { phase: "idle" as const, error: null, txHash: null };
  const cardProps = {
    isClient: false,
    isFreelancer: false,
    partialReleaseState: idle,
    claimAutoReleaseState: idle,
    isPartialReleasePending: false,
    isClaimAutoReleasePending: false,
  };

  it("renders the panel only for an arbiter on a disputed milestone", () => {
    const { rerender } = render(
      <MilestoneCard
        {...cardProps}
        isArbiter
        milestone={{ index: 0, amount: "100", status: "Disputed" }}
        onResolveDispute={vi.fn()}
      />,
    );
    expect(screen.getByTestId("arbiter-action-panel")).toBeInTheDocument();

    rerender(
      <MilestoneCard
        {...cardProps}
        isArbiter={false}
        milestone={{ index: 0, amount: "100", status: "Disputed" }}
      />,
    );
    expect(screen.queryByTestId("arbiter-action-panel")).not.toBeInTheDocument();

    rerender(
      <MilestoneCard
        {...cardProps}
        isArbiter
        milestone={{ index: 0, amount: "100", status: "Pending" }}
      />,
    );
    expect(screen.queryByTestId("arbiter-action-panel")).not.toBeInTheDocument();
  });

  it("forwards the resolution to onResolveDispute", async () => {
    const user = userEvent.setup();
    const onResolveDispute = vi.fn();
    render(
      <MilestoneCard
        {...cardProps}
        isArbiter
        milestone={{ index: 4, amount: "100", status: "Disputed" }}
        onResolveDispute={onResolveDispute}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /Release/ }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Release to Freelancer" }));
    expect(onResolveDispute).toHaveBeenCalledWith(4, true);
  });

  it("blocks resolution when the milestone has no unreleased funds", () => {
    render(
      <MilestoneCard
        {...cardProps}
        isArbiter
        milestone={{ index: 0, amount: "100", releasedAmount: "100", status: "Disputed" }}
        onResolveDispute={vi.fn()}
      />,
    );
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveTextContent(
      "no escrowed funds left",
    );
    expect(screen.getByTestId("arbiter-submit")).toBeDisabled();
  });
});
