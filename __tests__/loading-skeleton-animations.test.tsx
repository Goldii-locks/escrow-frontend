/**
 * Issue #278 – Incorporate CSS micro-animations on loading_spinner_skeleton elements
 *
 * Verifies that LoadingSkeleton fades in smoothly on mount (state change)
 * and that its internal bars pulse with a staggered delay rather than all
 * animating in perfect unison.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

describe("LoadingSkeleton – micro-animations (issue #278)", () => {
  it("fades in on mount via animate-fade-in", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("loading-skeleton")).toHaveClass("animate-fade-in");
  });

  it("stat placeholders pulse", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("skeleton-stat-card-0")).toHaveClass("animate-pulse");
    expect(screen.getByTestId("skeleton-stat-card-1")).toHaveClass("animate-pulse");
    expect(screen.getByTestId("skeleton-stat-card-2")).toHaveClass("animate-pulse");
  });

  it("stat placeholders pulse with staggered, distinct animation delays", () => {
    render(<LoadingSkeleton />);
    const delays = [
      screen.getByTestId("skeleton-stat-card-0"),
      screen.getByTestId("skeleton-stat-card-1"),
      screen.getByTestId("skeleton-stat-card-2"),
    ].map((el) => el.className.match(/\[animation-delay:(\d+)ms\]/)?.[1]);

    expect(delays).toEqual(["100", "175", "250"]);
    expect(new Set(delays).size).toBe(3);
  });

  it("row placeholders pulse with staggered, distinct animation delays", () => {
    render(<LoadingSkeleton />);
    const row0 = screen.getByTestId("skeleton-milestone-card-0");
    const row1 = screen.getByTestId("skeleton-milestone-card-1");
    expect(row0).toHaveClass("animate-pulse");
    expect(row1).toHaveClass("animate-pulse");
    expect(row0).toHaveClass("[animation-delay:325ms]");
    expect(row1).toHaveClass("[animation-delay:400ms]");
  });

  it("keeps the accessible loading announcement intact", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading job data…")).toBeInTheDocument();
  });

  it("decorative skeleton markup stays hidden from assistive tech", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("skeleton-container")).toHaveAttribute("aria-hidden", "true");
  });
});
