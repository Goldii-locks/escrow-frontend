import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESOLUTION_BADGE_STYLES,
  RESOLUTION_LOAD_ERROR,
  buildVoteSubmission,
  containsUnsafeMarkup,
  fetchResolutionDispute,
  formatBpsAsPercent,
  getResolutionVoteStatus,
  normalizeResolutionDispute,
  sanitizeBpsInput,
  sanitizeVoteInput,
  type ResolutionDisputeData,
} from "@/app/lib/resolution_vote_form";

// ── fixtures ────────────────────────────────────────────────────────────────

const NOW = Date.parse("2026-09-01T00:00:00Z");

function makeDispute(overrides: Partial<ResolutionDisputeData> = {}): ResolutionDisputeData {
  return {
    disputeId: "disp-555",
    jobId: "job-42",
    amount: "2,000 XLM",
    currentSplit: { clientBps: 5_000, freelancerBps: 5_000 },
    arbitratorStatus: "eligible",
    deadline: "2026-09-10T00:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "full-refund", label: "Full refund to client", clientBps: 10_000, freelancerBps: 0 },
      { id: "even-split", label: "Even split", clientBps: 5_000, freelancerBps: 5_000 },
      { id: "favor-freelancer", label: "Favor freelancer", clientBps: 2_500, freelancerBps: 7_500 },
    ],
    ...overrides,
  };
}
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// Issue #452 — input sanitization
// ============================================================================

describe("resolution_vote_form sanitization (Issue #452)", () => {
  it.each([
    ["<script>alert(1)</script>Fair split", "Fair split"],
    ['<SCRIPT type="text/javascript">steal()</SCRIPT>ok', "ok"],
    ["<script>alert(1)", ""],
    ['<iframe src="javascript:alert(1)"></iframe>text', "text"],
    ["<img src=x onerror=alert(1)>visible", "visible"],
    ['<b onclick="evil()">bold</b> words', "bold words"],
    ["<code>rm -rf /</code>done", "done"],
    ["<svg onload=alert(1)>", ""],
    ["onload=steal() hello", "hello"],
    ["javascript:alert(1)", "alert(1)"],
  ])("sanitizeVoteInput(%j) → %j", (input, expected) => {
    expect(sanitizeVoteInput(input)).toBe(expected);
  });

  it("leaves ordinary text, comparisons and percentages untouched", () => {
    const text = "Client got 80% of scope; 3 < 5 deliverables were late";
    expect(sanitizeVoteInput(text)).toBe(text);
    expect(containsUnsafeMarkup(text)).toBe(false);
    expect(containsUnsafeMarkup("<b>hi</b>")).toBe(true);
  });

  it("returns an empty string for non-string input", () => {
    expect(sanitizeVoteInput(undefined)).toBe("");
    expect(sanitizeVoteInput(null)).toBe("");
    expect(sanitizeVoteInput(42)).toBe("");
  });

  it("sanitizeBpsInput keeps digits only and clamps to 10 000", () => {
    expect(sanitizeBpsInput("12abc34")).toBe("1234");
    expect(sanitizeBpsInput("-50")).toBe("50");
    expect(sanitizeBpsInput("99999")).toBe("10000");
    expect(sanitizeBpsInput("<script>1</script>")).toBe("1");
    expect(sanitizeBpsInput("")).toBe("");
  });
  it("sanitizes free-text fields in API payloads", () => {
    const normalized = normalizeResolutionDispute({
      disputeId: "disp-9<script>x()</script>",
      jobId: "<img src=x onerror=alert(1)>job-1",
      amount: "<b>10 XLM</b>",
      currentSplit: { clientBps: 5_000, freelancerBps: 5_000 },
      deadline: "2026-10-01T00:00:00Z",
      voteOptions: [
        {
          id: "even",
          label: '<iframe src="evil"></iframe>Even split',
          clientBps: 5_000,
          freelancerBps: 5_000,
        },
      ],
    });

    expect(normalized?.disputeId).toBe("disp-9");
    expect(normalized?.jobId).toBe("job-1");
    expect(normalized?.amount).toBe("10 XLM");
    expect(normalized?.voteOptions[0].label).toBe("Even split");
  });
});

it("fetchResolutionDispute throws for an unknown dispute when the API fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
  await expect(fetchResolutionDispute("disp-unknown")).rejects.toThrow(RESOLUTION_LOAD_ERROR);
});

describe("resolution_vote_form status badges (Issue #454)", () => {
  it("classifies dispute and vote states", () => {
    const base = makeDispute();
    expect(getResolutionVoteStatus(base, NOW)).toBe("pending_vote");
    expect(getResolutionVoteStatus({ ...base, deadline: "2026-09-01T12:00:00Z" }, NOW)).toBe(
      "action_required"
    );
    expect(getResolutionVoteStatus({ ...base, arbitratorStatus: "voted" }, NOW)).toBe("voted");
    expect(getResolutionVoteStatus(base, NOW, true)).toBe("voted");
    expect(getResolutionVoteStatus({ ...base, resolved: true }, NOW)).toBe("closed");
    expect(getResolutionVoteStatus({ ...base, deadline: "2026-08-31T00:00:00Z" }, NOW)).toBe(
      "closed"
    );
    // Closed wins over voted.
    expect(
      getResolutionVoteStatus({ ...base, arbitratorStatus: "voted", resolved: true }, NOW)
    ).toBe("closed");
  });

  it("gives every status a distinct colour", () => {
    const tones = Object.values(RESOLUTION_BADGE_STYLES).map((s) => s.tone);
    expect(new Set(tones).size).toBe(tones.length);
  });
});

it("buildVoteSubmission never produces a submission for an unknown option", () => {
  const result = buildVoteSubmission(makeDispute(), {
    optionId: "nope",
    customClientBps: "",
    rationale: "",
  });
  expect(result.ok).toBe(false);
});

it("formats basis points as percentages", () => {
  expect(formatBpsAsPercent(10_000)).toBe("100%");
  expect(formatBpsAsPercent(5_000)).toBe("50%");
  expect(formatBpsAsPercent(3_333)).toBe("33.33%");
  expect(formatBpsAsPercent(50)).toBe("0.5%");
  expect(formatBpsAsPercent(0)).toBe("0%");
});
