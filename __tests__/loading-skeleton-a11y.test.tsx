import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

// ===========================================================================
// LoadingSkeleton — ARIA attribute compliance (issue #273)
// ===========================================================================

describe("LoadingSkeleton — ARIA loading semantics", () => {
  it("advertises the busy/loading state via aria-busy on the status node", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps aria-live='polite' on the default (non-interactive) variant", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("does not apply aria-live to the interactive button variant", () => {
    render(<LoadingSkeleton interactive onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("aria-live");
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("exposes the accessible loading message as sr-only content", () => {
    render(<LoadingSkeleton />);
    const message = screen.getByText("Loading job data…");
    expect(message).toHaveClass("sr-only");
  });

  it("hides the visual skeleton placeholder from assistive technology", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toBeInTheDocument();
  });
});

describe("LoadingSkeleton — reduced motion compliance", () => {
  it("disables the pulse animation under prefers-reduced-motion", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveClass("motion-reduce:animate-none");
  });

  it("disables fade-in transitions under prefers-reduced-motion", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveClass("motion-reduce:transition-none");
  });

  it("still renders the default, accessible pulse animation class", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveClass("animate-pulse");
  });
});

describe("LoadingSkeleton — keyboard navigability", () => {
  it("is focusable when interactive", () => {
    render(<LoadingSkeleton interactive onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("tabindex", "0");
  });

  it("is removed from the tab order when disabled", () => {
    render(<LoadingSkeleton interactive disabled onClick={vi.fn()} />);
    const button = screen.getByRole("button", { hidden: true });
    expect(button).toHaveAttribute("tabindex", "-1");
  });

  it("responds to Enter and Space keys when interactive", () => {
    const handleClick = vi.fn();
    render(<LoadingSkeleton interactive onClick={handleClick} />);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(button, { key: " ", code: "Space" });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it("exposes a visible focus ring for the interactive variant", () => {
    render(<LoadingSkeleton interactive onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("focus-visible:ring-2");
    expect(button).toHaveClass("focus-visible:ring-blue-500");
  });
});

describe("LoadingSkeleton — interactive accessible name", () => {
  it("accepts a custom aria-label for the interactive variant", () => {
    render(
      <LoadingSkeleton interactive onClick={vi.fn()} aria-label="Retry loading" />
    );
    const button = screen.getByRole("button", { name: "Retry loading" });
    expect(button).toBeInTheDocument();
  });

  it("falls back to the sr-only text as the accessible name when no label is set", () => {
    render(<LoadingSkeleton interactive onClick={vi.fn()} />);
    // Accessible name is computed from the sr-only text content.
    expect(
      screen.getByRole("button", { name: "Loading job data…" })
    ).toBeInTheDocument();
  });
});

describe("LoadingSkeleton — color contrast tokens", () => {
  it("uses the dark surface background token for contrast", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("bg-surface-card");
  });
});
