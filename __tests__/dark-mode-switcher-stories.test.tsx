import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DarkModeSwitcher, { DarkModeSwitcherEmptyState } from "@/app/components/DarkModeSwitcher";

describe("DarkModeSwitcher Storybook stories - rendering validation", () => {
  it("renders Light state correctly", () => {
    render(<DarkModeSwitcher isDarkMode={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("renders Dark state correctly", () => {
    render(<DarkModeSwitcher isDarkMode={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders Disabled state correctly", () => {
    render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders Loading state correctly", () => {
    render(<DarkModeSwitcher isDarkMode={false} loading onToggle={() => {}} />);
    expect(screen.getByText("Loading theme...")).toBeInTheDocument();
  });

  it("renders Empty state correctly", () => {
    render(<DarkModeSwitcher isDarkMode={null} onToggle={() => {}} />);
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
  });

  it("renders EmptyStateStandalone correctly", () => {
    render(<DarkModeSwitcherEmptyState />);
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No theme preferences available")).toBeInTheDocument();
  });
});