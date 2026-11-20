// @vitest-environment jsdom
/**
 * Tests for the shared ErrorBoundaryUI component and both route-group error
 * boundaries (app/(app)/error.tsx and app/(marketing)/error.tsx).
 *
 * Each error.tsx delegates rendering to ErrorBoundaryUI, so we test:
 *   1. ErrorBoundaryUI in isolation (branded output, links, reset callback).
 *   2. AppError — that it passes props through and calls reportClientError.
 *   3. MarketingError — same contract as AppError.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundaryUI from "@/app/components/ErrorBoundaryUI";
import AppError from "@/app/(app)/error";
import MarketingError from "@/app/(marketing)/error";

// ── mock reportClientError ────────────────────────────────────────────────────
const mockReportClientError = vi.fn();
vi.mock("@/app/lib/errorReporter", () => ({
  reportClientError: (...args: unknown[]) => mockReportClientError(...args),
}));

// next/link renders a plain <a> in test environments
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────

const sampleError = Object.assign(new Error("Render exploded"), { digest: "deadbeef" });

// ── ErrorBoundaryUI ───────────────────────────────────────────────────────────
describe("ErrorBoundaryUI", () => {
  const reset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the branded heading", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
  });

  it("renders an accessible description", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
  });

  it("surfaces the error digest when present", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    expect(screen.getByText(/Reference: deadbeef/)).toBeInTheDocument();
  });

  it("omits the digest paragraph when digest is absent", () => {
    render(<ErrorBoundaryUI error={new Error("no digest")} reset={reset} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not call reset before the button is clicked", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    expect(reset).not.toHaveBeenCalled();
  });

  it("renders a Go to dashboard link pointing at /dashboard", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    const link = screen.getByRole("link", { name: "Go to dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("wraps content in an element with role=alert", () => {
    render(<ErrorBoundaryUI error={sampleError} reset={reset} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ── AppError (app/(app)/error.tsx) ────────────────────────────────────────────
describe("AppError", () => {
  const reset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the branded heading", () => {
    render(<AppError error={sampleError} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
  });

  it("calls reset when Try again is clicked", () => {
    render(<AppError error={sampleError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders Go to dashboard link pointing at /dashboard", () => {
    render(<AppError error={sampleError} reset={reset} />);
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });

  it("calls reportClientError with source 'render' and the error message", () => {
    render(<AppError error={sampleError} reset={reset} />);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "render",
        message: "Render exploded",
      })
    );
  });

  it("falls back to error.name when message is empty", () => {
    const e = Object.assign(new Error(""), { name: "ChunkLoadError" });
    e.message = "";
    render(<AppError error={e} reset={reset} />);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ source: "render", message: "ChunkLoadError" })
    );
  });
});

// ── MarketingError (app/(marketing)/error.tsx) ───────────────────────────────
describe("MarketingError", () => {
  const reset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the branded heading", () => {
    render(<MarketingError error={sampleError} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
  });

  it("calls reset when Try again is clicked", () => {
    render(<MarketingError error={sampleError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders Go to dashboard link pointing at /dashboard", () => {
    render(<MarketingError error={sampleError} reset={reset} />);
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });

  it("calls reportClientError with source 'render' and the error message", () => {
    render(<MarketingError error={sampleError} reset={reset} />);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "render",
        message: "Render exploded",
      })
    );
  });
});
