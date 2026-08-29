import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import NotificationBell from "@/app/components/NotificationBell";
import {
  NotificationProvider,
  useNotifications,
} from "@/app/context/NotificationContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBell() {
  return render(
    <NotificationProvider>
      <NotificationBell />
    </NotificationProvider>
  );
}

/** Renders the bell alongside a button that injects a notification */
function renderBellWithAdder(message = "Test message", type: "success" | "error" | "warning" | "info" = "info") {
  function Adder() {
    const { addNotification } = useNotifications();
    return (
      <button
        data-testid="add-btn"
        onClick={() => addNotification(message, type)}
      >
        Add
      </button>
    );
  }
  return render(
    <NotificationProvider>
      <NotificationBell />
      <Adder />
    </NotificationProvider>
  );
}

// ---------------------------------------------------------------------------
// NotificationContext
// ---------------------------------------------------------------------------

describe("NotificationContext", () => {
  it("starts with no notifications", () => {
    function Inspector() {
      const { notifications } = useNotifications();
      return <span data-testid="count">{notifications.length}</span>;
    }
    render(
      <NotificationProvider>
        <Inspector />
      </NotificationProvider>
    );
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("addNotification appends an unread entry", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Hello");
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toBeInTheDocument();
  });

  it("unreadCount increments per notification added", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("2");
  });

  it("markAllRead (opening the panel) zeroes unread count", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    // open panel → markAllRead fires
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("clearAll removes all notifications", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    await user.click(screen.getByTestId("notification-clear-btn"));
    expect(screen.getByTestId("notification-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NotificationBell — rendering
// ---------------------------------------------------------------------------

describe("NotificationBell rendering", () => {
  it("renders the bell button", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toBeInTheDocument();
  });

  it("has aria-label 'Notifications' when no unread", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-label",
      "Notifications"
    );
  });

  it("updates aria-label with unread count", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("msg");
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-label",
      "Notifications, 1 unread"
    );
  });

  it("does not show badge when no unread notifications", () => {
    renderBell();
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("shows badge when there are unread notifications", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toBeInTheDocument();
  });

  it("badge displays correct count", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("3");
  });

  it("badge caps display at 99+", async () => {
    function MassAdder() {
      const { addNotification } = useNotifications();
      return (
        <button
          data-testid="mass-add"
          onClick={() => {
            for (let i = 0; i < 100; i++) addNotification(`msg ${i}`, "info");
          }}
        >
          Add 100
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <NotificationBell />
        <MassAdder />
      </NotificationProvider>
    );
    await user.click(screen.getByTestId("mass-add"));
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("99+");
  });

  it("badge has animate-badge-pop class", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toHaveClass("animate-badge-pop");
  });

  it("panel is hidden initially", () => {
    renderBell();
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NotificationBell — panel open/close
// ---------------------------------------------------------------------------

describe("NotificationBell panel", () => {
  it("opens panel on click", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });

  it("closes panel on second click", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("panel has animate-panel-slide class", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel")).toHaveClass("animate-panel-slide");
  });

  it("shows empty state when no notifications", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-empty")).toHaveTextContent("No notifications");
  });

  it("shows notification items in the panel", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Payment received");
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getAllByTestId("notification-item")).toHaveLength(1);
    expect(screen.getByTestId("notification-panel")).toHaveTextContent("Payment received");
  });

  it("shows clear-all button when notifications exist", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-clear-btn")).toBeInTheDocument();
  });

  it("hides clear-all button when list is empty", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.queryByTestId("notification-clear-btn")).not.toBeInTheDocument();
  });

  it("aria-expanded reflects open state", async () => {
    const user = userEvent.setup();
    renderBell();
    const btn = screen.getByTestId("notification-bell-btn");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

// ---------------------------------------------------------------------------
// NotificationBell — animations
// ---------------------------------------------------------------------------

describe("NotificationBell animations", () => {
  it("adds animate-bell-ring when a new notification arrives", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-bell-btn")).toHaveClass("animate-bell-ring");
  });

  it("removes animate-bell-ring after animationEnd fires", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    const btn = screen.getByTestId("notification-bell-btn");
    act(() => {
      btn.dispatchEvent(
        new AnimationEvent("animationend", { animationName: "bell-ring", bubbles: true })
      );
    });
    expect(btn).not.toHaveClass("animate-bell-ring");
  });

  it("adds animate-bell-press on click", async () => {
    const user = userEvent.setup();
    renderBell();
    // Check class before animationend clears it
    const btn = screen.getByTestId("notification-bell-btn");
    await user.click(btn);
    // pressing state is set synchronously on click, cleared on animationend
    // After click the panel is open; pressing=true until animationend
    act(() => {
      btn.dispatchEvent(
        new AnimationEvent("animationend", { animationName: "bell-press", bubbles: true })
      );
    });
    expect(btn).not.toHaveClass("animate-bell-press");
  });

  it("notification items have animate-fade-in class", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Milestone approved");
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    const items = screen.getAllByTestId("notification-item");
    items.forEach((item: HTMLElement) => expect(item).toHaveClass("animate-fade-in"));
  });
});
