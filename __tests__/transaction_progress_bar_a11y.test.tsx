/**
 * Accessibility audit for TransactionProgressBar: ARIA roles, names and
 * states; keyboard navigability (only actionable steps are tab stops, the
 * overlay takes focus and closes on Escape); and WCAG AA colour contrast,
 * including mid-animation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TransactionProgressBar, {
  DEFAULT_TRANSACTION_STEPS,
} from "@/app/components/TransactionProgressBar";
import {
  PROGRESS_BAR_ANIMATION_CLASSES,
  PROGRESS_BAR_CONTRAST_PAIRS,
  PROGRESS_BAR_PULSE_MIN_OPACITY,
  TRANSACTION_PROGRESS_TOKENS,
  getProgressAnnouncement,
  getProgressStepName,
  getProgressStepState,
  resolveProgressBarColour,
} from "@/app/lib/transaction_progress_bar";
import {
  WCAG_AA_NORMAL_TEXT,
  blendOver,
  contrastRatio,
  parseThemeColourTokens,
} from "@/app/lib/theme_tokens";

const globalsCss = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

describe("step state helpers", () => {
  it.each([
    [0, 2, "active", "completed"],
    [2, 2, "active", "active"],
    [2, 2, "failed", "failed"],
    [2, 2, "completed", "completed"],
    [3, 2, "active", "pending"],
  ] as const)("step %i with current %i (%s) is %s", (idx, current, status, expected) => {
    expect(getProgressStepState(idx, current, status)).toBe(expected);
  });

  it("names steps with position, title and state", () => {
    expect(getProgressStepName("Sign", 1, 4, "active")).toBe(
      "Step 2 of 4: Sign, in progress",
    );
    expect(getProgressStepName("Confirm", 3, 4, "pending")).toBe(
      "Step 4 of 4: Confirm, not started",
    );
  });

  it("announces the current step, completion and failure", () => {
    const steps = DEFAULT_TRANSACTION_STEPS;
    expect(getProgressAnnouncement(steps, 1, "active")).toBe("Step 2 of 4: Sign, in progress.");
    expect(getProgressAnnouncement(steps, 2, "failed")).toBe("Step 3 of 4: Submit, failed.");
    expect(getProgressAnnouncement(steps, 3, "completed")).toBe(
      "Transaction complete. Step 4 of 4: Confirm, completed.",
    );
    expect(getProgressAnnouncement(steps, 9, "active")).toBeNull();
  });
});

describe("ARIA structure", () => {
  it("renders an ordered list labelled as transaction progress", () => {
    render(<TransactionProgressBar currentStepIndex={1} />);
    const list = screen.getByRole("list", { name: "Transaction progress steps" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("marks exactly one step as current", () => {
    render(<TransactionProgressBar currentStepIndex={2} />);
    const current = document.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(screen.getByTestId("progress-step-2"));
  });

  it.each(["completed", "failed"] as const)(
    "keeps the current step marked when its status is %s",
    (status) => {
      render(<TransactionProgressBar currentStepIndex={3} status={status} />);
      expect(screen.getByTestId("progress-step-3")).toHaveAttribute("aria-current", "step");
    },
  );

  it("exposes each static step's position and state to screen readers", () => {
    render(<TransactionProgressBar currentStepIndex={1} />);
    expect(screen.getByTestId("progress-step-0")).toHaveTextContent(
      "Step 1 of 4: Prepare, completed",
    );
    expect(screen.getByTestId("progress-step-1")).toHaveTextContent(
      "Step 2 of 4: Sign, in progress",
    );
    expect(screen.getByTestId("progress-step-3")).toHaveTextContent(
      "Step 4 of 4: Confirm, not started",
    );
  });

  it("hides decorative step nodes when they are not controls", () => {
    render(<TransactionProgressBar currentStepIndex={1} />);
    const node = screen.getByTestId("step-node-1");
    expect(node.tagName).toBe("SPAN");
    expect(node).toHaveAttribute("aria-hidden", "true");
  });

  it("names interactive step buttons with their state and description", () => {
    render(<TransactionProgressBar currentStepIndex={1} onStepClick={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Step 2 of 4: Sign, in progress" });
    expect(button).toHaveAttribute("aria-current", "step");
    expect(button).toHaveAccessibleDescription("Approve transaction via connected wallet");
  });

  it("does not double-read titles for interactive steps", () => {
    render(<TransactionProgressBar currentStepIndex={1} onStepClick={vi.fn()} />);
    expect(screen.getByText("Sign").closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByTestId("progress-step-1")).not.toHaveAttribute("aria-current");
  });

  it("hides every icon from assistive tech", () => {
    render(<TransactionProgressBar currentStepIndex={2} status="failed" errorMessage="Boom" />);
    document.querySelectorAll("svg").forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    });
  });

  it("announces step changes through a polite, atomic live region", () => {
    const { rerender } = render(<TransactionProgressBar currentStepIndex={0} />);
    const region = screen.getByTestId("progress-bar-announcement");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("Step 1 of 4: Prepare, in progress.");

    rerender(<TransactionProgressBar currentStepIndex={2} status="failed" />);
    expect(region).toHaveTextContent("Step 3 of 4: Submit, failed.");
  });

  it("announces errors assertively", () => {
    render(<TransactionProgressBar errorMessage="Ledger timeout." />);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("labels the overlay dialog by its visible heading", () => {
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Transaction Status" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Transaction Status" })).toBeInTheDocument();
  });

  it("hides the close glyph so the button reads only its label", () => {
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close transaction overlay" });
    expect(within(close).getByText("✕")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("keyboard navigation", () => {
  it("has no tab stops when steps are not interactive", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TransactionProgressBar currentStepIndex={2} />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("tabs only through reachable steps, skipping future ones", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TransactionProgressBar currentStepIndex={1} onStepClick={vi.fn()} />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByTestId("step-node-0")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("step-node-1")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it.each(["{Enter}", " "])("activates a step with %s", async (key) => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(<TransactionProgressBar currentStepIndex={2} onStepClick={onStepClick} />);
    await user.tab();
    await user.keyboard(key);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("removes all steps from the tab order when disabled", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TransactionProgressBar currentStepIndex={2} onStepClick={vi.fn()} disabled />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("gives reachable steps a visible keyboard focus ring", () => {
    render(<TransactionProgressBar currentStepIndex={1} onStepClick={vi.fn()} />);
    expect(screen.getByTestId("step-node-0").className).toContain("focus-visible:ring-2");
  });

  it("moves focus to the overlay's close button when it opens", () => {
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close transaction overlay" })).toHaveFocus();
  });

  it("closes the overlay with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys and Escape without a close handler", () => {
    render(<TransactionProgressBar mobileOverlay />);
    const dialog = screen.getByRole("dialog");
    expect(() => fireEvent.keyDown(dialog, { key: "Escape" })).not.toThrow();
  });

  it("gives the close button a focus ring and a 44px target", () => {
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close transaction overlay" });
    expect(close).toHaveClass("min-h-[44px]", "min-w-[44px]", "focus-visible:ring-2");
  });
});

describe("colour contrast (WCAG 2.1 AA)", () => {
  const theme = parseThemeColourTokens(globalsCss);

  it.each(Object.entries(TRANSACTION_PROGRESS_TOKENS))(
    "token %s mirrors globals.css",
    (token, hex) => {
      expect(theme.get(token)).toBe(hex);
    },
  );

  it.each(PROGRESS_BAR_CONTRAST_PAIRS.map((p) => [p.usage, p] as const))(
    "%s meets its minimum",
    (_usage, pair) => {
      const ratio = contrastRatio(
        resolveProgressBarColour(pair.foreground),
        resolveProgressBarColour(pair.background),
      );
      expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
    },
  );

  it("keeps the active step number AA-compliant at the dimmest point of its pulse", () => {
    const card = TRANSACTION_PROGRESS_TOKENS["surface-card"];
    const text = blendOver("#ffffff", PROGRESS_BAR_PULSE_MIN_OPACITY, card);
    const bg = blendOver(TRANSACTION_PROGRESS_TOKENS.accent, PROGRESS_BAR_PULSE_MIN_OPACITY, card);
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("would fail with Tailwind's stock 50% pulse (why pulse-soft exists)", () => {
    const card = TRANSACTION_PROGRESS_TOKENS["surface-card"];
    const text = blendOver("#ffffff", 0.5, card);
    const bg = blendOver(TRANSACTION_PROGRESS_TOKENS.accent, 0.5, card);
    expect(contrastRatio(text, bg)).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it("uses the soft pulse keyframe declared in globals.css", () => {
    expect(PROGRESS_BAR_ANIMATION_CLASSES.activePulse).toContain("animate-pulse-soft");
    expect(PROGRESS_BAR_ANIMATION_CLASSES.activePulse).toContain("motion-reduce:animate-none");
    const keyframe = /@keyframes pulse-soft\s*\{([\s\S]*?)\n\}/.exec(globalsCss);
    expect(keyframe).not.toBeNull();
    const opacities = [...keyframe![1].matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...opacities)).toBe(PROGRESS_BAR_PULSE_MIN_OPACITY);
  });

  it("disables the unlayered animation classes under reduced motion", () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(globalsCss);
    expect(block).not.toBeNull();
    ["animate-fade-in", "animate-slide-in", "animate-shake", "animate-pulse-soft"].forEach((cls) =>
      expect(block![1]).toContain(`.${cls}`),
    );
    expect(block![1]).toContain("animation: none");
  });

  it("themes the overlay close button through design variables", () => {
    render(<TransactionProgressBar mobileOverlay onCloseOverlay={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close transaction overlay" });
    expect(close.className).toContain("var(--color-surface-field)");
    expect(close.className).toContain("var(--color-text-muted)");
  });
});
