import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NotificationBell from "@/app/components/NotificationBell";

describe("NotificationBell", () => {
  describe("without notifications", () => {
    it("renders bell icon when count is 0", () => {
      render(<NotificationBell count={0} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders bell icon when count is not provided", () => {
      render(<NotificationBell />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("does not render badge when count is 0", () => {
      render(<NotificationBell count={0} />);
      const badge = screen.queryByText("0");
      expect(badge).not.toBeInTheDocument();
    });

    it("uses default aria-label", () => {
      render(<NotificationBell count={0} />);
      expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    });

    it("uses custom aria-label when provided", () => {
      render(<NotificationBell count={0} ariaLabel="Alerts" />);
      expect(screen.getByRole("button", { name: "Alerts" })).toBeInTheDocument();
    });
  });

  describe("with notifications", () => {
    it("renders badge with count when count is 1", () => {
      render(<NotificationBell count={1} />);
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("renders badge with count when count is 5", () => {
      render(<NotificationBell count={5} />);
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("renders '99+' when count exceeds 99", () => {
      render(<NotificationBell count={100} />);
      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("renders '99+' when count is exactly 99", () => {
      render(<NotificationBell count={99} />);
      expect(screen.getByText("99")).toBeInTheDocument();
    });

    it("sets aria-label on badge with count", () => {
      render(<NotificationBell count={5} />);
      const badge = screen.getByText("5");
      expect(badge).toHaveAttribute("aria-label", "5 unread notifications");
    });

    it("sets aria-label on badge with 99+", () => {
      render(<NotificationBell count={150} />);
      const badge = screen.getByText("99+");
      expect(badge).toHaveAttribute("aria-label", "150 unread notifications");
    });
  });

  describe("interactions", () => {
    it("calls onClick when button is clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<NotificationBell count={0} onClick={onClick} />);
      
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("does not call onClick when not provided", async () => {
      const user = userEvent.setup();
      render(<NotificationBell count={0} />);
      
      await user.click(screen.getByRole("button"));
      // Should not throw error
    });
  });

  describe("design tokens", () => {
    it("applies custom className", () => {
      render(<NotificationBell count={0} className="mt-4" />);
      expect(screen.getByRole("button").className).toContain("mt-4");
    });

    it("uses design token for button background on hover", () => {
      render(<NotificationBell count={0} />);
      const button = screen.getByRole("button");
      expect(button.className).toContain("hover:bg-surface-field");
    });

    it("uses design token for focus ring", () => {
      render(<NotificationBell count={0} />);
      const button = screen.getByRole("button");
      expect(button.className).toContain("focus-visible:ring-accent-soft");
      expect(button.className).toContain("focus-visible:ring-offset-surface-page");
    });

    it("uses design token for bell icon color", () => {
      render(<NotificationBell count={0} />);
      const { container } = render(<NotificationBell count={0} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-text-secondary");
    });

    it("uses design token for badge background", () => {
      render(<NotificationBell count={5} />);
      const badge = screen.getByText("5");
      expect(badge).toHaveClass("bg-accent");
    });

    it("uses design token for badge text color", () => {
      render(<NotificationBell count={5} />);
      const badge = screen.getByText("5");
      expect(badge).toHaveClass("text-white");
    });

    it("uses design token for badge border", () => {
      render(<NotificationBell count={5} />);
      const badge = screen.getByText("5");
      expect(badge).toHaveClass("border-surface-page");
    });
  });

  describe("accessibility", () => {
    it("has aria-live polite for announcements", () => {
      render(<NotificationBell count={0} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-live", "polite");
    });

    it("marks bell icon as aria-hidden", () => {
      const { container } = render(<NotificationBell count={0} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("provides button role", () => {
      render(<NotificationBell count={0} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });
});
