/**
 * Interactive-state suite for ArbiterActionPanel: hover, focus-visible, and
 * disabled styling on every interactive element.
 *
 * jsdom cannot evaluate `:hover` or `:focus-visible`, so these tests assert
 * the Tailwind utilities that drive each state are present, and that the
 * elements actually take focus / become disabled when they should.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import { ARBITER_SUBMIT_TONE } from "@/app/lib/arbiter_action_panel";

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) => render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} {...props} />);

const FOCUS_RING = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-accent-soft",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-surface-card",
];

describe("submit button", () => {
  it("has a keyboard-only focus ring", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-submit")).toHaveClass(...FOCUS_RING);
  });

  it("receives keyboard focus", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByTestId("arbiter-submit")).toHaveFocus();
  });

  it.each([
    [null, "Resolve Dispute", ["bg-accent", "hover:bg-accent-hover", "disabled:hover:bg-accent"]],
    ["release", "Release to Freelancer", ["bg-success", "hover:bg-success/80", "disabled:hover:bg-success"]],
    ["refund", "Refund to Client", ["bg-danger", "hover:bg-danger/80", "disabled:hover:bg-danger"]],
  ] as const)(
    "outcome %s → %s with matching hover tone",
    async (outcome, label, classes) => {
      const user = userEvent.setup();
      renderPanel();
      if (outcome) {
        await user.click(screen.getByRole("radio", { name: new RegExp(label) }));
      }
      const button = screen.getByTestId("arbiter-submit");
      expect(button).toHaveTextContent(label);
      expect(button).toHaveClass(...classes);
    },
  );

  it("has a pressed state that is suppressed when disabled", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-submit")).toHaveClass(
      "active:scale-[0.97]",
      "disabled:active:scale-100",
    );
  });

  it("dims and shows a not-allowed cursor when disabled", () => {
    renderPanel({ isPending: true });
    const button = screen.getByTestId("arbiter-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:opacity-40", "disabled:cursor-not-allowed");
  });

  it.each([
    ["release", "Releasing..."],
    ["refund", "Refunding..."],
  ] as const)("shows a spinner and %s copy while pending", async (outcome, copy) => {
    const user = userEvent.setup();
    const { rerender } = renderPanel();
    await user.click(screen.getByRole("radio", { name: new RegExp(outcome === "release" ? "Release" : "Refund") }));
    rerender(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} isPending />);
    expect(screen.getByTestId("arbiter-submit")).toHaveTextContent(copy);
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
  });

  it("does not fire onResolve when clicked while disabled", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    renderPanel({ onResolve, isPending: true });
    await user.click(screen.getByTestId("arbiter-submit"));
    expect(onResolve).not.toHaveBeenCalled();
  });
});

describe("outcome options", () => {
  it.each(["release", "refund"])("%s option lifts on hover", (value) => {
    renderPanel();
    expect(screen.getByTestId(`arbiter-outcome-${value}`)).toHaveClass(
      "hover:border-accent-soft/60",
      "hover:bg-surface-field/80",
      "transition-colors",
    );
  });

  it("rings the whole option when its radio has keyboard focus", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.tab();
    expect(screen.getByRole("radio", { name: /Release/ })).toHaveFocus();
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass(
      "has-[:focus-visible]:ring-2",
      "has-[:focus-visible]:ring-accent-soft",
      "has-[:focus-visible]:ring-offset-2",
    );
  });

  it("tints the checked option", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-refund")).toHaveClass(
      "has-[:checked]:border-accent-soft",
      "has-[:checked]:bg-accent/10",
    );
  });

  it("dims and drops hover when disabled", () => {
    renderPanel({ isPending: true });
    const option = screen.getByTestId("arbiter-outcome-release");
    expect(option).toHaveClass(
      "has-[:disabled]:opacity-50",
      "has-[:disabled]:cursor-not-allowed",
      "has-[:disabled]:hover:border-border-subtle",
      "has-[:disabled]:hover:bg-surface-field",
    );
    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
  });
});

describe("confirmation checkbox", () => {
  it("has a keyboard-only focus ring", () => {
    renderPanel();
    expect(screen.getByRole("checkbox")).toHaveClass(...FOCUS_RING);
  });

  it("dims its row and disables when pending", () => {
    renderPanel({ isPending: true });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveClass("disabled:cursor-not-allowed");
    expect(checkbox.closest("label")).toHaveClass(
      "has-[:disabled]:opacity-50",
      "has-[:disabled]:cursor-not-allowed",
    );
  });
});

describe("disabled configurations", () => {
  it("disables every control when no handler is configured", () => {
    renderPanel({ onResolve: undefined });
    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByTestId("arbiter-submit")).toBeDisabled();
  });

  it("re-enables controls once the pending transaction settles", () => {
    const { rerender } = renderPanel({ isPending: true });
    expect(screen.getByTestId("arbiter-submit")).toBeDisabled();
    rerender(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    expect(screen.getByTestId("arbiter-submit")).toBeEnabled();
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("keeps each tone's disabled hover pinned to its resting colour", () => {
    Object.values(ARBITER_SUBMIT_TONE).forEach((tone) => {
      const rest = tone.split(" ").find((cls) => cls.startsWith("bg-"))!;
      expect(tone).toContain(`disabled:hover:${rest}`);
    });
  });
});
