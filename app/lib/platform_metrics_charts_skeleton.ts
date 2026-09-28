/**
 * platform_metrics_charts — loading skeleton descriptors (#511).
 * Placeholder wireframe frames shown while metrics data queries run.
 */

// =============================================================
// Skeleton frame descriptors
// =============================================================

export type MetricSkeletonFrameKind =
  | "chart-title"
  | "chart-subtitle"
  | "chart-bar"
  | "chart-axis"
  | "metric-value"
  | "metric-label"
  | "filter-input"
  | "filter-button";

export interface MetricSkeletonFrame {
  id: string;
  kind: MetricSkeletonFrameKind;
  width: string;
  height: string;
}

/** Frames that mirror the chart header (title + subtitle). */
export const METRIC_CHART_HEADER_FRAMES: readonly MetricSkeletonFrame[] = [
  { id: "chart-title",    kind: "chart-title",    width: "45%",  height: "20px" },
  { id: "chart-subtitle", kind: "chart-subtitle", width: "30%",  height: "14px" },
];

/** Frames that mirror a bar-chart body (axis line + bars). */
export const METRIC_CHART_BAR_FRAMES: readonly MetricSkeletonFrame[] = [
  { id: "bar-axis",  kind: "chart-axis", width: "100%", height: "2px"  },
  { id: "bar-col-1", kind: "chart-bar",  width: "10%",  height: "60%"  },
  { id: "bar-col-2", kind: "chart-bar",  width: "10%",  height: "80%"  },
  { id: "bar-col-3", kind: "chart-bar",  width: "10%",  height: "50%"  },
  { id: "bar-col-4", kind: "chart-bar",  width: "10%",  height: "90%"  },
  { id: "bar-col-5", kind: "chart-bar",  width: "10%",  height: "70%"  },
  { id: "bar-col-6", kind: "chart-bar",  width: "10%",  height: "40%"  },
];

/** Frames for the summary metric stat cards below the chart. */
export const METRIC_STAT_CARD_FRAMES: readonly MetricSkeletonFrame[] = [
  { id: "stat-value-1", kind: "metric-value", width: "50%",  height: "28px" },
  { id: "stat-label-1", kind: "metric-label", width: "70%",  height: "14px" },
  { id: "stat-value-2", kind: "metric-value", width: "50%",  height: "28px" },
  { id: "stat-label-2", kind: "metric-label", width: "70%",  height: "14px" },
  { id: "stat-value-3", kind: "metric-value", width: "50%",  height: "28px" },
  { id: "stat-label-3", kind: "metric-label", width: "70%",  height: "14px" },
];

/** Frames for the filter bar above the chart. */
export const METRIC_FILTER_BAR_FRAMES: readonly MetricSkeletonFrame[] = [
  { id: "filter-input",  kind: "filter-input",  width: "180px", height: "36px" },
  { id: "filter-button", kind: "filter-button", width: "80px",  height: "36px" },
];

/** All frames for the full platform metrics panel, ordered top-to-bottom. */
export const PLATFORM_METRICS_SKELETON_FRAMES: readonly MetricSkeletonFrame[] = [
  ...METRIC_FILTER_BAR_FRAMES,
  ...METRIC_CHART_HEADER_FRAMES,
  ...METRIC_CHART_BAR_FRAMES,
  ...METRIC_STAT_CARD_FRAMES,
];

// =============================================================
// Selector helper
// =============================================================

/**
 * Returns the full set of skeleton frames when `isLoading` is true, or an
 * empty list once loading has finished — matching the pattern in
 * `admin_fee_configuration_skeleton.ts`.
 */
export function getPlatformMetricsSkeleton(
  isLoading: boolean,
): readonly MetricSkeletonFrame[] {
  return isLoading ? PLATFORM_METRICS_SKELETON_FRAMES : [];
}

/**
 * Returns only the chart-body frames (header + bars) — useful when the filter
 * bar and stat cards have already populated but chart data is still pending.
 */
export function getPlatformMetricsChartSkeleton(
  isLoading: boolean,
): readonly MetricSkeletonFrame[] {
  return isLoading
    ? [...METRIC_CHART_HEADER_FRAMES, ...METRIC_CHART_BAR_FRAMES]
    : [];
}

// =============================================================
// Accessibility attributes
// =============================================================

export const PLATFORM_METRICS_SKELETON_ARIA = {
  role: "status",
  "aria-busy": true,
  "aria-label": "Loading platform metrics",
} as const;
