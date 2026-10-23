/**
 * Tests for Zod-based runtime validation of backend API responses (#678).
 *
 * Every API helper must validate its response and throw `ApiShapeError` on
 * failure so the UI can show "Unexpected response from server" rather than
 * silently rendering empty or partial data.
 */

import { describe, expect, it } from "vitest";
import {
  ApiShapeError,
  AutoReleaseResponseSchema,
  JobDetailResponseSchema,
  JobListResponseSchema,
  JobSchema,
  MilestoneSchema,
  WhitelistResponseSchema,
  validateResponse,
} from "@/app/lib/api_schemas";

// ---------------------------------------------------------------------------
// ApiShapeError
// ---------------------------------------------------------------------------

describe("ApiShapeError", () => {
  it("has the correct name and preserves the Zod cause", () => {
    const result = JobSchema.safeParse({ notAnId: true });
    if (result.success) throw new Error("expected failure");
    const err = new ApiShapeError("/api/test", result.error);
    expect(err.name).toBe("ApiShapeError");
    expect(err.message).toContain("/api/test");
    expect(err.cause).toBe(result.error);
  });
});

// ---------------------------------------------------------------------------
// validateResponse helper
// ---------------------------------------------------------------------------

describe("validateResponse", () => {
  it("returns the parsed value on a valid payload", () => {
    const valid = {
      id: "job-abc",
      client: "",
      freelancer: "",
      arbiter: "",
      funded: false,
    };
    const job = validateResponse(JobSchema, valid, "/api/jobs/abc");
    expect(job.id).toBe("job-abc");
  });

  it("throws ApiShapeError on an invalid payload", () => {
    expect(() => validateResponse(JobSchema, { funded: "yes" }, "/api/jobs/bad")).toThrow(
      ApiShapeError
    );
  });

  it("includes the endpoint in the error message", () => {
    try {
      validateResponse(JobSchema, {}, "/api/jobs/missing-id");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiShapeError);
      expect((err as ApiShapeError).message).toContain("/api/jobs/missing-id");
    }
  });
});

// ---------------------------------------------------------------------------
// MilestoneSchema
// ---------------------------------------------------------------------------

