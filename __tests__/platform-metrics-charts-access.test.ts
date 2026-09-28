import { describe, expect, it } from "vitest";
import {
  checkPlatformMetricsAccess,
  PLATFORM_METRICS_UNAUTHORIZED_WARNING,
  PLATFORM_METRICS_ACCESS_CONFIG,
} from "@/app/lib/platform_metrics_charts_access";

describe("platform_metrics_charts access", () => {
  it("allows the admin role", () => {
    expect(checkPlatformMetricsAccess("admin")).toBe(true);
  });

  it("allows the platform_owner role", () => {
    expect(checkPlatformMetricsAccess("platform_owner")).toBe(true);
  });

  it("blocks the freelancer role", () => {
    expect(checkPlatformMetricsAccess("freelancer")).toBe(false);
  });

  it("blocks the client role", () => {
    expect(checkPlatformMetricsAccess("client")).toBe(false);
  });

  it("blocks an empty string role", () => {
    expect(checkPlatformMetricsAccess("")).toBe(false);
  });

  it("blocks an unknown role", () => {
    expect(checkPlatformMetricsAccess("viewer")).toBe(false);
  });

  it("exposes an unauthorized warning message", () => {
    expect(PLATFORM_METRICS_UNAUTHORIZED_WARNING).toBeTypeOf("string");
    expect(PLATFORM_METRICS_UNAUTHORIZED_WARNING.length).toBeGreaterThan(0);
  });

  it("config lists exactly admin and platform_owner as authorized roles", () => {
    expect(PLATFORM_METRICS_ACCESS_CONFIG.authorizedRoles).toContain("admin");
    expect(PLATFORM_METRICS_ACCESS_CONFIG.authorizedRoles).toContain("platform_owner");
    expect(PLATFORM_METRICS_ACCESS_CONFIG.authorizedRoles).toHaveLength(2);
  });
});
