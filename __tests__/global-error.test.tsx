// @vitest-environment jsdom
/**
 * Tests for app/global-error.tsx
 *
 * global-error replaces the entire root layout, so it owns its own <html> and
 * <body> and cannot rely on any provider. We render it in jsdom and verify the
 * branded content, the "Try again" callback, the dashboard link, and the
 * reportClientError call.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

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

const sampleError = Object.assign(new Error("Boom"), { digest: "abc123" });

describe("GlobalError", () => {
  const reset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the branded heading", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something went wrong");
  });

  it("renders a descriptive message", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    expect(screen.getByText(/critical error occurred/i)).toBeInTheDocument();
  });

  it("surfaces the error digest when present", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    expect(screen.getByText(/Reference: abc123/)).toBeInTheDocument();
  });

  it("omits the digest paragraph when digest is absent", () => {
    render(<GlobalError error={new Error("no digest")} reset={reset} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders a Go to dashboard link pointing at /dashboard", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    const link = screen.getByRole("link", { name: "Go to dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("calls reportClientError with source 'render' and the error message", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "render",
        message: "Boom",
      })
    );
  });

  it("reports with the error name when message is empty", () => {
    const namelessError = Object.assign(new Error(""), { name: "ChunkLoadError" });
    namelessError.message = "";
    render(<GlobalError error={namelessError} reset={reset} />);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ source: "render", message: "ChunkLoadError" })
    );
  });

  it("wraps content in an element with role=alert", () => {
    render(<GlobalError error={sampleError} reset={reset} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
