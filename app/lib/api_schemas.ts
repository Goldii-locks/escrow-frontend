/**
 * api_schemas — Runtime Zod schemas for every backend response shape.
 *
 * Previously the app cast raw JSON to hand-written TypeScript types and then
 * probed them with `isObject` / `normalizeJob` guards.  When the backend
 * shape changed, those checks silently produced empty or partial objects so
 * the UI rendered a job with no milestones rather than an error (issue #678).
 *
 * This module is the single source of truth for the expected envelope from
 * every `/api/…` endpoint.  Every API helper must call `safeParse` (or
 * `parse`) against the appropriate schema and, on failure, throw
 * `ApiShapeError` so callers can show "Unexpected response from server" rather
 * than rendering partial data.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------

/**
 * Thrown when a backend response does not match the expected Zod schema.
 * Callers should treat this as a non-retryable error and surface it to the
 * user as "Unexpected response from server".
 */
export class ApiShapeError extends Error {
  /** The Zod validation error that triggered this. */
  readonly cause: z.ZodError;

  constructor(endpoint: string, zodError: z.ZodError) {
    super(
      `Unexpected response from server at ${endpoint}: ${zodError.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
    this.name = "ApiShapeError";
    this.cause = zodError;
  }
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A Stellar public key (G…) or an empty string (wallet not yet connected). */
const stellarAddress = z.string();

const optionalStellarAddress = stellarAddress.optional();

// ---------------------------------------------------------------------------
// Milestone schema
// ---------------------------------------------------------------------------

export const MilestoneSchema = z.object({
  index: z.number().int().nonnegative(),
  amount: z.string(),
  status: z.string(),
  releasedAmount: z.string().optional(),
  deliveredAt: z.number().int().nonnegative().nullish(),
  autoReleaseSeconds: z.number().int().nonnegative().nullish(),
  extensionSeconds: z.number().int().nonnegative().nullish(),
  /** Whether this milestone has been funded (only meaningful for per-milestone funding). */
  funded: z.boolean().default(false).optional(),
  /** On-chain due timestamp (epoch seconds or ms) for reclaim-overdue eligibility. */
  dueAt: z.union([z.number(), z.string()]).nullish().optional(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

// ---------------------------------------------------------------------------
// Job schema
// ---------------------------------------------------------------------------

export const JobSchema = z.object({
  id: z.string().min(1),
  client: stellarAddress.default(""),
  freelancer: stellarAddress.default(""),
  arbiter: stellarAddress.default(""),
  admin: optionalStellarAddress,
  funded: z.boolean().default(false),
  milestones: z.array(MilestoneSchema).nullish(),
  autoReleaseSeconds: z.number().int().nonnegative().nullish(),
  token: z.string().optional(),
  tokenSymbol: z.string().optional(),
  tokenDecimals: z.number().finite().optional(),
  // Pause / lock state fields (#896).
  // paused.admin: true when the platform admin called admin_pause_escrow.
  // paused.emergency: true when both parties agreed to an emergency pause.
  // cancelLocked: true when both parties signed a mutual cancel and the
  //   escrow is waiting for the admin to settle.
  pausedByAdmin: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  pausedByEmergency: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  cancelLocked: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  /** How the escrow is funded: "Upfront" (job-level) or "PerMilestone". */
  fundingMode: z
    .union([z.literal("Upfront"), z.literal("PerMilestone")])
    .nullish()
    .transform((v) => v ?? undefined),
  /** Funding timestamp (epoch ms) for withdraw_unaccepted eligibility. */
  fundedAt: z.union([z.number(), z.string()]).nullish().optional(),
  /** Number of milestones accepted (released) so far. */
  acceptedCount: z.number().int().nonnegative().nullish().optional(),
  // By-wallet summary fields shown on the dashboard rows (#638). The backend
  // may send null for unknown values, which is treated as absent.
  role: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  milestoneCount: z
    .number()
    .finite()
    .nullish()
    .transform((v) => v ?? undefined),
  releasedCount: z
    .number()
    .finite()
    .nullish()
    .transform((v) => v ?? undefined),
  latestEventType: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  latestEventAt: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => v ?? undefined),
  latestLedger: z
    .number()
    .finite()
    .nullish()
    .transform((v) => v ?? undefined),
});

export type Job = z.infer<typeof JobSchema>;

// ---------------------------------------------------------------------------
// Paginated jobs list response (GET /api/jobs/by-wallet/:address)
// ---------------------------------------------------------------------------

/**
 * One row of the by-wallet job list, exactly as `escrow-backend`'s
 * `getJobsByWallet` returns it (`src/indexer/db.ts` `JobSummary`). The
 * backend wraps the whole page in `sendSuccess(res, { jobs, total, page, limit })`,
 * so the row field names are snake_case and intentionally minimal: the list
 * carries only what the indexer can derive from events (contract id, the
 * caller's role, milestone count and the latest event's type/ledger/time).
 *
 * The full job state (client, freelancer, arbiter, token, funded, milestones)
 * comes from the per-contract detail endpoint (`GET /api/jobs/:contractId`),
 * which is fetched separately when a row is expanded. Keeping the list shape
 * strict means a renamed backend field fails the contract test instead of
 * silently dropping the row from the dashboard.
 */
export const JobSummarySchema = z.object({
  contract_id: z.string().min(1),
  role: z.enum(["client", "freelancer", "arbiter", "unknown"]),
  milestone_count: z.number().int().nonnegative(),
  latest_event_type: z.string(),
  latest_ledger: z.number().int(),
  latest_timestamp: z.number().int().nullable(),
});

export type JobSummary = z.infer<typeof JobSummarySchema>;

/**
 * Exact body of `GET /api/jobs/by-wallet/:address`. The backend wraps the
 * page with `sendSuccess(res, PaginatedJobs)` →
 * `{ success: true, data: { jobs, total, page, limit } }`, and errors with the
 * standard `{ success: false, error }` envelope (`sendError`).
 */
export const JobListResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.object({
      jobs: z.array(z.unknown()),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
    }),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type JobListResponse = z.infer<typeof JobListResponseSchema>;

// ---------------------------------------------------------------------------
// Single-job detail response
// ---------------------------------------------------------------------------

export const JobDetailResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
  data: z.unknown().optional(),
});

export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>;

// ---------------------------------------------------------------------------
// Whitelist response
// ---------------------------------------------------------------------------

export const WhitelistTokenSchema = z.object({
  address: z.string().min(1),
  symbol: z.string().optional(),
  name: z.string().optional(),
  decimals: z.number().finite().optional(),
});

export type WhitelistToken = z.infer<typeof WhitelistTokenSchema>;

/**
 * Exact body of `GET /api/jobs/:contractId/whitelist` (the backend's
 * `sendSuccess`): `{ success: true, data: { tokens: [...] } }` (#618).
 */
export const WhitelistResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    tokens: z.array(z.unknown()),
  }),
});

export type WhitelistResponse = z.infer<typeof WhitelistResponseSchema>;

// ---------------------------------------------------------------------------
// Admin response
// ---------------------------------------------------------------------------

/**
 * Exact body of `POST /api/jobs/query` for the contract's read-only
 * `get_escrow_state` view (#599): the backend's standard envelope around
 * `{ contractId, method, result }`, where `result` is the decoded
 * `EscrowState`. Only `admin` is read here; the rest of the state passes
 * through untouched.
 */
export const AdminResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    result: z
      .object({
        admin: z.string().regex(/^G[A-Z2-7]{55}$/, "admin must be a Stellar account (G...)"),
      })
      .passthrough(),
  }),
});

export type AdminResponse = z.infer<typeof AdminResponseSchema>;

// ---------------------------------------------------------------------------
// Escrow state response (#895)
// ---------------------------------------------------------------------------

/**
 * Full body of `POST /api/jobs/query` for `get_escrow_state`, reading the
 * job sub-object so the dashboard can render milestones when the indexer is
 * behind or unreachable.
 *
 * The contract returns milestones as an array of `{ index, amount, status,
 * releasedAmount? }` objects, which matches `MilestoneSchema`. Addresses and
 * token fields may be absent in older contract versions so they are optional.
 */
export const EscrowStateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    result: z.object({
      admin: z.string().optional(),
      job: z
        .object({
          client: z.string().optional(),
          freelancer: z.string().optional(),
          arbiter: z.string().optional(),
          funded: z.boolean().optional(),
          token: z.string().optional(),
          tokenSymbol: z.string().optional(),
          tokenDecimals: z.number().finite().optional(),
          milestones: z.array(MilestoneSchema).optional(),
        })
        .passthrough(),
    }),
  }),
});

export type EscrowStateResponse = z.infer<typeof EscrowStateResponseSchema>;

// ---------------------------------------------------------------------------
// Auto-release response
// ---------------------------------------------------------------------------

export const AutoReleaseResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    secondsRemaining: z.number().int().nonnegative(),
  }),
});

export type AutoReleaseResponse = z.infer<typeof AutoReleaseResponseSchema>;

// ---------------------------------------------------------------------------
// Helper: validate and throw ApiShapeError on failure
// ---------------------------------------------------------------------------

/**
 * Validates `data` against `schema`.  Throws `ApiShapeError` if validation
 * fails, so callers can surface it as "Unexpected response from server".
 *
 * @example
 * const validated = validateResponse(JobListResponseSchema, rawJson, '/api/jobs/by-wallet/…');
 */
export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, endpoint: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiShapeError(endpoint, result.error);
  }
  return result.data;
}
