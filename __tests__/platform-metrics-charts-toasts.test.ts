import { describe, expect, it } from "vitest";
import {
  getPlatformMetricsToast,
  PLATFORM_METRICS_TOASTS,
} from "@/app/lib/platform_metrics_charts_toasts";

describe("platform_metrics_charts toasts", () => {
  it("PLATFORM_METRICS_TOASTS has all required keys", () => {
    const requiredKeys = [
      "EXPORT_SUCCESS",
      "EXPORT_ERROR",
      "LOAD_ERROR",
      "ACCESS_DENIED",
      "DATA_REFRESHED",
    ];
    for (const key of requiredKeys) {
      expect(PLATFORM_METRICS_TOASTS).toHaveProperty(key);
    }
  });

  it("getPlatformMetricsToast returns correct config for EXPORT_SUCCESS", () => {
    const t = getPlatformMetricsToast("EXPORT_SUCCESS");
    expect(t.type).toBe("success");
    expect(t.message).toBeTypeOf("string");
    expect(t.message.length).toBeGreaterThan(0);
  });

  it("getPlatformMetricsToast returns correct config for EXPORT_ERROR", () => {
    const t = getPlatformMetricsToast("EXPORT_ERROR");
    expect(t.type).toBe("error");
    expect(t.message).toBeTypeOf("string");
  });

  it("getPlatformMetricsToast returns correct config for LOAD_ERROR", () => {
    const t = getPlatformMetricsToast("LOAD_ERROR");
    expect(t.type).toBe("error");
    expect(t.message).toBeTypeOf("string");
  });

  it("getPlatformMetricsToast returns correct config for ACCESS_DENIED", () => {
    const t = getPlatformMetricsToast("ACCESS_DENIED");
    expect(t.type).toBe("error");
    expect(t.message).toBeTypeOf("string");
  });

  it("getPlatformMetricsToast returns correct config for DATA_REFRESHED", () => {
    const t = getPlatformMetricsToast("DATA_REFRESHED");
    expect(t.type).toBe("success");
    expect(t.message).toBeTypeOf("string");
  });

  it("toast types are correctly typed as success, error, or warning", () => {
    const validTypes = ["success", "error", "warning"];
    for (const [, config] of Object.entries(PLATFORM_METRICS_TOASTS)) {
      expect(validTypes).toContain(config.type);
    }
  });

  it("getPlatformMetricsToast returns an error toast for unknown keys", () => {
    const t = getPlatformMetricsToast("NONEXISTENT_KEY");
    expect(t.type).toBe("error");
    expect(t.message).toContain("NONEXISTENT_KEY");
  });
});
