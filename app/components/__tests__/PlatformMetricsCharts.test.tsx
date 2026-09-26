/**
 * PlatformMetricsCharts — component tests (#511, #512, #514, #515).
 *
 * #511 — Verify placeholder frames display while load queries run.
 * #512 — Assert form ignores input containing code tags.
 * #514 — Assert correct status visual markers render under varying conditions.
 * #515 — Confirm submit is blocked until confirmation dialog triggers.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PlatformMetricsCharts from "../PlatformMetricsCharts";

// =============================================================
// Helpers
// =============================================================

const SAMPLE_DATA = [
  { label: "Jan", value: 40 },
  { label: "Feb", value: 80 },
  { label: "Mar", value: 60 },
];

// =============================================================
// #511 — Loading skeletons
// =============================================================

describe("PlatformMetricsCharts – loading skeleton (#511)", () => {
  it("renders the skeleton when isLoading is true", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(screen.getByTestId("platform-metrics-skeleton")).toBeInTheDocument();
  });

  it("skeleton has role=status for accessibility", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("skeleton has aria-busy=true", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(screen.getByTestId("platform-metrics-skeleton")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("skeleton has a screen-reader label", () => {
    render(<PlatformMetricsCharts isLoading />);
    const srText = screen
      .getByTestId("platform-metrics-skeleton")
      .querySelector(".sr-only");
    expect(srText).not.toBeNull();
    expect(srText!.textContent).toMatch(/loading/i);
  });

  it("renders the filter-bar skeleton section", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(
      screen.getByTestId("platform-metrics-skeleton-filters"),
    ).toBeInTheDocument();
  });

  it("renders the bar skeleton section", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(
      screen.getByTestId("platform-metrics-skeleton-bars"),
    ).toBeInTheDocument();
  });

  it("renders the stat-cards skeleton section", () => {
    render(<PlatformMetricsCharts isLoading />);
    expect(
      screen.getByTestId("platform-metrics-skeleton-stats"),
    ).toBeInTheDocument();
  });

  it("does not render the real chart when loading", () => {
    render(<PlatformMetricsCharts isLoading data={SAMPLE_DATA} />);
    expect(
      screen.queryByTestId("platform-metrics-charts"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("platform-metrics-bar-chart"),
    ).not.toBeInTheDocument();
  });

  it("renders the real chart once isLoading becomes false", () => {
    render(<PlatformMetricsCharts isLoading={false} data={SAMPLE_DATA} />);
    expect(screen.queryByTestId("platform-metrics-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("platform-metrics-charts")).toBeInTheDocument();
  });

  it("individual skeleton frame elements are rendered during loading", () => {
    render(<PlatformMetricsCharts isLoading />);
    // At least one bar frame should appear
    const barFrames = screen.getAllByTestId(
      /^platform-metrics-skeleton-frame-bar-col/,
    );
    expect(barFrames.length).toBeGreaterThan(0);
  });
});

// =============================================================
// #512 — Input sanitization
// =============================================================

describe("PlatformMetricsCharts – input sanitization (#512)", () => {
  it("ignores code-tag input in the date-range field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-date-range-input");
    fireEvent.change(input, { target: { value: "<script>alert(1)</script>" } });
    // Value must not update — the handler drops code-tag inputs
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("ignores javascript: URI in the date-range field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-date-range-input");
    fireEvent.change(input, { target: { value: "javascript:void(0)" } });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("accepts a valid ISO date string in the date-range field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-date-range-input");
    fireEvent.change(input, { target: { value: "2026-09-26" } });
    expect((input as HTMLInputElement).value).toBe("2026-09-26");
  });

  it("ignores code-tag input in the filter field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-filter-input");
    fireEvent.change(input, { target: { value: "<b>filter</b>" } });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("accepts a valid filter key in the filter field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-filter-input");
    fireEvent.change(input, { target: { value: "escrow_count" } });
    expect((input as HTMLInputElement).value).toBe("escrow_count");
  });

  it("ignores code-tag input in the threshold field — validation check #512", () => {
    // Issue #512: assert form ignores input containing code tags
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-threshold-input");
    fireEvent.change(input, { target: { value: "<script>100</script>" } });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("ignores html angle brackets in the threshold field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-threshold-input");
    fireEvent.change(input, { target: { value: "<100>" } });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("accepts a valid numeric threshold", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-threshold-input");
    fireEvent.change(input, { target: { value: "150" } });
    expect((input as HTMLInputElement).value).toBe("150");
  });

  it("strips non-numeric characters from the threshold field", () => {
    render(<PlatformMetricsCharts />);
    const input = screen.getByTestId("platform-metrics-threshold-input");
    fireEvent.change(input, { target: { value: "100abc" } });
    expect((input as HTMLInputElement).value).toBe("100");
  });
});

// =============================================================
// #514 — State badges
// =============================================================

describe("PlatformMetricsCharts – state badges (#514)", () => {
  it("shows the loading badge when isLoading is true (via skeleton, badge not visible)", () => {
    // When loading the skeleton renders instead of the badge
    render(<PlatformMetricsCharts isLoading />);
    expect(screen.queryByTestId("platform-metrics-status-badge")).not.toBeInTheDocument();
  });

  it("shows healthy badge when data is present and no issues", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status", "healthy");
    expect(badge).toHaveTextContent(/healthy/i);
  });

  it("shows error badge when error prop is set", () => {
    render(
      <PlatformMetricsCharts data={SAMPLE_DATA} error="Network timeout" />,
    );
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status", "error");
    expect(badge).toHaveTextContent(/error/i);
  });

  it("shows degraded badge when isDegraded is true", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} isDegraded />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status", "degraded");
    expect(badge).toHaveTextContent(/degraded/i);
  });

  it("shows stale badge when isStale is true and not degraded", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} isStale />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status", "stale");
    expect(badge).toHaveTextContent(/stale/i);
  });

  it("shows empty badge when no data and no error", () => {
    render(<PlatformMetricsCharts data={[]} />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status", "empty");
    expect(badge).toHaveTextContent(/no data/i);
  });

  it("badge has data-status attribute for testability — validation check #514", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    expect(badge).toHaveAttribute("data-status");
  });

  it("badge icon is aria-hidden to not convey state by symbol alone", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const badge = screen.getByTestId("platform-metrics-status-badge");
    const icon = badge.querySelector("[aria-hidden='true']");
    expect(icon).not.toBeNull();
  });

  it("error takes priority over degraded when both are set", () => {
    render(
      <PlatformMetricsCharts
        data={SAMPLE_DATA}
        isDegraded
        error="Partial failure"
      />,
    );
    expect(screen.getByTestId("platform-metrics-status-badge")).toHaveAttribute(
      "data-status",
      "error",
    );
  });

  it("degraded takes priority over stale when both are set", () => {
    render(
      <PlatformMetricsCharts data={SAMPLE_DATA} isDegraded isStale />,
    );
    expect(screen.getByTestId("platform-metrics-status-badge")).toHaveAttribute(
      "data-status",
      "degraded",
    );
  });
});

// =============================================================
// #515 — Validation / confirmation modals
// =============================================================

describe("PlatformMetricsCharts – confirmation modals (#515)", () => {
  it("confirmation modal is not visible initially", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(
      screen.queryByTestId("platform-metrics-confirm-modal"),
    ).not.toBeInTheDocument();
  });

  it("clicking Export CSV opens the confirm modal", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    expect(
      screen.getByTestId("platform-metrics-confirm-modal"),
    ).toBeInTheDocument();
  });

  it("clicking Refresh opens the confirm modal", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-refresh-btn"));
    expect(
      screen.getByTestId("platform-metrics-confirm-modal"),
    ).toBeInTheDocument();
  });

  it("clicking Reset opens the confirm modal", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-reset-btn"));
    expect(
      screen.getByTestId("platform-metrics-confirm-modal"),
    ).toBeInTheDocument();
  });

  it("modal has role=dialog for accessibility", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("modal has aria-modal=true", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("confirm button is disabled until checkbox is ticked — validation check #515", () => {
    // Issue #515: submit is blocked until confirmation dialog triggers
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    const confirmBtn = screen.getByTestId("platform-metrics-confirm-submit");
    expect(confirmBtn).toBeDisabled();
  });

  it("confirm button becomes enabled after ticking the checkbox", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-checkbox"));
    expect(screen.getByTestId("platform-metrics-confirm-submit")).not.toBeDisabled();
  });

  it("cancel button closes the modal without firing the callback", () => {
    const onExport = vi.fn();
    render(<PlatformMetricsCharts data={SAMPLE_DATA} onExport={onExport} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-cancel"));
    expect(
      screen.queryByTestId("platform-metrics-confirm-modal"),
    ).not.toBeInTheDocument();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("confirming the dialog fires the export callback", () => {
    const onExport = vi.fn();
    render(<PlatformMetricsCharts data={SAMPLE_DATA} onExport={onExport} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-checkbox"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-submit"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("confirming the dialog closes the modal", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-checkbox"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-submit"));
    expect(
      screen.queryByTestId("platform-metrics-confirm-modal"),
    ).not.toBeInTheDocument();
  });

  it("confirming refresh fires the onRefresh callback", () => {
    const onRefresh = vi.fn();
    render(<PlatformMetricsCharts data={SAMPLE_DATA} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("platform-metrics-refresh-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-checkbox"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-submit"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("confirming reset fires the onResetFilters callback", () => {
    const onResetFilters = vi.fn();
    render(
      <PlatformMetricsCharts
        data={SAMPLE_DATA}
        onResetFilters={onResetFilters}
      />,
    );
    fireEvent.click(screen.getByTestId("platform-metrics-reset-btn"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-checkbox"));
    fireEvent.click(screen.getByTestId("platform-metrics-confirm-submit"));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("Apply threshold shows a validation error for an empty threshold without opening modal", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    // Threshold input is empty by default
    fireEvent.click(screen.getByTestId("platform-metrics-apply-threshold-btn"));
    expect(
      screen.getByTestId("platform-metrics-threshold-error"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("platform-metrics-confirm-modal"),
    ).not.toBeInTheDocument();
  });

  it("Apply threshold opens modal when threshold is valid", () => {
    const onApplyThreshold = vi.fn();
    render(
      <PlatformMetricsCharts
        data={SAMPLE_DATA}
        onApplyThreshold={onApplyThreshold}
      />,
    );
    const thresholdInput = screen.getByTestId(
      "platform-metrics-threshold-input",
    );
    fireEvent.change(thresholdInput, { target: { value: "200" } });
    fireEvent.click(screen.getByTestId("platform-metrics-apply-threshold-btn"));
    expect(
      screen.getByTestId("platform-metrics-confirm-modal"),
    ).toBeInTheDocument();
    // Callback not yet fired (dialog not confirmed)
    expect(onApplyThreshold).not.toHaveBeenCalled();
  });

  it("modal displays the action title", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    fireEvent.click(screen.getByTestId("platform-metrics-export-btn"));
    expect(
      screen.getByTestId("platform-metrics-confirm-title"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-metrics-confirm-title").textContent,
    ).toMatch(/.+/);
  });
});

// =============================================================
// General rendering
// =============================================================

describe("PlatformMetricsCharts – general rendering", () => {
  it("renders the root element with default data-testid", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(screen.getByTestId("platform-metrics-charts")).toBeInTheDocument();
  });

  it("accepts a custom data-testid", () => {
    render(
      <PlatformMetricsCharts
        data={SAMPLE_DATA}
        data-testid="my-custom-metrics"
      />,
    );
    expect(screen.getByTestId("my-custom-metrics")).toBeInTheDocument();
  });

  it("renders the bar chart when data is provided", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(screen.getByTestId("platform-metrics-bar-chart")).toBeInTheDocument();
  });

  it("renders one bar per data point", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const bars = screen.getAllByTestId(/^platform-metrics-bar-\d+$/);
    expect(bars.length).toBe(SAMPLE_DATA.length);
  });

  it("shows the empty state when data is empty", () => {
    render(<PlatformMetricsCharts data={[]} />);
    expect(
      screen.getByTestId("platform-metrics-empty-state"),
    ).toBeInTheDocument();
  });

  it("shows the error banner when error is set", () => {
    render(<PlatformMetricsCharts data={[]} error="Failed to load" />);
    expect(
      screen.getByTestId("platform-metrics-error-banner"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-metrics-error-banner")).toHaveTextContent(
      "Failed to load",
    );
  });

  it("renders stat cards when data is provided", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(
      screen.getByTestId("platform-metrics-stat-cards"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-metrics-stat-total")).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-metrics-stat-average"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("platform-metrics-stat-peak")).toBeInTheDocument();
  });

  it("total stat value equals the sum of data values", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const total = SAMPLE_DATA.reduce((s, d) => s + d.value, 0);
    expect(screen.getByTestId("platform-metrics-stat-total")).toHaveTextContent(
      String(total),
    );
  });

  it("peak stat value equals the max data value", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    const peak = Math.max(...SAMPLE_DATA.map((d) => d.value));
    expect(screen.getByTestId("platform-metrics-stat-peak")).toHaveTextContent(
      String(peak),
    );
  });

  it("renders the chart title", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(
      screen.getByTestId("platform-metrics-chart-title"),
    ).toBeInTheDocument();
  });

  it("renders the filter bar", () => {
    render(<PlatformMetricsCharts data={SAMPLE_DATA} />);
    expect(
      screen.getByTestId("platform-metrics-filter-bar"),
    ).toBeInTheDocument();
  });

  it("does not render stat cards when data is empty", () => {
    render(<PlatformMetricsCharts data={[]} />);
    expect(
      screen.queryByTestId("platform-metrics-stat-cards"),
    ).not.toBeInTheDocument();
  });
});
