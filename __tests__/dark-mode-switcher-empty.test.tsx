import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DarkModeSwitcher, { DarkModeSwitcherEmptyState } from "@/app/components/DarkModeSwitcher";

describe("DarkModeSwitcher - empty list display views #313", () => {
  describe("empty state when isDarkMode is null/undefined", () => {
    it("renders empty placeholder when isDarkMode is null", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
    });

    it("renders empty placeholder when isDarkMode is undefined", () => {
      render(<DarkModeSwitcher isDarkMode={undefined} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
    });

    it("does NOT render switch when empty", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("does not render empty state when isDarkMode is false (valid light mode)", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.queryByTestId("dark-mode-switcher-empty-state")).not.toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("does not render empty state when isDarkMode is true", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.queryByTestId("dark-mode-switcher-empty-state")).not.toBeInTheDocument();
    });

    it("does not render empty when loading (loading takes precedence)", () => {
      render(<DarkModeSwitcher isDarkMode={null} loading onToggle={vi.fn()} />);
      expect(screen.queryByTestId("dark-mode-switcher-empty-state")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("empty state UI elements - descriptive placeholder", () => {
    it("has region role with aria-label No theme preferences", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByRole("region", { name: "No theme preferences" })).toBeInTheDocument();
    });

    it("shows title No theme preferences available", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText("No theme preferences available")).toBeInTheDocument();
    });

    it("shows descriptive copy about theme data is empty", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText(/Theme data is empty/)).toBeInTheDocument();
    });

    it("shows illustrative copy about default light theme", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText(/default light theme/)).toBeInTheDocument();
    });

    it("shows Waiting for theme data badge", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText("Waiting for theme data")).toBeInTheDocument();
    });

    it("has decorative icon hidden from AT (aria-hidden)", () => {
      const { container } = render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      const hidden = container.querySelector("[aria-hidden=\"true\"]");
      expect(hidden).toBeInTheDocument();
    });

    it("uses design tokens: border-border-strong bg-surface-card rounded-xl", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      const el = screen.getByTestId("dark-mode-switcher-empty-state");
      expect(el.className).toContain("border-border-strong");
      expect(el.className).toContain("bg-surface-card");
      expect(el.className).toContain("rounded-xl");
    });

    it("uses text-text-primary and text-text-muted for contrast", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText("No theme preferences available").className).toContain("text-text-primary");
      expect(screen.getByText(/Theme data is empty/).className).toContain("text-text-muted");
    });

    it("has centered layout (items-center justify-center text-center)", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      const el = screen.getByTestId("dark-mode-switcher-empty-state");
      expect(el.className).toContain("items-center");
      expect(el.className).toContain("justify-center");
      expect(el.className).toContain("text-center");
    });
  });

  describe("DarkModeSwitcherEmptyState component directly", () => {
    it("renders standalone empty state", () => {
      render(<DarkModeSwitcherEmptyState />);
      expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
    });

    it("accepts custom className", () => {
      render(<DarkModeSwitcherEmptyState className="mt-4" />);
      expect(screen.getByTestId("dark-mode-switcher-empty-state").className).toContain("mt-4");
    });

    it("has correct test id and roles", () => {
      render(<DarkModeSwitcherEmptyState />);
      const el = screen.getByTestId("dark-mode-switcher-empty-state");
      expect(el).toHaveAttribute("role", "region");
      expect(el).toHaveAttribute("aria-label", "No theme preferences");
    });
  });

  describe("not empty - normal rendering", () => {
    it("renders switch for light mode with correct aria", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("renders switch for dark mode with correct aria", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });
  });
});
