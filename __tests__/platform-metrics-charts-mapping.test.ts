import { describe, expect, it } from "vitest";
import {
  MOCK_PLATFORM_METRICS_DATA,
  PLATFORM_METRICS_ENDPOINT,
  fetchPlatformMetrics,
  mapBackendToPlatformMetrics,
} from "@/app/lib/platform_metrics_charts_mapping";

describe("platform_metrics_charts mapping", () => {
  it("MOCK_PLATFORM_METRICS_DATA has the required shape", () => {
    expect(MOCK_PLATFORM_METRICS_DATA).toHaveProperty("metrics");
    expect(MOCK_PLATFORM_METRICS_DATA).toHaveProperty("lastUpdated");
    expect(MOCK_PLATFORM_METRICS_DATA).toHaveProperty("period");
    expect(Array.isArray(MOCK_PLATFORM_METRICS_DATA.metrics)).toBe(true);
    expect(MOCK_PLATFORM_METRICS_DATA.metrics.length).toBeGreaterThan(0);
  });

  it("MOCK_PLATFORM_METRICS_DATA metrics have the required fields", () => {
    for (const m of MOCK_PLATFORM_METRICS_DATA.metrics) {
      expect(m).toHaveProperty("id");
      expect(m).toHaveProperty("label");
      expect(m).toHaveProperty("value");
      expect(m).toHaveProperty("change");
      expect(m).toHaveProperty("unit");
      expect(typeof m.id).toBe("string");
      expect(typeof m.label).toBe("string");
      expect(typeof m.value).toBe("number");
      expect(typeof m.change).toBe("number");
      expect(typeof m.unit).toBe("string");
    }
  });

  it("mapBackendToPlatformMetrics correctly maps raw backend data", () => {
    const raw = {
      metrics: [
        { id: "escrows", label: "Escrows", value: 10, change: 2.5, unit: "count" },
      ],
      last_updated: "2026-01-01T00:00:00Z",
      period: "last_7_days",
    };
    const result = mapBackendToPlatformMetrics(raw);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].id).toBe("escrows");
    expect(result.metrics[0].label).toBe("Escrows");
    expect(result.metrics[0].value).toBe(10);
    expect(result.metrics[0].change).toBe(2.5);
    expect(result.metrics[0].unit).toBe("count");
    expect(result.lastUpdated).toBe("2026-01-01T00:00:00Z");
    expect(result.period).toBe("last_7_days");
  });

  it("mapBackendToPlatformMetrics falls back to mock metrics when metrics is missing", () => {
    const result = mapBackendToPlatformMetrics({});
    expect(result.metrics).toEqual(MOCK_PLATFORM_METRICS_DATA.metrics);
  });

  it("mapBackendToPlatformMetrics handles null metric fields gracefully", () => {
    const raw = {
      metrics: [{ id: null, label: null, value: null, change: null, unit: null }],
      last_updated: null,
      period: null,
    };
    const result = mapBackendToPlatformMetrics(raw);
    expect(result.metrics[0].id).toBe("metric_0");
    expect(result.metrics[0].value).toBe(0);
    expect(result.metrics[0].change).toBe(0);
    expect(result.period).toBe("last_30_days");
  });

  it("fetchPlatformMetrics calls the injected fetcher and returns PlatformMetricsData shape", async () => {
    let calledUrl = "";
    const mockRaw = {
      metrics: [{ id: "test", label: "Test", value: 5, change: 1, unit: "%" }],
      last_updated: "2026-06-01T00:00:00Z",
      period: "last_30_days",
    };
    const result = await fetchPlatformMetrics(PLATFORM_METRICS_ENDPOINT, async (url) => {
      calledUrl = url;
      return mockRaw;
    });
    expect(calledUrl).toBe(PLATFORM_METRICS_ENDPOINT);
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("lastUpdated");
    expect(result).toHaveProperty("period");
    expect(result.metrics[0].id).toBe("test");
  });

  it("fetchPlatformMetrics uses the mock dataset by default", async () => {
    const result = await fetchPlatformMetrics(PLATFORM_METRICS_ENDPOINT);
    expect(result.metrics).toEqual(MOCK_PLATFORM_METRICS_DATA.metrics);
  });
});
