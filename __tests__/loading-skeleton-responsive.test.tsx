/**
 * Issue #275 – Implement responsive sizing layouts on loading_spinner_skeleton
 *
 * Verifies that the LoadingSkeleton component resizes and stacks
 * responsively across mobile, tablet, and desktop viewports.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

describe("LoadingSkeleton – responsive sizing layout (issue #275)", () => {
  it("root wrapper spans the full available width", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("loading-skeleton")).toHaveClass("w-full");
  });

  it("card wrapper uses responsive padding (p-4 on mobile, sm:p-6 on larger screens)", () => {
    render(<LoadingSkeleton />);
    const card = screen.getByTestId("skeleton-container");
    expect(card).toHaveClass("p-4");
    expect(card).toHaveClass("sm:p-6");
  });

  it("card wrapper uses responsive vertical spacing (space-y-4 / sm:space-y-6)", () => {
    render(<LoadingSkeleton />);
    const card = screen.getByTestId("skeleton-container");
    expect(card).toHaveClass("space-y-4");
    expect(card).toHaveClass("sm:space-y-6");
  });

  it("stats grid stacks to a single column on mobile", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("skeleton-stats-grid")).toHaveClass("grid-cols-1");
  });

  it("stats grid expands to two columns on tablet (sm:grid-cols-2)", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("skeleton-stats-grid")).toHaveClass("sm:grid-cols-2");
  });

  it("stats grid expands to three columns on desktop (md:grid-cols-3)", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("skeleton-stats-grid")).toHaveClass("md:grid-cols-3");
  });

  it("header stacks vertically on mobile and switches to a row on sm+ (flex-col / sm:flex-row)", () => {
    render(<LoadingSkeleton />);
    const card = screen.getByTestId("skeleton-container");
    const header = card.firstElementChild as HTMLElement;
    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("sm:flex-row");
  });

  it("milestone rows use responsive padding (p-3 on mobile, sm:p-4 on larger screens)", () => {
    render(<LoadingSkeleton />);
    const rows = screen.getByTestId("skeleton-milestones");
    const firstRow = rows.firstElementChild as HTMLElement;
    expect(firstRow).toHaveClass("p-3");
    expect(firstRow).toHaveClass("sm:p-4");
  });

  it("still renders the accessible loading status region", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading job data…")).toBeInTheDocument();
  });
});
