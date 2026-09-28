/**
 * Empty data states for TransactionProgressBar: a descriptive placeholder
 * replaces the step track when there are no steps to show, instead of an
 * empty list and a configuration error.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionProgressBar, {
  DEFAULT_TRANSACTION_STEPS,
} from "@/app/components/TransactionProgressBar";
import {
  PROGRESS_BAR_EMPTY_COPY,
  isProgressBarEmpty,
  validateProgressBarConfig,
  type StepItem,
} from "@/app/lib/transaction_progress_bar";

describe("isProgressBarEmpty", () => {
  it.each([
    ["an empty list", []],
    ["null", null],
    ["undefined", undefined],
    ["a non-array", { length: 2 }],
    ["only null entries", [null, null]],
    ["only untitled steps", [{ id: "a", title: "" }, { id: "b", title: "   " }]],
    ["steps with non-string titles", [{ id: "a", title: 42 }]],
  ])("treats %s as empty", (_label, steps) => {
    expect(isProgressBarEmpty(steps)).toBe(true);
  });

  it.each([
    ["the default flow", DEFAULT_TRANSACTION_STEPS],
    ["a single titled step", [{ id: "one", title: "Sign" }]],
    ["a mix with at least one titled step", [null, { id: "b", title: "Submit" }]],
  ])("treats %s as non-empty", (_label, steps) => {
    expect(isProgressBarEmpty(steps)).toBe(false);
  });
});

describe("placeholder rendering", () => {
  it.each([
    ["an empty list", [] as StepItem[]],
    ["null", null],
    ["untitled steps", [{ id: "x", title: "" }]],
  ])("renders the placeholder for %s", (_label, steps) => {
    render(<TransactionProgressBar steps={steps} />);
    expect(screen.getByTestId("progress-bar-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("progress-bar-placeholder-title")).toHaveTextContent(
      PROGRESS_BAR_EMPTY_COPY.title,
    );
    expect(
      screen.getByTestId("progress-bar-placeholder-description"),
    ).toHaveTextContent(PROGRESS_BAR_EMPTY_COPY.description);
  });

  it("does not render the step list or any step nodes", () => {
    render(<TransactionProgressBar steps={[]} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("step-node-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-bar-announcement")).not.toBeInTheDocument();
  });

  it("does not treat an empty list as a validation error", () => {
    render(<TransactionProgressBar steps={[]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The pure validator still reports it, for callers that need that.
    expect(validateProgressBarConfig([], 0).isValid).toBe(false);
  });

  it("still shows an explicit error message above the placeholder", () => {
    render(<TransactionProgressBar steps={[]} errorMessage="Wallet disconnected." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Wallet disconnected.");
    expect(screen.getByTestId("progress-bar-placeholder")).toBeInTheDocument();
  });

  it("does not crash when steps is null (previously threw on .map)", () => {
    expect(() => render(<TransactionProgressBar steps={null} />)).not.toThrow();
  });

  it("keeps the default flow when steps is omitted", () => {
    render(<TransactionProgressBar />);
    expect(screen.queryByTestId("progress-bar-placeholder")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(DEFAULT_TRANSACTION_STEPS.length);
  });

  it("marks the container as empty", () => {
    const { rerender } = render(<TransactionProgressBar steps={[]} />);
    expect(screen.getByTestId("transaction-progress-bar-container")).toHaveAttribute(
      "data-empty",
      "true",
    );
    rerender(<TransactionProgressBar />);
    expect(screen.getByTestId("transaction-progress-bar-container")).toHaveAttribute(
      "data-empty",
      "false",
    );
  });

  it("swaps between placeholder and steps as data arrives and clears", () => {
    const { rerender } = render(<TransactionProgressBar steps={[]} />);
    expect(screen.getByTestId("progress-bar-placeholder")).toBeInTheDocument();

    rerender(<TransactionProgressBar steps={DEFAULT_TRANSACTION_STEPS} currentStepIndex={1} />);
    expect(screen.queryByTestId("progress-bar-placeholder")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-node-1")).toBeInTheDocument();

    rerender(<TransactionProgressBar steps={[]} />);
    expect(screen.getByTestId("progress-bar-placeholder")).toBeInTheDocument();
  });

  it("renders the placeholder inside the mobile overlay too", () => {
    render(<TransactionProgressBar steps={[]} mobileOverlay onCloseOverlay={vi.fn()} />);
    const overlay = screen.getByTestId("mobile-overlay-wrapper");
    expect(overlay).toContainElement(screen.getByTestId("progress-bar-placeholder"));
    expect(screen.getByRole("button", { name: /Close transaction overlay/ })).toBeEnabled();
  });
});

describe("placeholder presentation", () => {
  it("is a polite status named by its title", () => {
    render(<TransactionProgressBar steps={[]} />);
    const status = screen.getByRole("status", { name: PROGRESS_BAR_EMPTY_COPY.title });
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("draws a decorative ghost track hidden from assistive tech", () => {
    render(<TransactionProgressBar steps={[]} />);
    const track = screen.getByTestId("progress-bar-placeholder-track");
    expect(track).toHaveAttribute("aria-hidden", "true");
    expect(track.querySelectorAll('[class~="h-2.5"]')).toHaveLength(4);
  });

  it("uses a dashed card themed through design variables", () => {
    render(<TransactionProgressBar steps={[]} />);
    const placeholder = screen.getByTestId("progress-bar-placeholder");
    expect(placeholder).toHaveClass("border-dashed", "text-center");
    expect(placeholder.className).toContain("var(--color-surface-card)");
    expect(placeholder.className).toContain("var(--color-border-subtle)");
  });

  it("fades in, except under reduced motion", () => {
    render(<TransactionProgressBar steps={[]} />);
    expect(screen.getByTestId("progress-bar-placeholder")).toHaveClass(
      "animate-fade-in",
      "motion-reduce:animate-none",
    );
  });

  it("uses descriptive copy, not a bare line of text", () => {
    expect(PROGRESS_BAR_EMPTY_COPY.title.length).toBeGreaterThan(5);
    expect(PROGRESS_BAR_EMPTY_COPY.description.length).toBeGreaterThan(40);
    expect(PROGRESS_BAR_EMPTY_COPY.description.trim()).toMatch(/\.$/);
  });
});
