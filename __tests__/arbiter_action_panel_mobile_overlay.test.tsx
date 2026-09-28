/**
 * Mobile overlay wrapper suite for ArbiterActionPanel.
 *
 * On phones the panel is capped to the dynamic viewport height, its body
 * scrolls on its own, and the submit bar is pinned to the bottom. These
 * tests assert that structure at mobile widths, that it is released from
 * `sm:` upward, and that every control stays clickable on mobile viewports.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import { ARBITER_PANEL_CLASSES } from "@/app/lib/arbiter_action_panel";

const MOBILE_WIDTHS = [320, 360, 375, 414];
const originalInnerWidth = window.innerWidth;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
});

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) => {
  const onResolve = vi.fn();
  const utils = render(
    <ArbiterActionPanel milestoneIndex={0} onResolve={onResolve} {...props} />,
  );
  return { onResolve, ...utils };
};

describe("overlay wrapper structure", () => {
  it("caps the panel to 75dvh and clips it on mobile only", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveClass(
      "flex",
      "flex-col",
      "max-h-[75dvh]",
      "overflow-hidden",
      "sm:max-h-none",
      "sm:overflow-visible",
    );
  });

  it("gives the body its own contained scroll on mobile", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-scroll")).toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
      "sm:overflow-visible",
    );
  });

  it("pads the scroll area so focus rings are not clipped", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-scroll")).toHaveClass("-mx-1", "px-1", "py-1");
  });

  it("pins the submit bar to the bottom on mobile and releases it from sm:", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-actions")).toHaveClass(
      "sticky",
      "bottom-0",
      "z-10",
      "shrink-0",
      "bg-surface-card",
      "sm:static",
      "sm:bg-transparent",
    );
  });

  it("keeps the submit bar outside the scrolling body", () => {
    renderPanel();
    const scroll = screen.getByTestId("arbiter-panel-scroll");
    const actions = screen.getByTestId("arbiter-panel-actions");
    expect(scroll).not.toContainElement(actions);
    expect(actions.parentElement).toBe(screen.getByTestId("arbiter-action-panel"));
    expect(actions.previousElementSibling).toBe(scroll);
  });

  it("puts every form control inside the scrolling body", () => {
    renderPanel({ resolveState: { phase: "error", error: "Failed", txHash: null } });
    const scroll = screen.getByTestId("arbiter-panel-scroll");
    expect(scroll).toContainElement(screen.getByRole("group", { name: "Outcome" }));
    expect(scroll).toContainElement(screen.getByRole("checkbox"));
    expect(scroll).toContainElement(screen.getByTestId("arbiter-panel-status"));
  });

  it("exposes the class strings it renders with", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-scroll").className).toBe(
      ARBITER_PANEL_CLASSES.scrollableContent,
    );
    expect(screen.getByTestId("arbiter-panel-actions").className).toContain(
      ARBITER_PANEL_CLASSES.stickyFooter,
    );
  });
});

describe("overlay constraint per viewport", () => {
  it.each(MOBILE_WIDTHS)("constrains height at %ipx", (width) => {
    setViewportWidth(width);
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveAttribute(
      "data-constrained",
      "true",
    );
    expect(screen.getByTestId("arbiter-panel-actions")).toHaveAttribute(
      "data-sticky",
      "true",
    );
  });

  it.each([640, 768, 1024, 1440])("does not constrain height at %ipx", (width) => {
    setViewportWidth(width);
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveAttribute(
      "data-constrained",
      "false",
    );
    expect(screen.getByTestId("arbiter-panel-actions")).toHaveAttribute(
      "data-sticky",
      "false",
    );
  });

  it("toggles the constraint live across a rotation", () => {
    setViewportWidth(375);
    renderPanel();
    const panel = screen.getByTestId("arbiter-action-panel");
    expect(panel).toHaveAttribute("data-constrained", "true");
    setViewportWidth(812);
    expect(panel).toHaveAttribute("data-constrained", "false");
    setViewportWidth(375);
    expect(panel).toHaveAttribute("data-constrained", "true");
  });
});

describe("clickable on mobile viewports", () => {
  it.each(MOBILE_WIDTHS)("completes a resolution by tapping at %ipx", async (width) => {
    setViewportWidth(width);
    const user = userEvent.setup();
    const { onResolve } = renderPanel();

    await user.click(screen.getByTestId("arbiter-outcome-refund"));
    await user.click(screen.getByText("I understand this decision is final."));
    await user.click(screen.getByTestId("arbiter-submit"));

    expect(onResolve).toHaveBeenCalledWith(0, false);
  });

  it("selects an outcome by tapping anywhere on its card, including the hint", async () => {
    setViewportWidth(375);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByText("Pay the disputed funds to the freelancer."));
    expect(screen.getByRole("radio", { name: /Release/ })).toBeChecked();
  });

  it("responds to touch-driven pointer events", () => {
    setViewportWidth(375);
    const { onResolve } = renderPanel();
    fireEvent.pointerDown(screen.getByTestId("arbiter-outcome-release"), {
      pointerType: "touch",
    });
    fireEvent.click(screen.getByTestId("arbiter-outcome-release"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByTestId("arbiter-submit"));
    expect(onResolve).toHaveBeenCalledWith(0, true);
  });

  it("keeps the submit reachable while field errors expand the body", async () => {
    setViewportWidth(320);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByTestId("arbiter-submit"));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    const actions = screen.getByTestId("arbiter-panel-actions");
    expect(screen.getByTestId("arbiter-panel-scroll")).not.toContainElement(actions);
    expect(within(actions).getByTestId("arbiter-submit")).toBeEnabled();
  });

  it("uses 44px minimum tap targets for every control row", () => {
    setViewportWidth(375);
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass("min-h-[44px]");
    expect(screen.getByTestId("arbiter-outcome-refund")).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("checkbox").closest("label")).toHaveClass("min-h-[44px]");
    expect(screen.getByTestId("arbiter-submit")).toHaveClass("min-h-[44px]", "w-full");
  });

  it("removes tap delay and accidental text selection on touch", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass(
      "touch-manipulation",
      "select-none",
    );
    expect(screen.getByRole("checkbox").closest("label")).toHaveClass(
      "touch-manipulation",
      "select-none",
    );
    expect(screen.getByTestId("arbiter-submit")).toHaveClass("touch-manipulation");
  });

  it("never blocks pointer events on its controls", () => {
    renderPanel();
    const panel = screen.getByTestId("arbiter-action-panel");
    panel.querySelectorAll("*").forEach((el) => {
      expect(el.className.toString()).not.toMatch(/pointer-events-none/);
    });
  });

  it("stacks the sticky footer above scrolled content", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-actions")).toHaveClass("z-10");
  });
});
