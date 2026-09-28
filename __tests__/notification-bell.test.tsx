import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NotificationBell from "@/app/components/NotificationBell";
import type { NotificationItem } from "@/app/components/NotificationBell";


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



const mockNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Milestone Approved",
    message: "Milestone #2 was approved by client.",
    timestamp: "10m ago",
    read: false,
    type: "success",
  },
  {
    id: "notif-2",
    title: "Payment Received",
    message: "250 XLM released.",
    timestamp: "1h ago",
    read: true,
    type: "info",
  },
];

describe("NotificationBell Component", () => {
  it("renders bell button with zero unread state by default", () => {
    render(<NotificationBell unreadCount={0} />);
    const bell = screen.getByTestId("notification-bell");
    expect(bell).toBeInTheDocument();
    expect(bell).toHaveAttribute("data-status", "read");
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("renders unread count badge when unreadCount > 0", () => {
    render(<NotificationBell unreadCount={5} />);
    const bell = screen.getByTestId("notification-bell");
    expect(bell).toHaveAttribute("data-status", "unread");

    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveTextContent("5");
    expect(
      screen.getByRole("button", { name: "Notifications (5 unread)" })
    ).toBeInTheDocument();
  });

  it("displays 99+ for unread counts over 99", () => {
    render(<NotificationBell unreadCount={150} />);
    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveTextContent("99+");
  });

  it("toggles dropdown open and closed when bell is clicked (uncontrolled)", () => {
    render(<NotificationBell unreadCount={2} notifications={mockNotifications} />);
    const bell = screen.getByTestId("notification-bell");

    expect(screen.queryByTestId("notification-dropdown")).not.toBeInTheDocument();

    fireEvent.click(bell);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Milestone Approved")).toBeInTheDocument();

    fireEvent.click(bell);
    expect(screen.queryByTestId("notification-dropdown")).not.toBeInTheDocument();
  });

  it("respects controlled isOpen prop", () => {
    render(
      <NotificationBell
        isOpen={true}
        unreadCount={2}
        notifications={mockNotifications}
      />
    );
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
  });

  it("renders loading state inside dropdown when isLoading is true", () => {
    render(<NotificationBell isOpen={true} isLoading={true} />);
    expect(screen.getByTestId("notification-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("renders error alert inside dropdown when error prop is provided", () => {
    render(
      <NotificationBell
        isOpen={true}
        error="Network error fetching notifications"
      />
    );
    expect(screen.getByTestId("notification-error")).toBeInTheDocument();
    expect(
      screen.getByText("Network error fetching notifications")
    ).toBeInTheDocument();
  });

  it("renders empty state inside dropdown when notifications list is empty", () => {
    render(<NotificationBell isOpen={true} notifications={[]} />);
    expect(screen.getByTestId("notification-empty")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("calls onMarkAllAsRead when 'Mark all as read' is clicked", () => {
    const onMarkAllAsRead = vi.fn();
    render(
      <NotificationBell
        isOpen={true}
        unreadCount={2}
        notifications={mockNotifications}
        onMarkAllAsRead={onMarkAllAsRead}
      />
    );

    const markBtn = screen.getByRole("button", { name: "Mark all as read" });
    fireEvent.click(markBtn);
    expect(onMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it("calls onNotificationClick when a notification item is clicked", () => {
    const onNotificationClick = vi.fn();
    render(
      <NotificationBell
        isOpen={true}
        notifications={mockNotifications}
        onNotificationClick={onNotificationClick}
      />
    );

    const item = screen.getByTestId("notification-item-notif-1");
    fireEvent.click(item);
    expect(onNotificationClick).toHaveBeenCalledWith(mockNotifications[0]);
  });

  it("calls onClearAll when 'Clear all' button is clicked", () => {
    const onClearAll = vi.fn();
    render(
      <NotificationBell
        isOpen={true}
        notifications={mockNotifications}
        onClearAll={onClearAll}
      />
    );

    const clearBtn = screen.getByRole("button", { name: "Clear all" });
    fireEvent.click(clearBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not toggle dropdown when disabled is true", () => {
    const onBellClick = vi.fn();
    render(<NotificationBell disabled={true} onBellClick={onBellClick} />);

    const bell = screen.getByTestId("notification-bell");
    expect(bell).toBeDisabled();
    expect(bell).toHaveAttribute("data-status", "disabled");

    fireEvent.click(bell);
    expect(onBellClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("notification-dropdown")).not.toBeInTheDocument();
  });

  it("sets correct aria attributes for accessibility", () => {
    render(<NotificationBell unreadCount={3} isOpen={true} />);
    const bell = screen.getByTestId("notification-bell");

    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(bell).toHaveAttribute("aria-haspopup", "true");
    expect(bell).toHaveAttribute("aria-label", "Notifications (3 unread)");
  });
});
