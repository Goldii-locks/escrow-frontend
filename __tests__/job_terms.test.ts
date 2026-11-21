import { describe, it, expect } from "vitest";
import { describeJobTerms, parseJobTerms, DEFAULT_JOB_TERMS } from "@/app/lib/job_terms";

describe("job terms (#857)", () => {
  it("falls back to defaults and shows all four terms", () => {
    const terms = parseJobTerms({ job: {} });
    expect(terms).toEqual(DEFAULT_JOB_TERMS);
    const lines = describeJobTerms(terms);
    expect(lines).toHaveLength(4);
    expect(lines[0].description).toBe("Client has 7 days to review each delivery");
    expect(lines[1].value).toBe("30 days");
    expect(lines[2].value).toBe("0%");
    expect(lines[3].value).toBe("Upfront");
  });

  it("reads custom values from job settings", () => {
    const terms = parseJobTerms({
      job: {
        settings: {
          funding_mode: "PerMilestone",
          dispute_timeout_seconds: "172800",
          arbiter_fee_bps: 250,
        },
        auto_release_seconds: 86400,
      },
    });
    const lines = describeJobTerms(terms);
    expect(lines[0].value).toBe("1 day");
    expect(lines[1].value).toBe("2 days");
    expect(lines[2].value).toBe("2.5%");
    expect(lines[3].value).toBe("Per milestone");
  });
});
