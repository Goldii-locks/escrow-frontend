import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountdownTimer, { formatRemaining } from "@/app/components/CountdownTimer";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRemaining", () => {
  it("shows the two most-significant non-zero units", () => {
    expect(formatRemaining(2 * DAY + 4 * HOUR + 30 * MINUTE)).toBe("2 days, 4 hours");
    expect(formatRemaining(4 * HOUR + 45 * SECOND)).toBe("4 hours, 45 seconds");
    expect(formatRemaining(30 * MINUTE + 10 * SECOND)).toBe("30 minutes, 10 seconds");
  });

  it("pluralizes correctly and handles single units", () => {
    expect(formatRemaining(1 * DAY + 1 * HOUR)).toBe("1 day, 1 hour");
    expect(formatRemaining(45 * SECOND)).toBe("45 seconds");
  });

  it("returns empty string for zero or negative durations", () => {
    expect(formatRemaining(0)).toBe("");
    expect(formatRemaining(-5000)).toBe("");
  });
});

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the remaining time for a future deadline", () => {
    render(<CountdownTimer deadline={2 * HOUR + 15 * MINUTE} />);
    expect(screen.getByTestId("countdown-remaining")).toHaveTextContent(
      "2 hours, 15 minutes remaining"
    );
  });

  it("counts down as time advances", () => {
    render(<CountdownTimer deadline={3 * SECOND} />);
    expect(screen.getByTestId("countdown-remaining")).toHaveTextContent("3 seconds remaining");

    // advanceTimersByTime also advances the mocked Date, so the clock is now 1s.
    act(() => {
      vi.advanceTimersByTime(1 * SECOND);
    });
    expect(screen.getByTestId("countdown-remaining")).toHaveTextContent("2 seconds remaining");
  });

  it("switches to the eligible state when the deadline passes", () => {
    const onElapsed = vi.fn();
    render(<CountdownTimer deadline={2 * SECOND} onElapsed={onElapsed} />);
    expect(screen.getByTestId("countdown-remaining")).toBeInTheDocument();

    // Advance past the 2s deadline; the clock moves to 3s.
    act(() => {
      vi.advanceTimersByTime(3 * SECOND);
    });

    expect(screen.queryByTestId("countdown-remaining")).not.toBeInTheDocument();
    expect(screen.getByTestId("countdown-eligible")).toHaveTextContent(
      "Eligible for auto-release"
    );
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it("renders the eligible state immediately for an already-passed deadline", () => {
    vi.setSystemTime(10 * SECOND);
    render(<CountdownTimer deadline={5 * SECOND} />);
    expect(screen.getByTestId("countdown-eligible")).toBeInTheDocument();
  });

  it("supports a custom eligible label (reusable across contexts)", () => {
    vi.setSystemTime(10 * SECOND);
    render(<CountdownTimer deadline={1 * SECOND} eligibleLabel="Ready to claim" />);
    expect(screen.getByTestId("countdown-eligible")).toHaveTextContent("Ready to claim");
  });
});
