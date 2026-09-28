/**
 * Test suite for `notification_bell` empty list display views (#323).
 *
 * Covers:
 *  - A premium placeholder when the panel receives no notifications and no
 *    validation fields ("You're all caught up." with helper copy).
 *  - A compact "No new notifications." placeholder when notifications are
 *    empty but validation fields populate the panel.
 *  - That placeholders are suppressed as soon as real content exists.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotificationBell from "@/app/components/notification_bell";

const openBell = (props = {}) => {
  render(<NotificationBell {...props} />);
  fireEvent.click(screen.getByRole("button"));
};

describe("notification_bell — empty list views (#323)", () => {
  it("shows the premium placeholder when the panel receives no data", () => {
    openBell();
    const emptyState = screen.getByTestId("notification-bell-empty-state");
    expect(emptyState).toHaveAttribute("role", "status");
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(
      screen.getByText(/No alerts right now\./)
    ).toBeInTheDocument();
  });

  it("marks the empty-state glyph as decorative", () => {
    openBell();
    const glyph = screen.getByText("🛎️");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("keeps the panel labelled while showing the placeholder", () => {
    openBell({ label: "Alerts" });
    expect(screen.getByRole("dialog", { name: "Alerts panel" })).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell-empty-state")).toBeInTheDocument();
  });

  it("suppresses the Placeholder when notifications are present", () => {
    openBell({ notifications: [{ id: "n1", type: "info", title: "Hi" }] });
    expect(screen.queryByTestId("notification-bell-empty-state")).toBeNull();
    expect(screen.queryByTestId("notification-bell-notifications-empty")).toBeNull();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("shows a compact placeholder for empty notifications alongside validation fields", () => {
    openBell({
      fields: [{ name: "amount", label: "Milestone amount" }],
    });
    expect(screen.getByTestId("notification-bell-notifications-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-bell-empty-state")).toBeNull();
    expect(screen.getByText("No new notifications.")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("keeps validation alerts visible with the notifications placeholder", () => {
    openBell({
      fields: [
        { name: "amount", label: "Milestone amount", error: "Amount is required." },
      ],
    });
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell-notifications-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-bell-empty-state")).toBeNull();
  });

  it("renders no placeholder when notifications and valid fields coexist", () => {
    openBell({
      notifications: [{ id: "n1", type: "success", title: "Released" }],
      fields: [{ name: "amount", label: "Milestone amount" }],
    });
    expect(screen.queryByTestId("notification-bell-empty-state")).toBeNull();
    expect(screen.queryByTestId("notification-bell-notifications-empty")).toBeNull();
    expect(screen.getByText("Released")).toBeInTheDocument();
  });
});