describe("MilestoneSchema", () => {
  it("parses a well-formed milestone", () => {
    const m = MilestoneSchema.parse({ index: 0, amount: "1000", status: "Pending" });
    expect(m.index).toBe(0);
    expect(m.releasedAmount).toBeUndefined();
  });

  it("rejects a milestone with a negative index", () => {
    expect(() => MilestoneSchema.parse({ index: -1, amount: "0", status: "" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JobSchema
// ---------------------------------------------------------------------------

describe("JobSchema", () => {
  const validJob = {
    id: "job-1",
    client: "GCLIENT_WALLET",
    freelancer: "GFREELANCER_WALLET",
    arbiter: "GARBITER_WALLET",
    funded: true,
  };

  it("parses a well-formed job", () => {
    const job = JobSchema.parse(validJob);
    expect(job.id).toBe("job-1");
    expect(job.funded).toBe(true);
  });

  it("defaults client/freelancer/arbiter to empty strings when missing", () => {
    const job = JobSchema.parse({ id: "x", funded: false });
    expect(job.client).toBe("");
    expect(job.freelancer).toBe("");
    expect(job.arbiter).toBe("");
  });

  it("rejects a job with no id", () => {
    expect(() => JobSchema.parse({ funded: true })).toThrow();
  });

  it("rejects an empty id string", () => {
    expect(() => JobSchema.parse({ id: "", funded: false })).toThrow();
  });

  it("accepts milestones array", () => {
    const job = JobSchema.parse({
      ...validJob,
      milestones: [{ index: 0, amount: "500", status: "Pending" }],
    });
    expect(job.milestones).toHaveLength(1);
  });

  it("rejects malformed milestones", () => {
    expect(() =>
      JobSchema.parse({ ...validJob, milestones: [{ index: "zero", amount: "0", status: "" }] })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JobListResponseSchema
// ---------------------------------------------------------------------------

describe("JobListResponseSchema", () => {
  it("accepts a flat array in data", () => {
    const r = JobListResponseSchema.parse({
      success: true,
      data: [{ id: "j1", funded: false }],
    });
    expect(Array.isArray(r.data)).toBe(true);
  });

  it("accepts success:false with an error message", () => {
    const r = JobListResponseSchema.parse({ success: false, error: "oops" });
    expect(r.success).toBe(false);
    expect(r.error).toBe("oops");
  });

  it("rejects an entirely unexpected shape", () => {
    // A top-level string is not a valid response envelope
    expect(() => JobListResponseSchema.parse("raw string")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JobDetailResponseSchema
// ---------------------------------------------------------------------------

describe("JobDetailResponseSchema", () => {
  it("accepts a valid detail response", () => {
    const r = JobDetailResponseSchema.parse({
      success: true,
      data: { id: "j1", funded: true },
    });
    expect(r.success).toBe(true);
  });

  it("accepts missing data field", () => {
    const r = JobDetailResponseSchema.parse({ success: false, error: "not found" });
    expect(r.data).toBeUndefined();
  });

  it("rejects an entirely wrong shape (array at top level)", () => {
    expect(() => JobDetailResponseSchema.parse([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// WhitelistResponseSchema
// ---------------------------------------------------------------------------

describe("WhitelistResponseSchema", () => {
  it("accepts the backend body { success: true, data: { tokens } } (#618)", () => {
    const r = WhitelistResponseSchema.parse({
      success: true,
      data: { tokens: ["T1", { address: "T2", symbol: "USDC" }] },
    });
    expect(r.data.tokens).toHaveLength(2);
  });

  it.each([
    ["a bare array", ["TOKEN_ADDR_1"]],
    ["a flat data array", { success: true, data: [{ address: "T1" }] }],
    ["a top-level tokens array", { tokens: ["T1"] }],
    ["an error envelope", { success: false, error: "boom" }],
    ["a number", 42],
  ])("rejects %s", (_label, body) => {
    expect(() => WhitelistResponseSchema.parse(body)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AutoReleaseResponseSchema
// ---------------------------------------------------------------------------

describe("AutoReleaseResponseSchema", () => {
  it("accepts a deadline number", () => {
    const r = AutoReleaseResponseSchema.parse({
      success: true,
      data: { deadline: 1_700_000_000, eligible: false },
    });
    expect(r.data?.deadline).toBe(1_700_000_000);
  });

  it("accepts a deadline ISO string", () => {
    const r = AutoReleaseResponseSchema.parse({
      data: { autoReleaseAt: "2026-01-01T00:00:00Z" },
    });
    expect(typeof r.data?.autoReleaseAt).toBe("string");
  });

  it("accepts secondsRemaining without a deadline", () => {
    const r = AutoReleaseResponseSchema.parse({
      data: { secondsRemaining: 3600 },
    });
    expect(r.data?.secondsRemaining).toBe(3600);
  });

  it("rejects a completely wrong shape", () => {
    expect(() => AutoReleaseResponseSchema.parse(true)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// End-to-end: malformed payload produces explicit error, not empty data
// ---------------------------------------------------------------------------

describe("malformed payload produces ApiShapeError, not empty data", () => {
  it("throws ApiShapeError for JobListResponse when given a plain string", () => {
    expect(() =>
      validateResponse(JobListResponseSchema, "unexpected string", "/api/jobs/by-wallet/G…")
    ).toThrow(ApiShapeError);
  });

  it("throws ApiShapeError for JobDetail when given an array", () => {
    expect(() => validateResponse(JobDetailResponseSchema, [], "/api/jobs/job-123")).toThrow(
      ApiShapeError
    );
  });

  it("throws ApiShapeError for Whitelist when given a number", () => {
    expect(() => validateResponse(WhitelistResponseSchema, 0, "/api/jobs/cid/whitelist")).toThrow(
      ApiShapeError
    );
  });

  it("throws ApiShapeError for AutoRelease when given true", () => {
    expect(() =>
      validateResponse(AutoReleaseResponseSchema, true, "/api/jobs/j/milestones/0/auto-release")
    ).toThrow(ApiShapeError);
  });
});
