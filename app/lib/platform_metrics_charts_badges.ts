/**
 * platform_metrics_charts — state badges (#514).
 * Distinct colour and status badge elements for the platform metrics portal
 * based on active data states (loading, healthy, degraded, stale, error, empty).
 * Kept free of React so every rule can be asserted directly in tests.
 */

// =============================================================
// Types
// =============================================================

export type MetricChartState =
  | "loading"
  | "healthy"
  | "degraded"
  | "stale"
  | "error"
  | "empty";

export interface MetricChartBadge {
  state: MetricChartState;
  label: string;
  /** Leading marker so state is not conveyed by colour alone. */
  icon: string;
  /** Full Tailwind class string for the badge element. */
  className: string;
}

// =============================================================
// Badge definitions
// =============================================================

const BADGE_BASE =
  "inline-flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium";

export const METRIC_CHART_BADGES: Record<MetricChartState, MetricChartBadge> =
  {
    loading: {
      state: "loading",
      label: "Loading",
      icon: "…",
      className: `${BADGE_BASE} border-blue-700 bg-blue-950/40 text-blue-400`,
    },
    healthy: {
      state: "healthy",
      label: "Healthy",
      icon: "●",
      className: `${BADGE_BASE} border-green-700 bg-green-950/40 text-green-400`,
    },
    degraded: {
      state: "degraded",
      label: "Degraded",
      icon: "▲",
      className: `${BADGE_BASE} border-amber-700 bg-amber-950/40 text-amber-400`,
    },
    stale: {
      state: "stale",
      label: "Stale",
      icon: "◌",
      className: `${BADGE_BASE} border-yellow-700 bg-yellow-950/40 text-yellow-400`,
    },
    error: {
      state: "error",
      label: "Error",
      icon: "!",
      className: `${BADGE_BASE} border-red-700 bg-red-950/40 text-red-400`,
    },
    empty: {
      state: "empty",
      label: "No Data",
      icon: "○",
      className: `${BADGE_BASE} border-gray-600 bg-gray-800 text-gray-400`,
    },
  };

// =============================================================
// Selector helpers
// =============================================================

/**
 * Resolve the badge for a metric chart state.
 * Unknown or nullish values map to `"empty"`.
 */
export function getMetricChartBadge(
  state: string | null | undefined,
): MetricChartBadge {
  const key = (state ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(METRIC_CHART_BADGES, key)
    ? METRIC_CHART_BADGES[key as MetricChartState]
    : METRIC_CHART_BADGES.empty;
}

/**
 * Derive the chart badge from a richer fetch-state shape, matching the
 * pattern used by `getTokenStatusBadge` in `admin_whitelist_panel.ts`.
 */
export function getMetricChartBadgeFromState(state: {
  isLoading: boolean;
  isStale?: boolean;
  isDegraded?: boolean;
  hasData: boolean;
  error: string | null;
}): MetricChartBadge {
  if (state.isLoading) return METRIC_CHART_BADGES.loading;
  if (state.error) return METRIC_CHART_BADGES.error;
  if (state.isDegraded) return METRIC_CHART_BADGES.degraded;
  if (state.isStale) return METRIC_CHART_BADGES.stale;
  if (!state.hasData) return METRIC_CHART_BADGES.empty;
  return METRIC_CHART_BADGES.healthy;
}
