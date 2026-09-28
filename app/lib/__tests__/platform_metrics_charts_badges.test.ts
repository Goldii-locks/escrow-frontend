/**
 * platform_metrics_charts_badges — unit tests (#514).
 * Asserts that correct status visual markers render under varying conditions.
 */

import { describe, it, expect } from "vitest";
import {
  METRIC_CHART_BADGES,
  getMetricChartBadge,
  getMetricChartBadgeFromState,
  type MetricChartState,
} from "../platform_metrics_charts_badges";

// =============================================================
// METRIC_CHART_BADGES — static definitions
// =============================================================

describe("METRIC_CHART_BADGES", () => {
  const ALL_STATES: MetricChartState[] = [
    "loading",
    "healthy",
    "degraded",
    "stale",
    "error",
    "empty",
  ];

  it("defines a badge for every MetricChartState", () => {
    for (const state of ALL_STATES) {
      expect(METRIC_CHART_BADGES[state]).toBeDefined();
    }
  });

  it("every badge carries the correct state field", () => {
    for (const state of ALL_STATES) {
      expect(METRIC_CHART_BADGES[state].state).toBe(state);
    }
  });

  it("every badge has a non-empty label", () => {
    for (const state of ALL_STATES) {
      expect(METRIC_CHART_BADGES[state].label.length).toBeGreaterThan(0);
    }
  });

  it("every badge has a non-empty icon", () => {
    for (const state of ALL_STATES) {
      expect(METRIC_CHART_BADGES[state].icon.length).toBeGreaterThan(0);
    }
  });

  it("every badge has a non-empty className", () => {
    for (const state of ALL_STATES) {
      expect(METRIC_CHART_BADGES[state].className.length).toBeGreaterThan(0);
    }
  });

  it("healthy badge uses green colour classes", () => {
    expect(METRIC_CHART_BADGES.healthy.className).toMatch(/green/);
  });

  it("error badge uses red colour classes", () => {
    expect(METRIC_CHART_BADGES.error.className).toMatch(/red/);
  });

  it("degraded badge uses amber colour classes", () => {
    expect(METRIC_CHART_BADGES.degraded.className).toMatch(/amber/);
  });

  it("stale badge uses yellow colour classes", () => {
    expect(METRIC_CHART_BADGES.stale.className).toMatch(/yellow/);
  });

  it("loading badge uses blue colour classes", () => {
    expect(METRIC_CHART_BADGES.loading.className).toMatch(/blue/);
  });

  it("empty badge uses gray colour classes", () => {
    expect(METRIC_CHART_BADGES.empty.className).toMatch(/gray/);
  });

  it("all badges share the base layout classes", () => {
    for (const state of ALL_STATES) {
      const cls = METRIC_CHART_BADGES[state].className;
      expect(cls).toMatch(/inline-flex/);
      expect(cls).toMatch(/rounded-full/);
      expect(cls).toMatch(/text-xs/);
    }
  });
});

// =============================================================
// getMetricChartBadge — string resolver
// =============================================================

describe("getMetricChartBadge", () => {
  it("resolves 'healthy' to the healthy badge", () => {
    const badge = getMetricChartBadge("healthy");
    expect(badge.state).toBe("healthy");
  });

  it("resolves 'error' to the error badge", () => {
    expect(getMetricChartBadge("error").state).toBe("error");
  });

  it("resolves 'degraded' to the degraded badge", () => {
    expect(getMetricChartBadge("degraded").state).toBe("degraded");
  });

  it("resolves 'stale' to the stale badge", () => {
    expect(getMetricChartBadge("stale").state).toBe("stale");
  });

  it("resolves 'loading' to the loading badge", () => {
    expect(getMetricChartBadge("loading").state).toBe("loading");
  });

  it("resolves 'empty' to the empty badge", () => {
    expect(getMetricChartBadge("empty").state).toBe("empty");
  });

  it("is case-insensitive", () => {
    expect(getMetricChartBadge("HEALTHY").state).toBe("healthy");
    expect(getMetricChartBadge("Error").state).toBe("error");
    expect(getMetricChartBadge("LOADING").state).toBe("loading");
  });

  it("trims surrounding whitespace before resolving", () => {
    expect(getMetricChartBadge("  healthy  ").state).toBe("healthy");
  });

  it("maps an unknown state to the empty badge", () => {
    expect(getMetricChartBadge("unknown-state").state).toBe("empty");
  });

  it("maps null to the empty badge", () => {
    expect(getMetricChartBadge(null).state).toBe("empty");
  });

  it("maps undefined to the empty badge", () => {
    expect(getMetricChartBadge(undefined).state).toBe("empty");
  });

  it("maps an empty string to the empty badge", () => {
    expect(getMetricChartBadge("").state).toBe("empty");
  });
});

// =============================================================
// getMetricChartBadgeFromState — structural state resolver (#514)
// Validation check: assert correct status visual markers render
// under varying conditions.
// =============================================================

describe("getMetricChartBadgeFromState", () => {
  it("returns loading badge when isLoading is true (ignores other flags)", () => {
    // loading takes highest priority
    const badge = getMetricChartBadgeFromState({
      isLoading: true,
      isStale: true,
      isDegraded: true,
      hasData: true,
      error: "some error",
    });
    expect(badge.state).toBe("loading");
  });

  it("returns error badge when error is set and not loading", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      hasData: true,
      error: "Network timeout",
    });
    expect(badge.state).toBe("error");
  });

  it("returns degraded badge when isDegraded is true and no error", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      isDegraded: true,
      hasData: true,
      error: null,
    });
    expect(badge.state).toBe("degraded");
  });

  it("returns stale badge when isStale is true and not degraded", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      isStale: true,
      isDegraded: false,
      hasData: true,
      error: null,
    });
    expect(badge.state).toBe("stale");
  });

  it("returns empty badge when there is no data and no error", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      hasData: false,
      error: null,
    });
    expect(badge.state).toBe("empty");
  });

  it("returns healthy badge when data is present with no issues", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      isStale: false,
      isDegraded: false,
      hasData: true,
      error: null,
    });
    expect(badge.state).toBe("healthy");
  });

  it("error takes priority over degraded", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      isDegraded: true,
      hasData: true,
      error: "Partial failure",
    });
    expect(badge.state).toBe("error");
  });

  it("degraded takes priority over stale", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      isStale: true,
      isDegraded: true,
      hasData: true,
      error: null,
    });
    expect(badge.state).toBe("degraded");
  });

  it("returns correct badge className for healthy state (has green classes)", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      hasData: true,
      error: null,
    });
    expect(badge.className).toMatch(/green/);
  });

  it("returns correct badge className for error state (has red classes)", () => {
    const badge = getMetricChartBadgeFromState({
      isLoading: false,
      hasData: true,
      error: "Failed",
    });
    expect(badge.className).toMatch(/red/);
  });

  it("each returned badge object contains state, label, icon and className", () => {
    const states = [
      { isLoading: true, hasData: false, error: null },
      { isLoading: false, hasData: true, error: null },
      { isLoading: false, hasData: false, error: "err" },
      { isLoading: false, hasData: false, error: null },
    ];
    for (const input of states) {
      const badge = getMetricChartBadgeFromState(input);
      expect(badge).toHaveProperty("state");
      expect(badge).toHaveProperty("label");
      expect(badge).toHaveProperty("icon");
      expect(badge).toHaveProperty("className");
    }
  });
});
