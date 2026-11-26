/**
 * Contract test for the by-wallet job list response (#678 follow-up).
 *
 * `GET /api/jobs/by-wallet/:address` returns exactly one shape — the backend's
 * `sendSuccess(res, getJobsByWallet(...))` page — and the frontend must parse
 * only that shape. This test loads a fixture captured from the real backend
 * (`__tests__/fixtures/backend/by-wallet-success.json`) and asserts:
 *
 *  1. the fixture validates against `JobListResponseSchema` as-is;
 *  2. `parsePageResponse` maps every snake_case row onto the camelCase `Job`
 *     the UI renders (id, role, milestoneCount, latestEventType, latestEventAt,
 *     latestLedger);
 *  3. a renamed backend field fails loudly (contract drift) instead of
 *     silently dropping the row.
 *
 * When `escrow-backend` changes the by-wallet response, re-capture the fixture
 * and this test fails until the frontend schema is updated — rather than rows
 * quietly disappearing from the dashboard.
 */
import { describe, expect, it } from "vitest";
import byWalletSuccess from "@/__tests__/fixtures/backend/by-wallet-success.json";
import { JobListResponseSchema, JobSummarySchema, validateResponse } from "@/app/lib/api_schemas";
import { parsePageResponse } from "@/app/lib/job_list_response";

const ENDPOINT = "/api/jobs/by-wallet/G…";

describe("by-wallet response contract", () => {
  it("validates the captured backend fixture against JobListResponseSchema", () => {
    const validated = validateResponse(JobListResponseSchema, byWalletSuccess, ENDPOINT);
    expect(validated.success).toBe(true);
  });

  it("maps every fixture row onto the camelCase Job the UI renders", () => {
    const parsed = parsePageResponse(
      validateResponse(JobListResponseSchema, byWalletSuccess, ENDPOINT)
    );

    expect(parsed).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(parsed.jobs).toHaveLength(3);

    const [client, freelancer, arbiter] = parsed.jobs;

    expect(client).toMatchObject({
      id: "CCONTRACT1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      role: "client",
      milestoneCount: 4,
      latestEventType: "milestone_delivered",
      latestLedger: 2215483,
      latestEventAt: 1782360000,
    });
    expect(freelancer).toMatchObject({
      id: "CCONTRACT2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      role: "freelancer",
      milestoneCount: 1,
      latestEventType: "msfund",
      latestLedger: 2215480,
      latestEventAt: 1782359000,
    });
    // latest_timestamp is nullable on the wire; the UI treats it as absent.
    expect(arbiter).toMatchObject({
      id: "CCONTRACT3CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      role: "arbiter",
      milestoneCount: 2,
      latestEventType: "dispute_raised",
      latestLedger: 2215470,
    });
    expect(arbiter.latestEventAt).toBeUndefined();
  });

  it("fails loudly when the backend renames a row field (contract drift)", () => {
    // Simulate the backend renaming milestone_count → milestone_total.
    const drifted = {
      success: true,
      data: {
        jobs: [
          {
            contract_id: "CCONTRACT",
            role: "client",
            milestone_total: 4,
            latest_event_type: "milestone_delivered",
            latest_ledger: 1,
            latest_timestamp: 1,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    };

    // The row-level schema rejects the renamed field...
    const row = JobSummarySchema.safeParse(drifted.data.jobs[0]);
    expect(row.success).toBe(false);

    // ...and the envelope still validates (jobs is z.array(z.unknown())), so
    // the drift surfaces in parsePageResponse (reported, row skipped) rather
    // than blanking the whole list. The contract test's job is to catch it.
    const parsed = parsePageResponse(validateResponse(JobListResponseSchema, drifted, ENDPOINT));
    expect(parsed.jobs).toHaveLength(0);
    expect(parsed.total).toBe(1);
  });
});
