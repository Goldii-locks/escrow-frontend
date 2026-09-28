/**
 * platform_metrics_charts — data mapping bindings (#513).
 * Maps backend platform metrics payloads to component-ready data structures.
 */

export interface PlatformMetric {
  id: string;
  label: string;
  value: number;
  change: number;
  unit: string;
}

export interface PlatformMetricsData {
  metrics: PlatformMetric[];
  lastUpdated: string;
  period: string;
}

/** Raw backend shape — all fields optional/nullable for safety. */
export interface PlatformMetricsResponse {
  metrics?: Array<{
    id?: string | null;
    label?: string | null;
    value?: number | string | null;
    change?: number | string | null;
    unit?: string | null;
  }> | null;
  last_updated?: string | null;
  period?: string | null;
}

export const PLATFORM_METRICS_ENDPOINT = "/api/admin/platform-metrics";

export const MOCK_PLATFORM_METRICS_DATA: PlatformMetricsData = {
  metrics: [
    { id: "total_escrows", label: "Total Escrows", value: 142, change: 12.5, unit: "count" },
    { id: "active_escrows", label: "Active Escrows", value: 38, change: -3.2, unit: "count" },
    { id: "total_volume", label: "Total Volume", value: 524800, change: 7.8, unit: "XLM" },
    { id: "avg_milestone_value", label: "Avg Milestone Value", value: 1200, change: 2.1, unit: "XLM" },
    { id: "dispute_rate", label: "Dispute Rate", value: 1.4, change: -0.3, unit: "%" },
    { id: "completion_rate", label: "Completion Rate", value: 94.7, change: 1.6, unit: "%" },
  ],
  lastUpdated: "2026-09-28T11:55:19.232Z",
  period: "last_30_days",
};

/** Map a single raw metric object to a typed PlatformMetric. */
function mapRawMetric(
  raw: NonNullable<PlatformMetricsResponse["metrics"]>[number],
  index: number,
): PlatformMetric {
  return {
    id: String(raw.id ?? `metric_${index}`),
    label: String(raw.label ?? `Metric ${index + 1}`),
    value: Number(raw.value ?? 0),
    change: Number(raw.change ?? 0),
    unit: String(raw.unit ?? ""),
  };
}

/** Map a backend payload to the component's PlatformMetricsData shape. */
export function mapBackendToPlatformMetrics(
  raw: Record<string, unknown>,
): PlatformMetricsData {
  const typed = raw as PlatformMetricsResponse;

  const metrics = Array.isArray(typed.metrics)
    ? typed.metrics.map(mapRawMetric)
    : MOCK_PLATFORM_METRICS_DATA.metrics;

  return {
    metrics,
    lastUpdated: String(typed.last_updated ?? new Date().toISOString()),
    period: String(typed.period ?? "last_30_days"),
  };
}

/** Load metrics via an injectable fetcher (defaults to the mock dataset). */
export async function fetchPlatformMetrics(
  endpoint: string,
  fetcher: (url: string) => Promise<Record<string, unknown>> = async () =>
    MOCK_PLATFORM_METRICS_DATA as unknown as Record<string, unknown>,
): Promise<PlatformMetricsData> {
  const raw = await fetcher(endpoint);
  return mapBackendToPlatformMetrics(raw);
}
