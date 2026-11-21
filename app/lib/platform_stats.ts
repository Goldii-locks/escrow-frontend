/**
 * platform_stats: schema and fetcher for the public platform statistics
 * endpoint (`GET /api/stats`) exposed by escrow-backend (issue #852).
 */
import { z } from "zod";
import { BACKEND_URL } from "@/app/lib/config";
import { validateResponse } from "@/app/lib/api_schemas";

const amount = z.union([z.string(), z.number()]).transform((v) => Number(v));

export const PlatformStatsSchema = z.object({
  jobsCreated: z.number(),
  totalEscrowed: amount,
  totalReleased: amount,
  totalRefunded: amount,
  disputeRate: z.number(),
  medianResolutionHours: z.number().nullable().optional(),
  jobsPerWeek: z.array(z.object({ week: z.string(), count: z.number() })).default([]),
  valueByToken: z.array(z.object({ token: z.string(), value: amount })).default([]),
  disputeOutcomes: z.array(z.object({ outcome: z.string(), count: z.number() })).default([]),
});

export type PlatformStats = z.infer<typeof PlatformStatsSchema>;

export function isStatsEmpty(s: PlatformStats): boolean {
  return s.jobsCreated === 0 && s.jobsPerWeek.length === 0 && s.valueByToken.length === 0;
}

export async function fetchPlatformStats(signal?: AbortSignal): Promise<PlatformStats> {
  const res = await fetch(`${BACKEND_URL}/api/stats`, { signal });
  if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
  const body = await res.json();
  const payload = body && typeof body === "object" && "data" in body ? body.data : body;
  return validateResponse(PlatformStatsSchema, payload, "/api/stats");
}
