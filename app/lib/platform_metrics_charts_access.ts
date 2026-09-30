/**
 * platform_metrics_charts — access restriction helpers (#510).
 * Decides whether the platform metrics charts may render for a given role.
 */

export interface PlatformMetricsAccessConfig {
  /** Roles that are permitted to view platform metrics charts. */
  authorizedRoles: string[];
  /** Warning shown to unauthorized users. */
  unauthorizedWarning: string;
}

export const PLATFORM_METRICS_ACCESS_CONFIG: PlatformMetricsAccessConfig = {
  authorizedRoles: ["admin", "platform_owner"],
  unauthorizedWarning:
    "Access restricted: only admins and platform owners can view platform metrics charts.",
};

export const PLATFORM_METRICS_UNAUTHORIZED_WARNING =
  PLATFORM_METRICS_ACCESS_CONFIG.unauthorizedWarning;

/**
 * Returns true when the given role is permitted to view platform metrics charts.
 * Authorized roles: 'admin', 'platform_owner'.
 */
export function checkPlatformMetricsAccess(role: string): boolean {
  return PLATFORM_METRICS_ACCESS_CONFIG.authorizedRoles.includes(role);
}
