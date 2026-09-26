/**
 * platform_metrics_charts_skeleton — unit tests (#511).
 * Verifies that placeholder frames are returned while load queries run and
 * that the empty list is returned once loading finishes.
 */

import { describe, it, expect } from "vitest";
import {
  METRIC_CHART_BAR_FRAMES,
  METRIC_CHART_HEADER_FRAMES,
  METRIC_FILTER_BAR_FRAMES,
  METRIC_STAT_CARD_FRAMES,
  PLATFORM_METRICS_SKELETON_ARIA,
  PLATFORM_METRICS_SKELETON_FRAMES,
  getPlatformMetricsChartSkeleton,
  getPlatformMetricsSkeleton,
} from "../platform_metrics_charts_skeleton";

// =============================================================
// PLATFORM_METRICS_SKELETON_FRAMES
// =============================================================

describe("PLATFORM_METRICS_SKELETON_FRAMES", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(PLATFORM_METRICS_SKELETON_FRAMES)).toBe(true);
    expect(PLATFORM_METRICS_SKELETON_FRAMES.length).toBeGreaterThan(0);
  });

  it("contains all sub-group frames", () => {
    const ids = PLATFORM_METRICS_SKELETON_FRAMES.map((f) => f.id);
    for (const frame of METRIC_FILTER_BAR_FRAMES) {
      expect(ids).toContain(frame.id);
    }
    for (const frame of METRIC_CHART_HEADER_FRAMES) {
      expect(ids).toContain(frame.id);
    }
    for (const frame of METRIC_CHART_BAR_FRAMES) {
      expect(ids).toContain(frame.id);
    }
    for (const frame of METRIC_STAT_CARD_FRAMES) {
      expect(ids).toContain(frame.id);
    }
  });

  it("every frame has a non-empty id, kind, width and height", () => {
    for (const frame of PLATFORM_METRICS_SKELETON_FRAMES) {
      expect(frame.id.length).toBeGreaterThan(0);
      expect(frame.kind.length).toBeGreaterThan(0);
      expect(frame.width.length).toBeGreaterThan(0);
      expect(frame.height.length).toBeGreaterThan(0);
    }
  });

  it("all ids are unique", () => {
    const ids = PLATFORM_METRICS_SKELETON_FRAMES.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("contains at least one frame of each expected kind", () => {
    const kinds = new Set(PLATFORM_METRICS_SKELETON_FRAMES.map((f) => f.kind));
    expect(kinds.has("chart-title")).toBe(true);
    expect(kinds.has("chart-bar")).toBe(true);
    expect(kinds.has("metric-value")).toBe(true);
    expect(kinds.has("metric-label")).toBe(true);
    expect(kinds.has("filter-input")).toBe(true);
    expect(kinds.has("filter-button")).toBe(true);
  });
});

// =============================================================
// getPlatformMetricsSkeleton
// =============================================================

describe("getPlatformMetricsSkeleton", () => {
  it("returns all frames when isLoading is true", () => {
    const frames = getPlatformMetricsSkeleton(true);
    expect(frames).toBe(PLATFORM_METRICS_SKELETON_FRAMES);
    expect(frames.length).toBeGreaterThan(0);
  });

  it("returns an empty array when isLoading is false", () => {
    const frames = getPlatformMetricsSkeleton(false);
    expect(frames).toEqual([]);
    expect(frames.length).toBe(0);
  });

  it("placeholder frames display while load queries run", () => {
    // Validation check from issue #511: placeholder frames must be present
    // during loading and absent once loading completes.
    const duringLoad = getPlatformMetricsSkeleton(true);
    const afterLoad = getPlatformMetricsSkeleton(false);

    expect(duringLoad.length).toBeGreaterThan(0);
    expect(afterLoad.length).toBe(0);
  });
});

// =============================================================
// getPlatformMetricsChartSkeleton
// =============================================================

describe("getPlatformMetricsChartSkeleton", () => {
  it("returns only chart-header and chart-bar frames when loading", () => {
    const frames = getPlatformMetricsChartSkeleton(true);
    for (const frame of frames) {
      expect(["chart-title", "chart-subtitle", "chart-axis", "chart-bar"]).toContain(
        frame.kind,
      );
    }
    expect(frames.length).toBeGreaterThan(0);
  });

  it("returns an empty array when not loading", () => {
    expect(getPlatformMetricsChartSkeleton(false)).toEqual([]);
  });

  it("does not include filter or stat frames", () => {
    const frames = getPlatformMetricsChartSkeleton(true);
    for (const frame of frames) {
      expect(frame.kind).not.toBe("filter-input");
      expect(frame.kind).not.toBe("filter-button");
      expect(frame.kind).not.toBe("metric-value");
      expect(frame.kind).not.toBe("metric-label");
    }
  });
});

// =============================================================
// PLATFORM_METRICS_SKELETON_ARIA
// =============================================================

describe("PLATFORM_METRICS_SKELETON_ARIA", () => {
  it("has role status", () => {
    expect(PLATFORM_METRICS_SKELETON_ARIA.role).toBe("status");
  });

  it("has aria-busy true", () => {
    expect(PLATFORM_METRICS_SKELETON_ARIA["aria-busy"]).toBe(true);
  });

  it("has a non-empty aria-label", () => {
    expect(
      typeof PLATFORM_METRICS_SKELETON_ARIA["aria-label"],
    ).toBe("string");
    expect(PLATFORM_METRICS_SKELETON_ARIA["aria-label"].length).toBeGreaterThan(
      0,
    );
  });
});

// =============================================================
// Sub-group frame arrays
// =============================================================

describe("METRIC_CHART_HEADER_FRAMES", () => {
  it("contains a chart-title frame", () => {
    const titleFrame = METRIC_CHART_HEADER_FRAMES.find(
      (f) => f.kind === "chart-title",
    );
    expect(titleFrame).toBeDefined();
  });

  it("contains a chart-subtitle frame", () => {
    const subtitleFrame = METRIC_CHART_HEADER_FRAMES.find(
      (f) => f.kind === "chart-subtitle",
    );
    expect(subtitleFrame).toBeDefined();
  });
});

describe("METRIC_CHART_BAR_FRAMES", () => {
  it("contains multiple chart-bar frames", () => {
    const bars = METRIC_CHART_BAR_FRAMES.filter((f) => f.kind === "chart-bar");
    expect(bars.length).toBeGreaterThanOrEqual(4);
  });
});

describe("METRIC_FILTER_BAR_FRAMES", () => {
  it("includes a filter-input frame", () => {
    const inputFrame = METRIC_FILTER_BAR_FRAMES.find(
      (f) => f.kind === "filter-input",
    );
    expect(inputFrame).toBeDefined();
  });

  it("includes a filter-button frame", () => {
    const btnFrame = METRIC_FILTER_BAR_FRAMES.find(
      (f) => f.kind === "filter-button",
    );
    expect(btnFrame).toBeDefined();
  });
});

describe("METRIC_STAT_CARD_FRAMES", () => {
  it("contains metric-value and metric-label pairs", () => {
    const values = METRIC_STAT_CARD_FRAMES.filter(
      (f) => f.kind === "metric-value",
    );
    const labels = METRIC_STAT_CARD_FRAMES.filter(
      (f) => f.kind === "metric-label",
    );
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(values.length).toBe(labels.length);
  });
});
