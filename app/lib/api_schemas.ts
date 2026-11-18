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

import { describe, expect, it } from "vitest";

import {
  ApiShapeError,
  NotificationPreferencesResponseSchema,
  NotificationSubscribeResponseSchema,
  NotificationUnsubscribeResponseSchema,
  validateResponse,
} from "../api_schemas";

describe("notification preference schemas (#906)", () => {
  it("accepts a fully populated preferences payload", () => {
    const parsed = validateResponse(
      NotificationPreferencesResponseSchema,
      {
        success: true,
        data: {
          email: "user@example.com",
          confirmed: true,
          preferences: {
            client: ["delivery", "approval"],
            freelancer: ["deadline_approaching", "funds_credited"],
            arbiter: ["dispute"],
          },
        },
      },
      "/api/notifications/preferences"
    );

    expect(parsed.data.email).toBe("user@example.com");
    expect(parsed.data.confirmed).toBe(true);
    expect(parsed.data.preferences.client).toEqual(["delivery", "approval"]);
    expect(parsed.data.preferences.arbiter).toEqual(["dispute"]);
  });

  it("treats a missing email as not opted in and defaults the rest", () => {
    const parsed = validateResponse(
      NotificationPreferencesResponseSchema,
      { success: true, data: { email: null } },
      "/api/notifications/preferences"
    );

    expect(parsed.data.email).toBeNull();
    expect(parsed.data.confirmed).toBe(false);
    expect(parsed.data.preferences).toEqual({});
  });

  it("rejects an unknown notification event", () => {
    expect(() =>
      validateResponse(
        NotificationPreferencesResponseSchema,
        {
          success: true,
          data: {
            email: "user@example.com",
            confirmed: false,
            preferences: { client: ["not_a_real_event"] },
          },
        },
        "/api/notifications/preferences"
      )
    ).toThrow(ApiShapeError);
  });

  it("rejects a payload without the success envelope", () => {
    expect(() =>
      validateResponse(
        NotificationPreferencesResponseSchema,
        { data: { email: "user@example.com" } },
        "/api/notifications/preferences"
      )
    ).toThrow(ApiShapeError);
  });

  it("parses the subscribe (confirmation-pending) response", () => {
    const parsed = validateResponse(
      NotificationSubscribeResponseSchema,
      { success: true, data: { email: "user@example.com", confirmed: false } },
      "/api/notifications/subscribe"
    );

    expect(parsed.data.email).toBe("user@example.com");
    expect(parsed.data.confirmed).toBe(false);
  });

  it("parses the unsubscribe response", () => {
    const parsed = validateResponse(
      NotificationUnsubscribeResponseSchema,
      { success: true, data: { unsubscribed: true } },
      "/api/notifications/unsubscribe"
    );

    expect(parsed.data.unsubscribed).toBe(true);
  });

  it("rejects an unsubscribe response missing the flag", () => {
    expect(() =>
      validateResponse(
        NotificationUnsubscribeResponseSchema,
        { success: true, data: {} },
        "/api/notifications/unsubscribe"
      )
    ).toThrow(ApiShapeError);
  });
});

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
  token: z.string().optional(),
  tokenSymbol: z.string().optional(),
  tokenDecimals: z.number().finite().optional(),
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
// Paginated jobs list response
// ---------------------------------------------------------------------------

const PaginationSchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
});

/**
 * The backend returns jobs in one of several envelope shapes.  We capture all
 * known variants and normalise them in `parseJobListResponse`.
 */
export const JobListResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
  data: z
    .union([
      z.array(z.unknown()),
      z.object({
        jobs: z.array(z.unknown()).optional(),
        items: z.array(z.unknown()).optional(),
        id: z.string().optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        totalItems: z.number().optional(),
      }),
    ])
    .optional(),
  pagination: PaginationSchema.optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  totalItems: z.number().optional(),
});

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
// Auto-release response
// ---------------------------------------------------------------------------

export const AutoReleaseResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      deadline: z.union([z.number(), z.string()]).optional(),
      autoReleaseAt: z.union([z.number(), z.string()]).optional(),
      secondsRemaining: z.number().optional(),
      eligible: z.boolean().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type AutoReleaseResponse = z.infer<typeof AutoReleaseResponseSchema>;

// ---------------------------------------------------------------------------
// Notification preferences (#906)
// ---------------------------------------------------------------------------

/**
 * The notification events a user can opt into, per role.  Kept as a Zod enum
 * so an unknown event from the backend is a shape error rather than a silent
 * no-op toggle.
 */
export const NotificationEventSchema = z.enum([
  "delivery",
  "approval",
  "dispute",
  "deadline_approaching",
  "funds_credited",
]);

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

/** The roles a user can hold in an escrow job. */
export const NotificationRoleSchema = z.enum(["client", "freelancer", "arbiter"]);

export type NotificationRole = z.infer<typeof NotificationRoleSchema>;

/**
 * Per-role event toggles.  Every role is optional so a partial payload from
 * the backend (e.g. a user who has only ever been a client) still validates;
 * callers treat a missing role as "no events enabled".
 */
export const NotificationPreferencesSchema = z.object({
  client: z.array(NotificationEventSchema).optional(),
  freelancer: z.array(NotificationEventSchema).optional(),
  arbiter: z.array(NotificationEventSchema).optional(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/**
 * Exact body of `GET /api/notifications/preferences` and
 * `PUT /api/notifications/preferences` (the backend's `sendSuccess`):
 * `{ success: true, data: { email, confirmed, preferences } }`.
 *
 * `email` is `null` when the user has not opted in yet, and `confirmed` is
 * `false` while the double opt-in confirmation email is pending.
 */
export const NotificationPreferencesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    email: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    confirmed: z.boolean().default(false),
    preferences: NotificationPreferencesSchema.default({}),
  }),
});

export type NotificationPreferencesResponse = z.infer<
  typeof NotificationPreferencesResponseSchema
>;

/**
 * Exact body of `POST /api/notifications/subscribe`: the email has been
 * stored and a confirmation email is pending (double opt-in).
 */
export const NotificationSubscribeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    email: z.string().min(1),
    confirmed: z.boolean().default(false),
  }),
});

export type NotificationSubscribeResponse = z.infer<typeof NotificationSubscribeResponseSchema>;

/**
 * Exact body of `POST /api/notifications/unsubscribe`: the email has been
 * removed and no further alerts will be sent.
 */
export const NotificationUnsubscribeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    unsubscribed: z.boolean(),
  }),
});

export type NotificationUnsubscribeResponse = z.infer<
  typeof NotificationUnsubscribeResponseSchema
>;

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
