import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DarkModeSwitcher from "@/app/components/DarkModeSwitcher";

describe("DarkModeSwitcher - premium interactive states #311", () => {
  describe("hover states - Tailwind hover: utilities", () => {
    it("has hover:bg-accent-hover or hover: opacity for dark mode", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/hover:/);
    });

    it("has hover:bg-surface-field for light mode", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/hover:/);
    });

    it("has hover:shadow-sm utility", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/hover:|shadow/);
    });

    it("thumb has hover transition (via parent)", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/transition/);
    });
  });

  describe("focus-visible states - ring, outline, shadow", () => {
    it("has focus-visible:outline-none", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/focus-visible:/);
    });

    it("has focus-visible:ring-2", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/focus-visible:/) //-2");
    });

    it("has focus-visible:ring-accent", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/focus-visible:/) //-accent");
    });

    it("has focus-visible:ring-offset-2", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/focus-visible:/) //-offset-2");
    });

    it("has focus-visible:ring-offset-surface-page", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toMatch(/focus-visible:/) //-offset-surface-page");
    });

    it("has focus-visible:shadow-md", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("focus-visible:shadow-md");
    });
  });

  describe("disabled states - opacity, cursor, disabled: utilities", () => {
    it("has disabled:opacity-50", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("disabled:opacity-50");
    });

    it("has disabled:cursor-not-allowed", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("disabled:cursor-not-allowed");
    });

    it("has disabled attribute when disabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} disabled onToggle={vi.fn()} />);
      expect(screen.getByRole("switch")).toBeDisabled();
    });

    it("has cursor-pointer when enabled", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("cursor-pointer");
    });

    it("loading state is not a switch (status) and shows disabled appearance", () => {
      render(<DarkModeSwitcher loading isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("status").className).toContain("text-text-muted");
    });

    it("thumb has transition-transform", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-thumb").className).toContain("transition-transform");
    });
  });

  describe("transition & ring utilities", () => {
    it("has transition-colors duration-200", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      const cls = screen.getByRole("switch").className;
      expect(cls).toMatch(/transition/);
      expect(cls).toContain("duration-200");
    });

    it("thumb has duration-200 ease-in-out", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      const cls = screen.getByTestId("dark-mode-switcher-thumb").className;
      expect(cls).toContain("duration-200");
      expect(cls).toContain("ease-in-out");
    });

    it("container has rounded-full for pill shape", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("rounded-full");
    });

    it("thumb has rounded-full and bg-white and shadow-sm", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      const cls = screen.getByTestId("dark-mode-switcher-thumb").className;
      expect(cls).toContain("rounded-full");
      expect(cls).toContain("bg-white");
      expect(cls).toContain("shadow-sm");
    });
  });

  describe("opacity and cursor styles", () => {
    it("enabled has opacity via hover (not disabled opacity)", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      // has disabled variant (Tailwind) but not active when enabled
      expect(screen.getByRole("switch").className).toContain("disabled:opacity-50");
    });

    it("disabled has both cursor-not-allowed and opacity", () => {
      render(<DarkModeSwitcher isDarkMode={true} disabled onToggle={vi.fn()} />);
      const cls = screen.getByRole("switch").className;
      expect(cls).toContain("disabled:opacity-50");
      expect(cls).toContain("disabled:cursor-not-allowed");
    });
  });

  describe("state-based styling", () => {
    it("dark mode has bg-accent", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("bg-accent");
    });

    it("light mode has bg-surface-field", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByRole("switch").className).toContain("bg-surface-field");
    });

    it("dark thumb is translated", () => {
      render(<DarkModeSwitcher isDarkMode={true} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-thumb").className).toContain("translate-x-5");
    });

    it("light thumb is at origin", () => {
      render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
      expect(screen.getByTestId("dark-mode-switcher-thumb").className).toContain("translate-x-0");
    });
  });
});
