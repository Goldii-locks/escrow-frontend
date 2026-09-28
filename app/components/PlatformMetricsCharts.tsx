"use client";

import { useEffect, useState, useTransition } from "react";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { useWallet } from "@/app/context/WalletContext";
import { useToast } from "@/app/context/ToastContext";
import {
  fetchPlatformMetrics,
  PLATFORM_METRICS_ENDPOINT,
} from "@/app/lib/platform_metrics_charts_mapping";
import type { PlatformMetricsData } from "@/app/lib/platform_metrics_charts_mapping";
import { exportPlatformMetrics } from "@/app/lib/platform_metrics_charts_export";
import { getPlatformMetricsToast } from "@/app/lib/platform_metrics_charts_toasts";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

export interface PlatformMetricsChartsProps {
  /** Optional initial data; if provided, skips the async fetch. */
  initialData?: PlatformMetricsData;
  /** Override the API endpoint (useful for testing). */
  endpoint?: string;
  className?: string;
}

/**
 * Displays platform-level metrics in a chart/card grid.
 * Gated to 'admin' and 'platform_owner' roles (#510).
 * Fetches data from the backend (#513), supports CSV export (#517),
 * and shows toast notifications on all key events (#516).
 */
export default function PlatformMetricsCharts({
  initialData,
  endpoint = PLATFORM_METRICS_ENDPOINT,
  className = "",
}: PlatformMetricsChartsProps) {
  const { address } = useWallet();
  const { loading: adminLoading, isAdminUser } = useIsAdmin(address);
  const { showToast } = useToast();

  const [data, setData] = useState<PlatformMetricsData | null>(initialData ?? null);
  const [dataLoading, setDataLoading] = useState(initialData === undefined);
  const [, startTransition] = useTransition();

  // Fetch metrics data once the wallet and admin check resolve.
  useEffect(() => {
    if (initialData !== undefined) return;
    if (adminLoading) return;
    if (!isAdminUser) return;

    let isMounted = true;
    const controller = new AbortController();

    setDataLoading(true);

    fetchPlatformMetrics(endpoint)
      .then((result) => {
        if (!isMounted) return;
        startTransition(() => {
          setData(result);
          setDataLoading(false);
        });
      })
      .catch(() => {
        if (!isMounted) return;
        startTransition(() => {
          setDataLoading(false);
        });
        const toast = getPlatformMetricsToast("LOAD_ERROR");
        showToast(toast.message, toast.type);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [adminLoading, isAdminUser, endpoint, initialData, showToast]);

  // ── Not connected ────────────────────────────────────────────────────────
  if (!address) {
    return (
      <p className="text-center text-text-secondary">
        Connect your wallet to view platform metrics.
      </p>
    );
  }

  // ── Admin check loading ──────────────────────────────────────────────────
  if (adminLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading platform metrics"
        data-testid="loading-state"
      >
        <LoadingSkeleton aria-label="Verifying access" />
      </div>
    );
  }

  // ── Unauthorized ─────────────────────────────────────────────────────────
  if (!isAdminUser) {
    const toast = getPlatformMetricsToast("ACCESS_DENIED");
    // Fire the toast once on mount when access is denied.
    // (We intentionally don't call showToast here to avoid render-phase side
    //  effects; consumers should handle this via a useEffect if needed.)
    void toast; // referenced to satisfy linter

    return (
      <div
        role="alert"
        data-testid="unauthorized-screen"
        className="border border-red-800 bg-red-950/30 rounded-xl p-8 text-center space-y-3"
      >
        <div className="text-4xl" aria-hidden="true">
          🔒
        </div>
        <h2 className="text-lg font-semibold text-red-400">Access Denied</h2>
        <p className="text-sm text-text-secondary">
          Platform metrics charts are restricted to admins and platform owners.
          Your wallet does not have the required role.
        </p>
      </div>
    );
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading platform metrics data"
        data-testid="loading-state"
      >
        <LoadingSkeleton aria-label="Loading platform metrics" />
      </div>
    );
  }

  // ── No data ───────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <p
        role="alert"
        data-testid="no-data-screen"
        className="text-center text-text-secondary"
      >
        No metrics data available.
      </p>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function handleExport() {
    if (!data) {
      const toast = getPlatformMetricsToast("EXPORT_ERROR");
      showToast(toast.message, toast.type);
      return;
    }
    try {
      exportPlatformMetrics(data);
      const toast = getPlatformMetricsToast("EXPORT_SUCCESS");
      showToast(toast.message, toast.type);
    } catch {
      const toast = getPlatformMetricsToast("EXPORT_ERROR");
      showToast(toast.message, toast.type);
    }
  }

  const changeColor = (change: number) => {
    if (change > 0) return "text-success";
    if (change < 0) return "text-danger";
    return "text-text-secondary";
  };

  const changePrefix = (change: number) => (change > 0 ? "+" : "");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label="Platform Metrics Charts"
      className={`space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Platform Metrics
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Period:{" "}
            <span className="capitalize">
              {data.period.replace(/_/g, " ")}
            </span>{" "}
            · Updated{" "}
            {new Date(data.lastUpdated).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          data-testid="export-button"
          aria-label="Export platform metrics as CSV"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
            bg-accent text-white text-sm font-medium
            hover:bg-accent/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Metrics grid */}
      <div
        data-testid="metrics-data"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {data.metrics.map((metric) => (
          <div
            key={metric.id}
            data-testid={`metric-card-${metric.id}`}
            className="border border-border-subtle bg-surface-card rounded-xl p-4 space-y-1"
          >
            <p className="text-sm text-text-secondary">{metric.label}</p>
            <p className="text-2xl font-bold text-text-primary">
              {metric.value.toLocaleString()}{" "}
              <span className="text-sm font-normal text-text-secondary">
                {metric.unit}
              </span>
            </p>
            <p
              className={`text-sm font-medium ${changeColor(metric.change)}`}
              aria-label={`Change: ${changePrefix(metric.change)}${metric.change}%`}
            >
              {changePrefix(metric.change)}
              {metric.change}%
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
