import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
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

function renderBellWithAdder(
  message = "Test",
  type: "success" | "error" | "warning" | "info" = "info"
) {
  function Adder() {
    const { addNotification } = useNotifications();
    return (
      <button data-testid="add-btn" onClick={() => addNotification(message, type)}>
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
// Root node structure
// ---------------------------------------------------------------------------

describe("NotificationBell — root node structure", () => {
  it("renders a root wrapper div with data-testid=notification-bell-root", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-root")).toBeInTheDocument();
  });

  it("root wrapper is a <div>", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-root").tagName).toBe("DIV");
  });

  it("root wrapper has relative positioning class", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-root")).toHaveClass("relative");
  });

  it("bell trigger is a <button> element", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn").tagName).toBe("BUTTON");
  });

  it("bell button has type=button to prevent form submission", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute("type", "button");
  });

  it("bell button is a child of the root wrapper", () => {
    renderBell();
    const root = screen.getByTestId("notification-bell-root");
    const btn  = screen.getByTestId("notification-bell-btn");
    expect(root).toContainElement(btn);
  });

  it("bell icon is a <span> inside the button", () => {
    renderBell();
    const btn  = screen.getByTestId("notification-bell-btn");
    const icon = btn.querySelector("span");
    expect(icon).not.toBeNull();
    expect(icon!.tagName).toBe("SPAN");
  });

  it("bell icon span has aria-hidden=true", () => {
    renderBell();
    const btn  = screen.getByTestId("notification-bell-btn");
    const icon = btn.querySelector("span");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the bell emoji inside the icon span", () => {
    renderBell();
    const btn = screen.getByTestId("notification-bell-btn");
    expect(btn).toHaveTextContent("🔔");
  });
});

// ---------------------------------------------------------------------------
// Button ARIA attributes
// ---------------------------------------------------------------------------

describe("NotificationBell — button ARIA attributes", () => {
  it("has aria-haspopup=true", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-haspopup",
      "true"
    );
  });

  it("has aria-expanded=false when panel is closed", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("has aria-expanded=true when panel is open", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("aria-label is 'Notifications' with zero unread", () => {
    renderBell();
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-label",
      "Notifications"
    );
  });

  it("aria-label includes count when unread > 0", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("hello");
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-bell-btn")).toHaveAttribute(
      "aria-label",
      "Notifications, 1 unread"
    );
  });
});

// ---------------------------------------------------------------------------
// Badge node structure
// ---------------------------------------------------------------------------

describe("NotificationBell — badge node structure", () => {
  it("badge is absent from the DOM when unread count is zero", () => {
    renderBell();
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("badge is a <span> element", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge").tagName).toBe("SPAN");
  });

  it("badge is a child of the bell button", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    const btn   = screen.getByTestId("notification-bell-btn");
    const badge = screen.getByTestId("notification-badge");
    expect(btn).toContainElement(badge);
  });

  it("badge has aria-hidden=true (decorative count)", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toHaveAttribute("aria-hidden", "true");
  });

  it("badge text content equals unread count", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("2");
  });

  it("badge shows 99+ when unread exceeds 99", async () => {
    function MassAdder() {
      const { addNotification } = useNotifications();
      return (
        <button
          data-testid="mass-add"
          onClick={() => {
            for (let i = 0; i < 100; i++) addNotification(`n${i}`, "info");
          }}
        >
          +100
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

  it("badge disappears after opening panel (markAllRead)", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Panel node structure
// ---------------------------------------------------------------------------

describe("NotificationBell — panel node structure", () => {
  it("panel is absent from the DOM when closed", () => {
    renderBell();
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("panel is a <div>", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel").tagName).toBe("DIV");
  });

  it("panel has role=dialog", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel")).toHaveAttribute("role", "dialog");
  });

  it("panel has aria-label='Notifications'", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel")).toHaveAttribute(
      "aria-label",
      "Notifications"
    );
  });

  it("panel is a child of the root wrapper", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    const root  = screen.getByTestId("notification-bell-root");
    const panel = screen.getByTestId("notification-panel");
    expect(root).toContainElement(panel);
  });

  it("panel contains a header with text 'Notifications'", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    const panel = screen.getByTestId("notification-panel");
    expect(within(panel).getByText("Notifications")).toBeInTheDocument();
  });

  it("panel contains a <ul> for the notification list", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    const panel = screen.getByTestId("notification-panel");
    expect(panel.querySelector("ul")).not.toBeNull();
  });

  it("notification list <ul> has aria-label='Notification list'", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByRole("list", { name: "Notification list" })).toBeInTheDocument();
  });

  it("closes panel on outside click", async () => {
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <NotificationBell />
        <div data-testid="outside">outside</div>
      </NotificationProvider>
    );
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });

  it("clear-all button is a <button> with type=button", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    const clearBtn = screen.getByTestId("notification-clear-btn");
    expect(clearBtn.tagName).toBe("BUTTON");
    expect(clearBtn).toHaveAttribute("type", "button");
  });
});

