"use client";

import { useState, useCallback } from "react";
import {
  getPlatformMetricsSkeleton,
  PLATFORM_METRICS_SKELETON_ARIA,
  type MetricSkeletonFrame,
} from "@/app/lib/platform_metrics_charts_skeleton";
import {
  metricsContainsCodeTags,
  sanitizeMetricsDateRange,
  sanitizeMetricsFilter,
  sanitizeMetricsThreshold,
} from "@/app/lib/platform_metrics_charts_sanitize";
import {
  getMetricChartBadgeFromState,
  type MetricChartBadge,
  type MetricChartState,
} from "@/app/lib/platform_metrics_charts_badges";
import {
  buildMetricsConfirmModal,
  canSubmitMetricsAction,
  nextMetricsConfirmStep,
  validateMetricsThreshold,
  type MetricsAction,
  type MetricsConfirmModal,
  type MetricsConfirmStep,
} from "@/app/lib/platform_metrics_charts_modals";

// =============================================================
// Types
// =============================================================

export interface MetricDataPoint {
  label: string;
  value: number;
}

export interface PlatformMetricsChartsProps {
  /** Chart data points. An empty array renders the "empty" badge state. */
  data?: MetricDataPoint[];
  /** True while the parent is fetching metrics. Shows the loading skeleton. */
  isLoading?: boolean;
  /** Set when the last fetch failed. Renders the error badge state. */
  error?: string | null;
  /** True when the displayed data may be stale (background refresh pending). */
  isStale?: boolean;
  /** True when the data source is reporting degraded quality. */
  isDegraded?: boolean;
  /** Called when the user confirms a CSV export action. */
  onExport?: (dateRange: string) => void;
  /** Called when the user confirms a data refresh. */
  onRefresh?: () => void;
  /** Called when the user confirms applying a threshold. */
  onApplyThreshold?: (threshold: string) => void;
  /** Called when the user confirms resetting all filters. */
  onResetFilters?: () => void;
  "data-testid"?: string;
}

// =============================================================
// Sub-components (file-local)
// =============================================================

