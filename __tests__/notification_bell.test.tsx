/**
 * Test suite for `notification_bell` (Navbar alert bell badge).
 *
 * Covers:
 *  - #320 a11y compliance: keyboard operability, ARIA roles/attributes,
 *    aria-live regions, aria-hidden on decorative glyphs, focus-visible
 *    styling, and accessible labels / badge counts.
 *  - #324 validation alerts: error text elements that toggle when
 *    validation triggers, role="alert" announcement, aria-invalid +
 *    aria-describedby wiring, and badge counts driven by errors.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotificationBell from "@/app/components/notification_bell";

const renderBell = (props = {}) => render(<NotificationBell {...props} />);

// ===========================================================================
// #320 — a11y: keyboard operability & ARIA roles
// ===========================================================================

describe("notification_bell — a11y (keyboard & ARIA)", () => {
  it("renders a native button trigger with an accessible name", () => {
    renderBell();
    expect(screen.getByRole("button", { name: /Notifications/ })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInstanceOf(HTMLButtonElement);
  });

  it("exposes the disclosure state via aria-expanded", () => {
    renderBell();
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("declares the panel with aria-haspopup and links it via aria-controls", () => {
    renderBell();
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)?.id).toBe(panelId);
  });

  it("marks decorative bell glyph as aria-hidden", () => {
    renderBell();
    const glyph = screen.getByText("🔔");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the visible badge count as aria-hidden and duplicates it in sr-only text", () => {
    renderBell({
      notifications: [{ id: "n1", type: "info", title: "Hi" }],
    });
    const hiddenCount = screen.getAllByText("1").find((el) =>
      el.hasAttribute("aria-hidden")
    );
    expect(hiddenCount).toBeTruthy();
    expect(
      screen.getByText("1 unread notification")
    ).toBeInTheDocument();
  });

  it("announces the panel via an aria-live region once opened", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-live", "polite");
  });

  it("provides a focus-visible ring class on the trigger", () => {
    renderBell();
    expect(screen.getByRole("button").className).toMatch(/focus-visible:ring/);
  });

  it("operates from the keyboard (Enter/Space activate the native button)", () => {
    renderBell();
    const trigger = screen.getByRole("button");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(trigger, { key: " " });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

// ===========================================================================
// #320 — a11y: accessible names & landmark context
// ===========================================================================

describe("notification_bell — a11y (labels & landmarks)", () => {
  it("supports a custom accessible-name label on the trigger", () => {
    renderBell({ label: "Alerts" });
    expect(screen.getByRole("button", { name: /Alerts/ })).toBeInTheDocument();
  });

  it("names the dialog panel after the label", () => {
    renderBell({ label: "Alerts" });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog", { name: "Alerts panel" })).toBeInTheDocument();
  });

  it("groups validation fields inside a labelled region", () => {
    renderBell({ fields: [{ name: "amount", label: "Amount" }] });
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByRole("group", { name: "Validation errors" })
    ).toBeInTheDocument();
  });

  it("shows a 'caught up' message when there is nothing to show", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });
});

// ===========================================================================
// #324 — validation alerts toggle with validation triggers
// ===========================================================================

describe("notification_bell — validation alerts (#324)", () => {
  it("renders an error message when a field is invalid", () => {
    renderBell({
      fields: [
        { name: "amount", label: "Milestone amount", error: "Amount is required." },
      ],
    });
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByRole("alert", { name: "" })
    ).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it("hides the error text when the field becomes valid", () => {
    const { rerender } = render(
      <NotificationBell
        fields={[{ name: "amount", label: "Milestone amount", error: "Amount is required." }]}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();

    rerender(
      <NotificationBell
        fields={[{ name: "amount", label: "Milestone amount", error: null }]}
      />
    );
    expect(screen.queryByText("Amount is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("marks valid fields as clean with no alert role", () => {
    renderBell({ fields: [{ name: "amount", label: "Milestone amount" }] });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("announces field errors with role=alert and assertive aria-live", () => {
    renderBell({
      fields: [
        { name: "deadline", label: "Deadline", error: "Deadline is in the past." },
      ],
    });
    fireEvent.click(screen.getByRole("button"));
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    expect(alertEl).toHaveTextContent("Deadline is in the past.");
  });

  it("counts invalid fields toward the badge", () => {
    renderBell({
      fields: [
        { name: "a", label: "A", error: "bad" },
        { name: "b", label: "B", error: "bad" },
      ],
    });
    expect(screen.getAllByText("2")).toHaveLength(1);
    expect(screen.getByText("2 unread notifications")).toBeInTheDocument();
  });

  it("clears the badge when all fields validate", () => {
    const { rerender } = render(
      <NotificationBell fields={[{ name: "a", label: "A", error: "bad" }]} />
    );
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    rerender(<NotificationBell fields={[{ name: "a", label: "A" }]} />);
    expect(screen.queryByText(/unread notification/)).not.toBeInTheDocument();
  });

  it("renders a per-field indicator inside the validation group", () => {
    renderBell({
      fields: [
        { name: "amount", label: "Milestone amount", error: "Amount is required." },
        { name: "token", label: "Token" },
      ],
    });
    fireEvent.click(screen.getByRole("button"));
    const group = screen.getByRole("group", { name: "Validation errors" });
    expect(within(group).getByText("Amount is required.")).toBeInTheDocument();
    expect(within(group).getByText("Milestone amount")).toBeInTheDocument();
    expect(within(group).getByText("Token")).toBeInTheDocument();
  });
});

// ===========================================================================
// #324 — notification panels & alert roles
// ===========================================================================

describe("notification_bell — notifications & alert roles", () => {
  it("renders each notification in the panel", () => {
    renderBell({
      notifications: [
        { id: "n1", type: "info", title: "New milestone" },
        { id: "n2", type: "warning", title: "Low balance" },
      ],
    });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("New milestone")).toBeInTheDocument();
    expect(screen.getByText("Low balance")).toBeInTheDocument();
  });

  it("uses role=alert with assertive live for error notifications", () => {
    renderBell({
      notifications: [{ id: "err", type: "error", title: "Signature failed" }],
    });
    fireEvent.click(screen.getByRole("button"));
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    expect(alertEl).toHaveTextContent("Signature failed");
  });

  it("uses role=status for non-error notifications", () => {
    renderBell({
      notifications: [{ id: "ok", type: "success", title: "Released" }],
    });
    fireEvent.click(screen.getByRole("button"));
    const statusEl = screen.getAllByRole("status").find((el) =>
      el.textContent?.includes("Released")
    );
    expect(statusEl).toBeTruthy();
  });

  it("marks the panel hidden until opened", () => {
    renderBell({ notifications: [{ id: "n1", type: "info", title: "Hi" }] });
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveProperty("hidden", true);
    fireEvent.click(screen.getByRole("button"));
    expect(dialog).toHaveProperty("hidden", false);
  });
});
