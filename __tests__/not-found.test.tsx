// @vitest-environment jsdom
/**
 * Tests for app/not-found.tsx
 *
 * Verifies branded content, the LandingNav presence, and the two navigation
 * links ("/dashboard" and "/").
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "@/app/not-found";

// ── mock LandingNav — it imports network config which isn't needed here ───────
vi.mock("@/app/components/LandingNav", () => ({
  default: () => <nav aria-label="Primary" data-testid="landing-nav" />,
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

describe("NotFound", () => {
  it("renders the LandingNav", () => {
    render(<NotFound />);
    expect(screen.getByTestId("landing-nav")).toBeInTheDocument();
  });

  it("renders the branded 404 heading", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });

  it("renders the visible 404 number", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders an explanatory description", () => {
    render(<NotFound />);
    expect(screen.getByText(/doesn't exist or has been moved/i)).toBeInTheDocument();
  });

  it("links to /dashboard", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: "Go to dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("links to /", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: "Go to home" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders a main landmark with an accessible label", () => {
    render(<NotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-labelledby", "not-found-heading");
  });
});