/** Skeleton placeholder rendered while data is loading (#511). */
function PlatformMetricsSkeleton({
  frames,
}: {
  frames: readonly MetricSkeletonFrame[];
}) {
  const barFrames = frames.filter((f) => f.kind === "chart-bar");
  const headerFrames = frames.filter(
    (f) => f.kind === "chart-title" || f.kind === "chart-subtitle",
  );
  const statFrames = frames.filter(
    (f) => f.kind === "metric-value" || f.kind === "metric-label",
  );
  const filterFrames = frames.filter(
    (f) => f.kind === "filter-input" || f.kind === "filter-button",
  );

  return (
    <div
      {...PLATFORM_METRICS_SKELETON_ARIA}
      data-testid="platform-metrics-skeleton"
      className="animate-pulse space-y-6 motion-reduce:animate-none"
    >
      <span className="sr-only">Loading platform metrics…</span>

      {/* Filter bar skeleton */}
      {filterFrames.length > 0 && (
        <div
          data-testid="platform-metrics-skeleton-filters"
          className="flex gap-3"
        >
          {filterFrames.map((f) => (
            <div
              key={f.id}
              data-testid={`platform-metrics-skeleton-frame-${f.id}`}
              className="rounded-lg bg-gray-700/50"
              style={{ width: f.width, height: f.height }}
            />
          ))}
        </div>
      )}

      {/* Chart card skeleton */}
      <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
        {/* Header lines */}
        {headerFrames.map((f) => (
          <div
            key={f.id}
            data-testid={`platform-metrics-skeleton-frame-${f.id}`}
            className="rounded bg-gray-700/60"
            style={{ width: f.width, height: f.height }}
          />
        ))}

        {/* Bar chart body */}
        {barFrames.length > 0 && (
          <div
            data-testid="platform-metrics-skeleton-bars"
            className="flex items-end gap-2 pt-4"
            style={{ height: "120px" }}
          >
            {barFrames.map((f) => (
              <div
                key={f.id}
                data-testid={`platform-metrics-skeleton-frame-${f.id}`}
                className="rounded-t bg-gray-700/40"
                style={{ width: f.width, height: f.height }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stat cards skeleton */}
      {statFrames.length > 0 && (
        <div
          data-testid="platform-metrics-skeleton-stats"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[0, 1, 2].map((cardIdx) => {
            const valueFrame = statFrames[cardIdx * 2];
            const labelFrame = statFrames[cardIdx * 2 + 1];
            return (
              <div
                key={cardIdx}
                className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                {valueFrame && (
                  <div
                    data-testid={`platform-metrics-skeleton-frame-${valueFrame.id}`}
                    className="rounded bg-gray-700/60"
                    style={{
                      width: valueFrame.width,
                      height: valueFrame.height,
                    }}
                  />
                )}
                {labelFrame && (
                  <div
                    data-testid={`platform-metrics-skeleton-frame-${labelFrame.id}`}
                    className="rounded bg-gray-700/40"
                    style={{
                      width: labelFrame.width,
                      height: labelFrame.height,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Status badge rendered in the chart header (#514). */
function MetricsBadge({
  badge,
  testId,
}: {
  badge: MetricChartBadge;
  testId: string;
}) {
  return (
    <span
      data-testid={testId}
      data-status={badge.state}
      className={badge.className}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {badge.label}
    </span>
  );
}

/** Bar chart rendered from MetricDataPoint[] without an external lib. */
function BarChart({
  data,
  testId,
}: {
  data: MetricDataPoint[];
  testId: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div
      data-testid={testId}
      role="img"
      aria-label="Platform metrics bar chart"
      className="flex items-end gap-1 overflow-x-auto"
      style={{ height: "120px" }}
    >
      {data.map((point, i) => {
        const heightPct = Math.round((point.value / max) * 100);
        return (
          <div
            key={i}
            data-testid={`platform-metrics-bar-${i}`}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span className="text-xs text-gray-400">{point.value}</span>
            <div
              className="w-full rounded-t bg-indigo-500"
              style={{ height: `${heightPct}%` }}
              title={`${point.label}: ${point.value}`}
            />
            <span
              className="truncate text-[10px] text-gray-500"
              style={{ maxWidth: "48px" }}
            >
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Double-confirm modal for destructive / signed actions (#515). */
function MetricsConfirmModalDialog({
  modal,
  onCancel,
  onConfirm,
  testId,
}: {
  modal: MetricsConfirmModal;
  onCancel: () => void;
  onConfirm: () => void;
  testId: string;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="metrics-confirm-title"
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
        <h2
          id="metrics-confirm-title"
          data-testid="platform-metrics-confirm-title"
          className="text-lg font-semibold"
        >
          {modal.title}
        </h2>
        <p
          data-testid="platform-metrics-confirm-message"
          className="text-sm text-gray-400"
        >
          {modal.message}
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            data-testid="platform-metrics-confirm-checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>I understand and want to proceed.</span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            data-testid="platform-metrics-confirm-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition"
          >
            {modal.cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!acknowledged}
            data-testid="platform-metrics-confirm-submit"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition"
          >
            {modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Main component
// =============================================================

/**
 * PlatformMetricsCharts — active system stats graphing layout.
 *
 * Integrates four features:
 *   #511 — loading skeleton displayed while queries run
 *   #512 — input sanitization on all filter/date-range/threshold fields
 *   #514 — state badges (loading, healthy, degraded, stale, error, empty)
 *   #515 — double-confirm action modals before any signed/destructive action
 */
export default function PlatformMetricsCharts({
  data = [],
  isLoading = false,
  error = null,
  isStale = false,
  isDegraded = false,
  onExport,
  onRefresh,
  onApplyThreshold,
  onResetFilters,
  "data-testid": testId = "platform-metrics-charts",
}: PlatformMetricsChartsProps) {
  // ── Filter form state (#512) ──────────────────────────────────────────────
  const [dateRange, setDateRange] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const [threshold, setThreshold] = useState("");
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  // ── Confirm modal state (#515) ────────────────────────────────────────────
  const [pendingAction, setPendingAction] = useState<MetricsAction | null>(
    null,
  );
  const [confirmStep, setConfirmStep] =
    useState<MetricsConfirmStep>("idle");

  // ── Skeleton frames (#511) ────────────────────────────────────────────────
  const skeletonFrames = getPlatformMetricsSkeleton(isLoading);

  // ── Badge (#514) ──────────────────────────────────────────────────────────
  const badge = getMetricChartBadgeFromState({
    isLoading,
    isStale,
    isDegraded,
    hasData: data.length > 0,
    error,
  });

  // ── Sanitized change handlers (#512) ─────────────────────────────────────
  const handleDateRangeChange = useCallback((raw: string) => {
    if (metricsContainsCodeTags(raw)) return;
    setDateRange(sanitizeMetricsDateRange(raw));
  }, []);

  const handleFilterKeyChange = useCallback((raw: string) => {
    if (metricsContainsCodeTags(raw)) return;
    setFilterKey(sanitizeMetricsFilter(raw));
  }, []);

  const handleThresholdChange = useCallback((raw: string) => {
    if (metricsContainsCodeTags(raw)) return;
    setThreshold(sanitizeMetricsThreshold(raw));
    setThresholdError(null);
  }, []);

  // ── Action request handlers — open modal first (#515) ─────────────────────
  const requestAction = useCallback((action: MetricsAction) => {
    setPendingAction(action);
    setConfirmStep((s) => nextMetricsConfirmStep(s, "submit"));
  }, []);

  const handleExportRequest = useCallback(() => {
    requestAction("export_csv");
  }, [requestAction]);

  const handleRefreshRequest = useCallback(() => {
    requestAction("refresh_data");
  }, [requestAction]);

  const handleResetRequest = useCallback(() => {
    requestAction("reset_filters");
  }, [requestAction]);

  const handleThresholdRequest = useCallback(() => {
    const validationError = validateMetricsThreshold(threshold);
    if (validationError) {
      setThresholdError(validationError);
      return;
    }
    requestAction("apply_threshold");
  }, [threshold, requestAction]);

  // ── Modal confirm / cancel (#515) ─────────────────────────────────────────
  const handleModalCancel = useCallback(() => {
    setConfirmStep((s) => nextMetricsConfirmStep(s, "cancel"));
    setPendingAction(null);
  }, []);

  const handleModalConfirm = useCallback(() => {
    const next = nextMetricsConfirmStep(confirmStep, "confirm");
    setConfirmStep(next);

    if (canSubmitMetricsAction(next) && pendingAction) {
      switch (pendingAction) {
        case "export_csv":
          onExport?.(dateRange);
          break;
        case "refresh_data":
          onRefresh?.();
          break;
        case "reset_filters":
          setDateRange("");
          setFilterKey("");
          setThreshold("");
          setThresholdError(null);
          onResetFilters?.();
          break;
        case "apply_threshold":
          onApplyThreshold?.(threshold);
          break;
      }
      setPendingAction(null);
      setConfirmStep("idle");
    }
  }, [
    confirmStep,
    pendingAction,
    dateRange,
    threshold,
    onExport,
    onRefresh,
    onResetFilters,
    onApplyThreshold,
  ]);

  // ── Derived modal copy ────────────────────────────────────────────────────
  const activeModal =
    pendingAction && confirmStep === "confirming"
      ? buildMetricsConfirmModal(pendingAction, {
          dateRange: dateRange || undefined,
          threshold: threshold || undefined,
        })
      : null;

  // ── Render ────────────────────────────────────────────────────────────────

  // Show full skeleton while loading (#511)
  if (isLoading && skeletonFrames.length > 0) {
    return <PlatformMetricsSkeleton frames={skeletonFrames} />;
  }

  return (
    <div data-testid={testId} className="space-y-6">
      {/* ── Filter bar (#512) ──────────────────────────────────────────── */}
      <div
        data-testid="platform-metrics-filter-bar"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="metrics-date-range"
            className="text-xs text-gray-400"
          >
            Date range
          </label>
          <input
            id="metrics-date-range"
            type="text"
            value={dateRange}
            placeholder="YYYY-MM-DD"
            data-testid="platform-metrics-date-range-input"
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="metrics-filter" className="text-xs text-gray-400">
            Metric filter
          </label>
          <input
            id="metrics-filter"
            type="text"
            value={filterKey}
            placeholder="e.g. escrow_count"
            data-testid="platform-metrics-filter-input"
            onChange={(e) => handleFilterKeyChange(e.target.value)}
            className="h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="metrics-threshold"
            className="text-xs text-gray-400"
          >
            Threshold
          </label>
          <input
            id="metrics-threshold"
            type="text"
            value={threshold}
            placeholder="e.g. 100"
            data-testid="platform-metrics-threshold-input"
            aria-invalid={thresholdError ? "true" : "false"}
            aria-describedby={
              thresholdError ? "metrics-threshold-error" : undefined
            }
            onChange={(e) => handleThresholdChange(e.target.value)}
            className="h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm focus:outline-none focus:border-indigo-500"
          />
          {thresholdError && (
            <p
              id="metrics-threshold-error"
              data-testid="platform-metrics-threshold-error"
              role="alert"
              className="text-xs text-red-400"
            >
              {thresholdError}
            </p>
          )}
        </div>

        <div className="flex gap-2 pb-0 sm:mt-auto">
          <button
            type="button"
            onClick={handleThresholdRequest}
            data-testid="platform-metrics-apply-threshold-btn"
            className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleExportRequest}
            data-testid="platform-metrics-export-btn"
            className="min-h-[44px] rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600 transition"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleRefreshRequest}
            data-testid="platform-metrics-refresh-btn"
            className="min-h-[44px] rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600 transition"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleResetRequest}
            data-testid="platform-metrics-reset-btn"
            className="min-h-[44px] rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700 transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Chart card with badge (#514) ───────────────────────────────── */}
      <div
        data-testid="platform-metrics-chart-card"
        className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              data-testid="platform-metrics-chart-title"
              className="text-base font-semibold"
            >
              Platform Metrics
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Active system statistics
            </p>
          </div>
          <MetricsBadge
            badge={badge}
            testId="platform-metrics-status-badge"
          />
        </div>

        {error && (
          <div
            data-testid="platform-metrics-error-banner"
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-700 bg-red-950/30 px-4 py-3 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        {data.length === 0 && !error ? (
          <p
            data-testid="platform-metrics-empty-state"
            className="py-8 text-center text-sm text-gray-500"
          >
            No metrics data available.
          </p>
        ) : (
          <BarChart data={data} testId="platform-metrics-bar-chart" />
        )}
      </div>

      {/* ── Stat summary cards ─────────────────────────────────────────── */}
      {data.length > 0 && (
        <div
          data-testid="platform-metrics-stat-cards"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            {
              label: "Total",
              value: data.reduce((s, d) => s + d.value, 0),
              testId: "platform-metrics-stat-total",
            },
            {
              label: "Average",
              value: Math.round(
                data.reduce((s, d) => s + d.value, 0) / data.length,
              ),
              testId: "platform-metrics-stat-average",
            },
            {
              label: "Peak",
              value: Math.max(...data.map((d) => d.value)),
              testId: "platform-metrics-stat-peak",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              data-testid={stat.testId}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Double-confirm modal (#515) ────────────────────────────────── */}
      {activeModal && (
        <MetricsConfirmModalDialog
          key={pendingAction ?? "modal"}
          modal={activeModal}
          onCancel={handleModalCancel}
          onConfirm={handleModalConfirm}
          testId="platform-metrics-confirm-modal"
        />
      )}
    </div>
  );
}
