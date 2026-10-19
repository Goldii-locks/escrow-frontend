import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountdownTimer, {
  formatAbsoluteDeadline,
} from "@/app/components/CountdownTimer";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatAbsoluteDeadline", () => {
  it("produces a locale-formatted string starting with 'Releases'", () => {
    // 2024-01-01T14:00:00Z  →  epoch 1704117600000
    const ms = 1704117600000;
    const text = formatAbsoluteDeadline(ms);
    expect(text).toMatch(/^Releases /);
    // Should contain a short weekday, day, short month, and a time
    expect(text.length).toBeGreaterThan("Releases ".length);
  });
});

describe("CountdownTimer — absolute date (issue #683)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a <time> element with ISO dateTime for a future deadline", () => {
    // Deadline 2 days + 4 hours from epoch 0
    const deadline = 2 * DAY + 4 * HOUR;
    render(<CountdownTimer deadline={deadline} />);

    const timeEl = screen.getByTestId("countdown-absolute");
    expect(timeEl.tagName).toBe("TIME");
    expect(timeEl).toHaveAttribute("dateTime");
    // dateTime should be a valid ISO 8601 string
    const iso = timeEl.getAttribute("dateTime");
    expect(iso).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  it("renders formatted absolute date text starting with 'Releases'", () => {
    const deadline = 2 * DAY + 4 * HOUR;
    render(<CountdownTimer deadline={deadline} />);

    const timeEl = screen.getByTestId("countdown-absolute");
    expect(timeEl.textContent).toMatch(/^Releases /);
  });

  it("keeps the countdown as the primary display", () => {
    const deadline = 2 * HOUR + 15 * MINUTE;
    render(<CountdownTimer deadline={deadline} />);

    const countdown = screen.getByTestId("countdown-remaining");
    expect(countdown).toHaveTextContent("2 hours, 15 minutes remaining");
  });

  it("does not render the absolute date when the deadline has elapsed", () => {
    vi.setSystemTime(10 * SECOND);
    render(<CountdownTimer deadline={5 * SECOND} />);

    expect(screen.queryByTestId("countdown-absolute")).not.toBeInTheDocument();
    expect(screen.getByTestId("countdown-eligible")).toBeInTheDocument();
  });

  it("uses a consistent ISO string for the deadline", () => {
    // Fixed deadline: 2024-10-21T14:00:00Z → epoch 1729519200000
    const deadline = 1729519200000;
    render(<CountdownTimer deadline={deadline} />);

    const timeEl = screen.getByTestId("countdown-absolute");
    expect(timeEl).toHaveAttribute(
      "dateTime",
      new Date(deadline).toISOString()
    );
  });
});
