/**
 * Issue #276 – Design empty list display views for loading_spinner_skeleton
 *
 * Unit coverage for the reusable EmptyState placeholder component.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "@/app/components/EmptyState";

describe("EmptyState", () => {
  it("renders the provided title and description", () => {
    render(<EmptyState title="Nothing here" description="Try again later." />);
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent("Nothing here");
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      "Try again later."
    );
  });

  it("falls back to a default icon when none is supplied", () => {
    render(<EmptyState title="Nothing here" description="Try again later." />);
    expect(screen.getByText("🗂️")).toBeInTheDocument();
  });

  it("renders a custom icon when supplied", () => {
    render(<EmptyState title="Nothing here" description="Try again later." icon="📭" />);
    expect(screen.getByText("📭")).toBeInTheDocument();
  });

  it("hides the decorative icon from assistive tech", () => {
    render(<EmptyState title="Nothing here" description="Try again later." />);
    expect(screen.getByText("🗂️")).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the fade-in micro-animation on mount", () => {
    render(<EmptyState title="Nothing here" description="Try again later." />);
    expect(screen.getByTestId("empty-state")).toHaveClass("animate-fade-in");
  });
});
