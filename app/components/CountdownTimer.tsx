"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Absolute auto-release deadline, in epoch milliseconds. */
  deadline: number;
  /** Label shown once the deadline has passed. */
  eligibleLabel?: string;
  /** Called once, when the countdown crosses the deadline. */
  onElapsed?: () => void;
  /** How often to re-render the remaining time. Default 1000ms. */
  intervalMs?: number;
  className?: string;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

/**
 * Format a positive millisecond duration as its two most-significant non-zero
 * units, e.g. 2d 4h 30m -> "2 days, 4 hours", 4h 0m 45s -> "4 hours, 45 seconds".
 * Returns an empty string for durations of zero or less.
 */
export function formatRemaining(msRemaining: number): string {
  if (msRemaining <= 0) {
    return "";
  }

  const days = Math.floor(msRemaining / DAY);
  const hours = Math.floor((msRemaining % DAY) / HOUR);
  const minutes = Math.floor((msRemaining % HOUR) / MINUTE);
  const seconds = Math.floor((msRemaining % MINUTE) / SECOND);

  const parts: string[] = [];
  if (days > 0) parts.push(pluralize(days, "day"));
  if (hours > 0) parts.push(pluralize(hours, "hour"));
  if (minutes > 0) parts.push(pluralize(minutes, "minute"));
  if (seconds > 0) parts.push(pluralize(seconds, "second"));

  return parts.slice(0, 2).join(", ");
}

export default function CountdownTimer({
  deadline,
  eligibleLabel = "Eligible for auto-release",
  onElapsed,
  intervalMs = SECOND,
  className = "",
}: Props) {
  const [now, setNow] = useState<number>(() => Date.now());
  const elapsedFired = useRef(false);

  const remaining = deadline - now;
  const isElapsed = remaining <= 0;

  useEffect(() => {
    if (isElapsed) {
      return;
    }

    // The interval callback runs after mount, so this is not a synchronous
    // setState within the effect. A deadline prop change re-renders and
    // recomputes `remaining` without needing an immediate setState here.
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
    // Re-arm whenever the deadline changes; isElapsed is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, intervalMs]);

  useEffect(() => {
    if (isElapsed && !elapsedFired.current) {
      elapsedFired.current = true;
      onElapsed?.();
    }
    if (!isElapsed) {
      elapsedFired.current = false;
    }
  }, [isElapsed, onElapsed]);

  if (isElapsed) {
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid="countdown-eligible"
        className={`text-xs font-medium text-success-soft ${className}`}
      >
        {eligibleLabel}
      </span>
    );
  }

  return (
    <span
      role="timer"
      aria-live="off"
      data-testid="countdown-remaining"
      className={`text-xs text-text-muted tabular-nums ${className}`}
    >
      {formatRemaining(remaining)} remaining
    </span>
  );
}
