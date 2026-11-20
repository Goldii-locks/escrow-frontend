// @vitest-environment jsdom
/**
 * Unit tests for app/lib/create_job_draft.ts (issue #864).
 *
 * Uses jsdom so sessionStorage is available as a real in-memory store.
 * No React / renderHook needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCreateJobDraft,
  CREATE_JOB_DRAFT_DEBOUNCE_MS,
  EMPTY_CREATE_JOB_DRAFT,
  isEmptyDraft,
  loadCreateJobDraft,
  saveCreateJobDraft,
  type CreateJobDraft,
} from "@/app/lib/create_job_draft";

// ── helpers ──────────────────────────────────────────────────────────────────

const ADDR_A = "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456";
const ADDR_B = "GBBB1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456";
const KEY_A = `create-job-draft:${ADDR_A}`;

const FULL_DRAFT: CreateJobDraft = {
  freelancer: "GFREELANCER0000000000000000000000000000000000000000000001",
  arbiter: "GARBITER000000000000000000000000000000000000000000000001",
  token: "CTOKEN00000000000000000000000000000000000000000000000001",
  autoReleaseDays: "14",
  acceptedAssets: ["USDC", "XLM"],
  requirements: ["Deliver on time"],
  milestones: [{ amount: "100" }, { amount: "200" }],
};

function rawSet(key: string, value: unknown) {
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

// ── setup/teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("create_job_draft — round-trip", () => {
  it("save then load returns an equal draft", () => {
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    expect(loadCreateJobDraft(ADDR_A)).toEqual(FULL_DRAFT);
  });

  it("milestones survive the round-trip with extra fields stripped", () => {
    // Source may have extra keys; only `amount` is restored.
    const draft: CreateJobDraft = {
      ...FULL_DRAFT,
      milestones: [{ amount: "50" }, { amount: "75" }],
    };
    saveCreateJobDraft(ADDR_A, draft);
    const loaded = loadCreateJobDraft(ADDR_A);
    expect(loaded?.milestones).toEqual([{ amount: "50" }, { amount: "75" }]);
  });

  it("empty arrays survive the round-trip", () => {
    const draft: CreateJobDraft = {
      ...FULL_DRAFT,
      acceptedAssets: [],
      requirements: [],
    };
    saveCreateJobDraft(ADDR_A, draft);
    expect(loadCreateJobDraft(ADDR_A)).toEqual(draft);
  });
});

describe("create_job_draft — shape validation", () => {
  it("returns null when freelancer is missing", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, freelancer: undefined });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when arbiter is not a string", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, arbiter: 42 });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when token is not a string", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, token: null });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when autoReleaseDays is not a string", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, autoReleaseDays: 7 });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when acceptedAssets is not an array", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, acceptedAssets: "USDC" });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when acceptedAssets contains a non-string", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, acceptedAssets: [1, 2] });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when requirements is not an array", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, requirements: {} });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when milestones is not an array", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, milestones: "100" });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when a milestone entry has no amount field", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, milestones: [{ notAmount: "100" }] });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null when a milestone amount is not a string", () => {
    rawSet(KEY_A, { ...FULL_DRAFT, milestones: [{ amount: 100 }] });
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null for an entirely wrong type (number)", () => {
    rawSet(KEY_A, 42);
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });
});

describe("create_job_draft — corrupt JSON", () => {
  it("returns null and does not throw on corrupt JSON", () => {
    window.sessionStorage.setItem(KEY_A, "{not:valid:json}}}}");
    expect(() => loadCreateJobDraft(ADDR_A)).not.toThrow();
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null for a JSON primitive string (not an object)", () => {
    window.sessionStorage.setItem(KEY_A, JSON.stringify("oops"));
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });
});

describe("create_job_draft — per-address isolation", () => {
  it("a draft saved for ADDR_A is not visible for ADDR_B", () => {
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    expect(loadCreateJobDraft(ADDR_B)).toBeNull();
  });

  it("two addresses store independent drafts", () => {
    const draftB: CreateJobDraft = { ...FULL_DRAFT, freelancer: "GDIFF00000000000000000000000000000000000000000000000001" };
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    saveCreateJobDraft(ADDR_B, draftB);
    expect(loadCreateJobDraft(ADDR_A)?.freelancer).toBe(FULL_DRAFT.freelancer);
    expect(loadCreateJobDraft(ADDR_B)?.freelancer).toBe(draftB.freelancer);
  });

  it("clearing ADDR_A does not affect ADDR_B", () => {
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    saveCreateJobDraft(ADDR_B, FULL_DRAFT);
    clearCreateJobDraft(ADDR_A);
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
    expect(loadCreateJobDraft(ADDR_B)).not.toBeNull();
  });
});

describe("create_job_draft — storage throwing", () => {
  it("saveCreateJobDraft does not throw when setItem throws (quota)", () => {
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveCreateJobDraft(ADDR_A, FULL_DRAFT)).not.toThrow();
  });

  it("loadCreateJobDraft does not throw when getItem throws", () => {
    vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => loadCreateJobDraft(ADDR_A)).not.toThrow();
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("clearCreateJobDraft does not throw when removeItem throws", () => {
    vi.spyOn(window.sessionStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => clearCreateJobDraft(ADDR_A)).not.toThrow();
  });
});

describe("create_job_draft — empty storage", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("returns null after the draft has been cleared", () => {
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    clearCreateJobDraft(ADDR_A);
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });

  it("saving the EMPTY_CREATE_JOB_DRAFT removes the key instead of writing it", () => {
    // First write a real draft so there is something to remove.
    saveCreateJobDraft(ADDR_A, FULL_DRAFT);
    saveCreateJobDraft(ADDR_A, EMPTY_CREATE_JOB_DRAFT);
    expect(window.sessionStorage.getItem(KEY_A)).toBeNull();
    expect(loadCreateJobDraft(ADDR_A)).toBeNull();
  });
});

describe("create_job_draft — isEmptyDraft", () => {
  it("returns true for the empty sentinel", () => {
    expect(isEmptyDraft(EMPTY_CREATE_JOB_DRAFT)).toBe(true);
  });

  it("returns false for a non-empty draft", () => {
    expect(isEmptyDraft(FULL_DRAFT)).toBe(false);
  });
});

describe("create_job_draft — constants", () => {
  it("CREATE_JOB_DRAFT_DEBOUNCE_MS is a positive number", () => {
    expect(typeof CREATE_JOB_DRAFT_DEBOUNCE_MS).toBe("number");
    expect(CREATE_JOB_DRAFT_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});
