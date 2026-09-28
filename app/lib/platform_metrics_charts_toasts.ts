/**
 * platform_metrics_charts — action toast messages (#516).
 */

export interface PlatformMetricsToastConfig {
  message: string;
  type: "success" | "error" | "warning";
}

export const PLATFORM_METRICS_TOASTS: Record<string, PlatformMetricsToastConfig> = {
  EXPORT_SUCCESS: {
    message: "Platform metrics exported successfully",
    type: "success",
  },
  EXPORT_ERROR: {
    message: "Failed to export platform metrics",
    type: "error",
  },
  LOAD_ERROR: {
    message: "Failed to load platform metrics data",
    type: "error",
  },
  ACCESS_DENIED: {
    message: "Access restricted: only admins and platform owners can view platform metrics",
    type: "error",
  },
  DATA_REFRESHED: {
    message: "Platform metrics data refreshed",
    type: "success",
  },
};

/** Return the toast config for the given key, or a generic error toast if not found. */
export function getPlatformMetricsToast(key: string): PlatformMetricsToastConfig {
  return (
    PLATFORM_METRICS_TOASTS[key] ?? {
      message: `Unknown metrics event: ${key}`,
      type: "error",
    }
  );
}
