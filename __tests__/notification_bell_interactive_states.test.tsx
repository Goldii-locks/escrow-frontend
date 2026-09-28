/**
 * Test suite for `notification_bell` premium interactive states (#321).
 *
 * Covers:
 *  - Visible hover affordances (background + pointer affordances).
 *  - Active/pressed feedback on the trigger.
 *  - Focus-visible ring for keyboard users.
 *  - Disabled trigger: native + ARIA disabled, no toggle, styled fallback,
 *    keyboard inertness while the unread badge stays visible.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import NotificationBell from "@/app/components/notification_bell";

const renderBell = (props = {}) => render(<NotificationBell {...props} />);

describe("notification_bell — interactive states (#321)", () => {
  let trigger: HTMLElement;

  beforeEach(() => {
    renderBell({ notifications: [{ id: "n1", type: "info", title: "Hi" }] });
    trigger = screen.getByRole("button");
  });

  it("restyles the trigger on hover", () => {
    expect(trigger.className).toMatch(/hover:bg-gray-700/);
  });

  it("provides pressed/active feedback on the trigger", () => {
    expect(trigger.className).toMatch(/active:bg-gray-600/);
    expect(trigger.className).toMatch(/active:scale-95/);
  });

  it("keeps the focus-visible keyboard ring on the trigger", () => {
    expect(trigger.className).toMatch(/focus-visible:ring-2/);
    expect(trigger.className).toMatch(/focus-visible:ring-indigo-400/);
    expect(trigger.className).toMatch(/focus-visible:ring-offset-2/);
  });

  it("is still keyboard-operable and toggles the panel on activation", () => {
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("notification_bell — disabled trigger (#321)", () => {
  it("reflects the disabled state on native and ARIA attributes", () => {
    renderBell({ disabled: true });
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
  });

  it("applies disabled affordances (muted, inert hover/press/focus)", () => {
    renderBell({ disabled: true, notifications: [{ id: "n", type: "info", title: "Hi" }] });
    const trigger = screen.getByRole("button");
    expect(trigger.className).toMatch(/disabled:cursor-not-allowed/);
    expect(trigger.className).toMatch(/disabled:opacity-60/);
    expect(trigger.className).toMatch(/disabled:hover:bg-gray-800/);
    expect(trigger.className).toMatch(/disabled:active:scale-100/);
    expect(trigger.className).toMatch(/disabled:focus-visible:ring-0/);
  });

  it("does not open the panel when clicked while disabled", () => {
    renderBell({ disabled: true });
    const trigger = screen.getByRole("button");
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveProperty("hidden", true);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(dialog).toHaveProperty("hidden", true);
  });

  it("ignores keyboard activation while disabled", () => {
    renderBell({ disabled: true });
    const trigger = screen.getByRole("button");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog", { hidden: true })).toHaveProperty(
      "hidden",
      true
    );
  });

  it("retains the unread badge and accessible name while disabled", () => {
    const label = "Alerts";
    renderBell({
      disabled: true,
      label,
      notifications: [{ id: "n", type: "error", title: "Boom" }],
    });
    expect(screen.getByRole("button", { name: /Alerts/ })).toBeInTheDocument();
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
  });

  it("does not expose disabled when the prop is absent", () => {
    renderBell();
    const trigger = screen.getByRole("button");
    expect(trigger).not.toBeDisabled();
    expect(trigger).not.toHaveAttribute("aria-disabled");
  });
});