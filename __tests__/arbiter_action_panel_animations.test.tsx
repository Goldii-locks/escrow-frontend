/**
 * Animation suite for ArbiterActionPanel.
 *
 * jsdom does not run CSS animations, so these tests assert that the right
 * keyframe / transition utilities are applied at the right moment, that
 * animations replay when state changes (by remounting the animated node),
 * that the keyframes exist in globals.css, and that every animation is
 * disabled under `prefers-reduced-motion`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel, {
  ArbiterPanelPlaceholder,
} from "@/app/components/ArbiterActionPanel";
import { ARBITER_PANEL_MOTION } from "@/app/lib/arbiter_action_panel";

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) => render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} {...props} />);

describe("motion tokens", () => {
  const globalsCss = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it.each(["fade-in", "slide-in", "shake"])(
    "keyframe %s used by the panel exists in globals.css",
    (name) => {
      expect(globalsCss).toMatch(new RegExp(`@keyframes ${name}\\s*\\{`));
      expect(globalsCss).toContain(`.animate-${name}`);
    },
  );

  it.each(Object.entries(ARBITER_PANEL_MOTION))(
    "%s is switched off under reduced motion",
    (_name, classes) => {
      const usesAnimation = /\banimate-(?!none)/.test(classes);
      const usesTransition = /(^|\s)transition(-|\s|$)/.test(classes);
      if (usesAnimation) expect(classes).toContain("motion-reduce:animate-none");
      if (usesTransition) expect(classes).toContain("motion-reduce:transition-none");
      expect(usesAnimation || usesTransition).toBe(true);
    },
  );

  it("keeps durations subtle (at most 300ms)", () => {
    Object.values(ARBITER_PANEL_MOTION).forEach((classes) => {
      const durations = [...classes.matchAll(/duration-(\d+)/g)].map((m) => Number(m[1]));
      durations.forEach((ms) => expect(ms).toBeLessThanOrEqual(300));
    });
  });
});

describe("mount and state-change animations", () => {
  it("fades the panel in on mount", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveClass(
      "animate-fade-in",
      "motion-reduce:animate-none",
    );
  });

  it("fades the placeholder in on mount", () => {
    render(<ArbiterPanelPlaceholder variant="no-disputes" />);
    expect(screen.getByTestId("arbiter-panel-placeholder")).toHaveClass("animate-fade-in");
  });

  it("slides field errors in when validation fails", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByTestId("arbiter-submit"));
    expect(screen.getByTestId("arbiter-outcome-error")).toHaveClass("animate-slide-in");
    expect(screen.getByTestId("arbiter-confirm-error")).toHaveClass("animate-slide-in");
  });

  it("replays the error animation on every failed submit", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByTestId("arbiter-submit"));
    const first = screen.getByTestId("arbiter-outcome-error");
    await user.click(screen.getByTestId("arbiter-submit"));
    const second = screen.getByTestId("arbiter-outcome-error");
    expect(second).not.toBe(first);
    expect(second).toHaveClass("animate-slide-in");
  });

  it("shakes the panel alert when it appears", () => {
    renderPanel({ onResolve: undefined });
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveClass(
      "animate-shake",
      "motion-reduce:animate-none",
    );
  });

  it("fades the transaction status in", () => {
    renderPanel({ resolveState: { phase: "success", error: null, txHash: null } });
    expect(screen.getByTestId("arbiter-panel-status")).toHaveClass("animate-fade-in");
  });

  it("cross-fades the submit label when the outcome changes", async () => {
    const user = userEvent.setup();
    renderPanel();
    const initial = screen.getByTestId("arbiter-submit-label");
    expect(initial).toHaveTextContent("Resolve Dispute");
    expect(initial).toHaveClass("animate-fade-in", "inline-block");

    await user.click(screen.getByRole("radio", { name: /Release/ }));
    const release = screen.getByTestId("arbiter-submit-label");
    expect(release).not.toBe(initial);
    expect(release).toHaveTextContent("Release to Freelancer");

    await user.click(screen.getByRole("radio", { name: /Refund/ }));
    const refund = screen.getByTestId("arbiter-submit-label");
    expect(refund).not.toBe(release);
    expect(refund).toHaveTextContent("Refund to Client");
  });

  it("keeps the same label node when the label does not change", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("radio", { name: /Release/ }));
    const label = screen.getByTestId("arbiter-submit-label");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByTestId("arbiter-submit-label")).toBe(label);
  });
});

describe("panel state transitions", () => {
  it("eases the border tint between states", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveClass(
      "transition-colors",
      "duration-300",
      "data-[state=invalid]:border-danger-soft/40",
      "data-[state=ready]:border-accent-soft/50",
    );
  });

  it("moves idle → invalid → idle → ready as the arbiter interacts", async () => {
    const user = userEvent.setup();
    renderPanel();
    const panel = screen.getByTestId("arbiter-action-panel");
    expect(panel).toHaveAttribute("data-state", "idle");

    await user.click(screen.getByTestId("arbiter-submit"));
    expect(panel).toHaveAttribute("data-state", "invalid");

    await user.click(screen.getByRole("radio", { name: /Refund/ }));
    expect(panel).toHaveAttribute("data-state", "invalid");

    await user.click(screen.getByRole("checkbox"));
    expect(panel).toHaveAttribute("data-state", "ready");
  });

  it("reports pending and blocked states", () => {
    const { rerender } = renderPanel({ isPending: true });
    expect(screen.getByTestId("arbiter-action-panel")).toHaveAttribute(
      "data-state",
      "pending",
    );
    rerender(<ArbiterActionPanel milestoneIndex={0} />);
    expect(screen.getByTestId("arbiter-action-panel")).toHaveAttribute(
      "data-state",
      "blocked",
    );
  });

  it("marks the checked outcome for its tint transition", async () => {
    const user = userEvent.setup();
    renderPanel();
    const release = screen.getByTestId("arbiter-outcome-release");
    expect(release).toHaveAttribute("data-checked", "false");
    await user.click(release);
    expect(release).toHaveAttribute("data-checked", "true");
    expect(screen.getByTestId("arbiter-outcome-refund")).toHaveAttribute(
      "data-checked",
      "false",
    );
  });
});

describe("click feedback", () => {
  it("scales outcome options on press with an eased transition", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass(
      "transition",
      "duration-200",
      "ease-out",
      "active:scale-[0.98]",
      "motion-reduce:transition-none",
      "motion-reduce:active:scale-100",
    );
  });

  it("drops the press scale on disabled options", () => {
    renderPanel({ isPending: true });
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass(
      "has-[:disabled]:active:scale-100",
    );
  });

  it("scales the submit button on press, except when disabled or reduced", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-submit")).toHaveClass(
      "transition-all",
      "duration-200",
      "ease-out",
      "active:scale-[0.97]",
      "disabled:active:scale-100",
      "motion-reduce:active:scale-100",
      "motion-reduce:transition-none",
    );
  });

  it("eases the checkbox state change", () => {
    renderPanel();
    expect(screen.getByRole("checkbox")).toHaveClass(
      "transition",
      "duration-200",
      "motion-reduce:transition-none",
    );
  });
});
