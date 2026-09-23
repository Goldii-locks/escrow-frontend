/**
 * Responsive layout suite for ArbiterActionPanel: asserts the panel reports
 * and styles the right structure at mobile, tablet, and desktop widths.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import MilestoneCard from "@/app/components/MilestoneCard";
import {
  ARBITER_PANEL_CLASSES,
  ARBITER_PANEL_DESKTOP_MIN_WIDTH,
  ARBITER_PANEL_TABLET_MIN_WIDTH,
} from "@/app/lib/arbiter_action_panel";

const WIDTHS = {
  phoneSmall: 320,
  phone: 375,
  tablet: 768,
  tabletLarge: 1000,
  laptop: 1280,
  desktop: 1920,
};

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

const renderPanel = () =>
  render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);

describe("ArbiterActionPanel — viewport structure", () => {
  it.each([
    ["phoneSmall", WIDTHS.phoneSmall, "mobile", 1, true],
    ["phone", WIDTHS.phone, "mobile", 1, true],
    ["tablet boundary", ARBITER_PANEL_TABLET_MIN_WIDTH, "tablet", 2, false],
    ["tablet", WIDTHS.tablet, "tablet", 2, false],
    ["tabletLarge", WIDTHS.tabletLarge, "tablet", 2, false],
    ["desktop boundary", ARBITER_PANEL_DESKTOP_MIN_WIDTH, "desktop", 2, false],
    ["laptop", WIDTHS.laptop, "desktop", 2, false],
    ["desktop", WIDTHS.desktop, "desktop", 2, false],
  ] as const)(
    "%s (%ipx) → %s layout",
    (_name, width, viewport, columns, stacked) => {
      setViewportWidth(width);
      renderPanel();
      expect(screen.getByTestId("arbiter-action-panel")).toHaveAttribute(
        "data-viewport",
        viewport,
      );
      expect(screen.getByTestId("arbiter-outcome-grid")).toHaveAttribute(
        "data-columns",
        String(columns),
      );
      const actions = screen.getByTestId("arbiter-panel-actions");
      expect(actions).toHaveAttribute("data-stacked", String(stacked));
      expect(actions).toHaveAttribute("data-full-width", String(stacked));
    },
  );

  it("re-lays out live as the window is resized", () => {
    setViewportWidth(WIDTHS.phone);
    renderPanel();
    const panel = screen.getByTestId("arbiter-action-panel");
    expect(panel).toHaveAttribute("data-viewport", "mobile");

    setViewportWidth(WIDTHS.tablet);
    expect(panel).toHaveAttribute("data-viewport", "tablet");

    setViewportWidth(WIDTHS.desktop);
    expect(panel).toHaveAttribute("data-viewport", "desktop");

    setViewportWidth(WIDTHS.phoneSmall);
    expect(panel).toHaveAttribute("data-viewport", "mobile");
    expect(screen.getByTestId("arbiter-outcome-grid")).toHaveAttribute(
      "data-columns",
      "1",
    );
  });

  it("removes its resize listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderPanel();
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    remove.mockRestore();
  });
});

describe("ArbiterActionPanel — mobile-first classes", () => {
  it("stacks the outcome grid on mobile and splits it from sm:", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-grid")).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-2",
    );
  });

  it("stacks actions on mobile and inlines them from sm:", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-panel-actions")).toHaveClass(
      "flex",
      "flex-col",
      "sm:flex-row",
      "sm:justify-end",
    );
  });

  it("gives the submit button a full-width 44px tap target on mobile only", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-submit")).toHaveClass(
      "w-full",
      "min-h-[44px]",
      "sm:w-auto",
      "sm:min-h-0",
    );
  });

  it("keeps outcome options at the 44px minimum tap height", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass("min-h-[44px]");
    expect(screen.getByTestId("arbiter-outcome-refund")).toHaveClass("min-h-[44px]");
  });

  it("lets content shrink instead of overflowing narrow screens", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel")).toHaveClass("w-full", "min-w-0");
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass("min-w-0");
  });

  it("scales type and spacing up at lg:", () => {
    renderPanel();
    expect(screen.getByRole("heading")).toHaveClass("text-sm", "lg:text-base");
    expect(screen.getByTestId("arbiter-action-panel")).toHaveClass("lg:gap-4");
  });

  it("exposes the class strings it renders with", () => {
    renderPanel();
    expect(screen.getByTestId("arbiter-action-panel").className).toContain(
      ARBITER_PANEL_CLASSES.container,
    );
    expect(screen.getByTestId("arbiter-outcome-grid").className).toBe(
      ARBITER_PANEL_CLASSES.outcomeGrid,
    );
  });
});

describe("MilestoneCard — arbiter panel placement", () => {
  const idle = { phase: "idle" as const, error: null, txHash: null };

  it("wraps the card so the panel takes its own full-width row from sm:", () => {
    render(
      <MilestoneCard
        isClient={false}
        isFreelancer={false}
        isArbiter
        milestone={{ index: 0, amount: "100", status: "Disputed" }}
        onResolveDispute={vi.fn()}
        partialReleaseState={idle}
        claimAutoReleaseState={idle}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
      />,
    );
    const card = screen.getByTestId("milestone-card");
    expect(card).toHaveClass("flex-col", "sm:flex-row", "sm:flex-wrap");
    const panel = screen.getByTestId("arbiter-action-panel");
    expect(panel.parentElement).toBe(card);
    expect(panel).toHaveClass("w-full");
  });
});
