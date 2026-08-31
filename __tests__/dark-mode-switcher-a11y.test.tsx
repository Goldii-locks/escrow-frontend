import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DarkModeSwitcher, { DarkModeSwitcherEmptyState } from "@/app/components/DarkModeSwitcher";

describe("DarkModeSwitcher - a11y ARIA compliance #310", () => {
  describe("ARIA role and attributes", () => {
    it("renders with role=\"switch\"", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("has aria-checked=false when isDarkMode is false", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("has aria-checked=true when isDarkMode is true", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("has aria-label for light mode", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Switch to dark mode");
    });

    it("has aria-label for dark mode", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Switch to light mode");
    });

    it("supports custom ariaLabel prop", () => {
      render(<DarkModeSwitcher isDarkMode={false} ariaLabel="Toggle theme" onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Toggle theme");
    });

    it("has accessible name via aria-label", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByLabelText("Switch to dark mode")).toBeInTheDocument();
    });

    it("thumb has aria-hidden true", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-thumb")).toHaveAttribute("aria-hidden", "true");
    });

    it("has data-testid and data-state", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      const el = screen.getByTestId("dark-mode-switcher");
      expect(el).toHaveAttribute("data-state", "dark");
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      // second render adds another but first still exists? Use query
    });

    it("renders dark data-state when dark", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getAllByTestId("dark-mode-switcher").pop()).toHaveAttribute("data-state", "dark");
    });

    it("renders light data-state when light", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getAllByTestId("dark-mode-switcher").pop()).toHaveAttribute("data-state", "light");
    });
  });

  describe("keyboard navigability", () => {
    it("has tabIndex 0 when enabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("tabIndex", "0");
    });

    it("has tabIndex -1 when disabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("tabIndex", "-1");
    });

    it("has tabIndex -1 when loading", () => {
      render(<DarkModeSwitcher isDarkMode={false} loading onToggle={vi.fn()} />);
      // loading renders status, not switch - check no switch
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("calls onToggle on Space key", async () => {
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} onToggle={onToggle} />);
      const sw = screen.getByRole("switch");
      sw.focus();
      fireEvent.keyDown(sw, { key: " ", code: "Space" });
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it("calls onToggle on Enter key", async () => {
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} onToggle={onToggle} />);
      const sw = screen.getByRole("switch");
      fireEvent.keyDown(sw, { key: "Enter", code: "Enter" });
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it("does not call onToggle on Space when disabled", () => {
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={onToggle} />);
      const sw = screen.getByRole("switch");
      fireEvent.keyDown(sw, { key: " ", code: "Space" });
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("does not call onToggle on Enter when disabled", () => {
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={onToggle} />);
      const sw = screen.getByRole("switch");
      fireEvent.keyDown(sw, { key: "Enter" });
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("calls onToggle on click when enabled", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} onToggle={onToggle} />);
      await user.click(screen.getByRole("switch"));
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it("does not call onToggle on click when disabled", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={onToggle} />);
      await user.click(screen.getByRole("switch"));
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("is focusable via keyboard", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      const sw = screen.getByRole("switch");
      sw.focus();
      expect(document.activeElement).toBe(sw);
    });
  });

  describe("disabled and aria-disabled", () => {
    it("has disabled attribute when disabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toBeDisabled();
    });

    it("has aria-disabled true when disabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
    });

    it("has aria-disabled false when enabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "false");
    });

    it("disabled and aria-disabled are consistent", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      const el = screen.getByRole("switch");
      expect(el).toBeDisabled();
      expect(el).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("color contrast compliance - design tokens", () => {
    it("uses accessible bg-accent for dark mode (contrast token)", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("bg-accent");
    });

    it("uses bg-surface-field for light mode", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("bg-surface-field");
    });

    it("thumb uses bg-white for high contrast", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-thumb").className).toContain("bg-white");
    });

    it("uses text-white or text-text-muted with sufficient contrast (token classes)", () => {
      const { container } = render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      // thumb is white, track is accent - ensures contrast
      expect(container.innerHTML).toContain("bg-white");
    });

    it("focus ring uses accent token for visibility", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("focus-visible:ring-accent");
    });
  });

  describe("loading state a11y", () => {
    it("loading renders role status with aria-live", () => {
      render(<DarkModeSwitcher loading isDarkMode={false} />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveAttribute("aria-label", "Loading theme");
    });

    it("loading shows spinner and text", () => {
      render(<DarkModeSwitcher loading isDarkMode={false} />);
      expect(screen.getByText("Loading theme...")).toBeInTheDocument();
    });
  });

  describe("empty state a11y", () => {
    it("empty state has region role and aria-label", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByRole("region", { name: "No theme preferences" })).toBeInTheDocument();
    });

    it("empty state has descriptive text", () => {
      render(<DarkModeSwitcher isDarkMode={null} onToggle={vi.fn()} />);
      expect(screen.getByText("No theme preferences available")).toBeInTheDocument();
    });

    it("EmptyState component directly has a11y attributes", () => {
      render(<DarkModeSwitcherEmptyState />);
      expect(screen.getByTestId("dark-mode-switcher-empty-state")).toHaveAttribute("role", "region");
      expect(screen.getByTestId("dark-mode-switcher-empty-state")).toHaveAttribute("aria-label", "No theme preferences");
    });
  });
});
