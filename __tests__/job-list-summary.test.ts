// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  formatLatestActivity,
  formatMilestoneProgress,
  getCounterparty,
  getJobLabel,
  getJobRoles,
  setJobLabel,
  shortAddress,
} from "@/app/lib/job_list_summary";

const CLIENT = "GCLIENTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1";
const FREELANCER = "GFREELANCERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2";

// Fixed by-wallet summary shape from the backend.
const summary = {
  id: "CCONTRACT",
  client: CLIENT,
  freelancer: FREELANCER,
  arbiter: "",
  role: "freelancer",
  milestoneCount: 4,
  releasedCount: 2,
  latestEventType: "milestone_delivered",
  latestEventAt: "2026-10-18T10:00:00Z",
  latestLedger: 123,
};

describe("job_list_summary", () => {
  beforeEach(() => localStorage.clear());

  it("uses the backend role and picks the counterparty", () => {
    const roles = getJobRoles(summary, null);
    expect(roles).toEqual(["freelancer"]);
    expect(shortAddress(getCounterparty(summary, roles))).toBe("GCLI…AAA1");
  });

  it("falls back to the wallet address when the role is unknown", () => {
    const roles = getJobRoles({ ...summary, role: "unknown" }, CLIENT);
    expect(roles).toEqual(["client"]);
    expect(getCounterparty(summary, roles)).toBe(FREELANCER);
  });

  it("formats milestone progress", () => {
    expect(formatMilestoneProgress(summary)).toBe("2 of 4 released");
    expect(
      formatMilestoneProgress({
        ...summary,
        releasedCount: undefined,
        milestones: [{ status: "Released" }, { status: "Funded" }],
      })
    ).toBe("1 of 2 released");
    expect(formatMilestoneProgress({ ...summary, milestoneCount: 0 })).toBeNull();
  });

  it("formats latest activity in human terms", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(formatLatestActivity(summary, now)).toBe("Delivered 2h ago");
    expect(formatLatestActivity({ ...summary, latestEventAt: undefined }, now)).toBe(
      "Delivered at ledger 123"
    );
  });

  it("stores and clears a local label", () => {
    setJobLabel("CCONTRACT", " Logo design ");
    expect(getJobLabel("CCONTRACT")).toBe("Logo design");
    setJobLabel("CCONTRACT", "");
    expect(getJobLabel("CCONTRACT")).toBe("");
  });
});