// ---------------------------------------------------------------------------
// Notification item node structure
// ---------------------------------------------------------------------------

describe("NotificationBell — notification item nodes", () => {
  it("each notification renders as a <li>", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Milestone paid");
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    const item = screen.getByTestId("notification-item");
    expect(item.tagName).toBe("LI");
  });

  it("item contains a type icon <span> and a message <span>", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Release funds");
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    const item   = screen.getByTestId("notification-item");
    const spans  = item.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);
  });

  it("message text is rendered inside the item", async () => {
    const user = userEvent.setup();
    renderBellWithAdder("Escrow funded successfully");
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getByTestId("notification-item")).toHaveTextContent(
      "Escrow funded successfully"
    );
  });

  it("multiple notifications each render their own <li>", async () => {
    const user = userEvent.setup();
    renderBellWithAdder();
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("add-btn"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    expect(screen.getAllByTestId("notification-item")).toHaveLength(3);
  });

  it("most recent notification appears first (newest-first order)", async () => {
    function OrderAdder() {
      const { addNotification } = useNotifications();
      return (
        <>
          <button data-testid="add-first"  onClick={() => addNotification("First",  "info")}>First</button>
          <button data-testid="add-second" onClick={() => addNotification("Second", "info")}>Second</button>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <NotificationBell />
        <OrderAdder />
      </NotificationProvider>
    );
    await user.click(screen.getByTestId("add-first"));
    await user.click(screen.getByTestId("add-second"));
    await user.click(screen.getByTestId("notification-bell-btn"));
    const items = screen.getAllByTestId("notification-item");
    expect(items[0]).toHaveTextContent("Second");
    expect(items[1]).toHaveTextContent("First");
  });

  it("empty state <li> is shown when list has no items", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByTestId("notification-bell-btn"));
    const empty = screen.getByTestId("notification-empty");
    expect(empty.tagName).toBe("LI");
  });
});

// ---------------------------------------------------------------------------
// Type-specific icon and colour rendering
// ---------------------------------------------------------------------------

describe("NotificationBell — per-type icon and colour nodes", () => {
  const cases = [
    { type: "success", icon: "✓", colourClass: "text-success-soft" },
    { type: "error",   icon: "✕", colourClass: "text-danger-soft"  },
    { type: "warning", icon: "⚠", colourClass: "text-warning-soft" },
    { type: "info",    icon: "ℹ", colourClass: "text-info-soft"    },
  ] as const;

  for (const { type, icon, colourClass } of cases) {
    it(`renders '${icon}' icon for ${type} notifications`, async () => {
      const user = userEvent.setup();
      renderBellWithAdder(`${type} message`, type);
      await user.click(screen.getByTestId("add-btn"));
      await user.click(screen.getByTestId("notification-bell-btn"));
      const item      = screen.getByTestId("notification-item");
      const iconSpan  = item.querySelector("span[aria-hidden]");
      expect(iconSpan).toHaveTextContent(icon);
    });

    it(`applies '${colourClass}' colour class for ${type} notifications`, async () => {
      const user = userEvent.setup();
      renderBellWithAdder(`${type} message`, type);
      await user.click(screen.getByTestId("add-btn"));
      await user.click(screen.getByTestId("notification-bell-btn"));
      const item      = screen.getByTestId("notification-item");
      const iconSpan  = item.querySelector("span[aria-hidden]");
      expect(iconSpan).toHaveClass(colourClass);
    });
  }
});

// ---------------------------------------------------------------------------
// useNotifications outside provider
// ---------------------------------------------------------------------------

describe("useNotifications", () => {
  it("throws when used outside NotificationProvider", () => {
    // Suppress the expected React error boundary console output
    const err = console.error;
    console.error = () => {};
    function Bad() {
      useNotifications();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(
      "useNotifications must be used within a NotificationProvider"
    );
    console.error = err;
  });
});
