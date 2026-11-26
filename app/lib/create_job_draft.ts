/**
 * Per-tab draft persistence for the create-job wizard.
 *
 * Only public form values (addresses, token, amounts) are stored, in
 * `sessionStorage`, keyed by the connected wallet address.
 *
 * The `acceptedAssets` and `requirements` fields were removed from the form
 * in favour of on-chain milestone spec hashes (tracked separately). They are
 * kept as optional fields in the JSON schema so older drafts load without
 * crashing; new drafts always store them as empty arrays.
 */

export interface CreateJobDraft {
  freelancer: string;
  arbiter: string;
  token: string;
  autoReleaseDays: string;
  /** @deprecated Always stored as []; kept for backwards-compatible deserialization. */
  acceptedAssets: string[];
  /** @deprecated Always stored as []; kept for backwards-compatible deserialization. */
  requirements: string[];
  milestones: { amount: string }[];
}

export const EMPTY_CREATE_JOB_DRAFT: CreateJobDraft = {
  freelancer: "",
  arbiter: "",
  token: "",
  autoReleaseDays: "7",
  acceptedAssets: [],
  requirements: [],
  milestones: [{ amount: "" }],
};

export const CREATE_JOB_DRAFT_DEBOUNCE_MS = 500;

function draftKey(address: string): string {
  return `create-job-draft:${address}`;
}

export function isEmptyDraft(draft: CreateJobDraft): boolean {
  return JSON.stringify(draft) === JSON.stringify(EMPTY_CREATE_JOB_DRAFT);
}

export function loadCreateJobDraft(address: string): CreateJobDraft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(address));
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CreateJobDraft & Record<string, unknown>>;
    if (
      typeof data.freelancer !== "string" ||
      typeof data.arbiter !== "string" ||
      typeof data.token !== "string" ||
      typeof data.autoReleaseDays !== "string" ||
      !Array.isArray(data.milestones) ||
      !data.milestones.every((m) => typeof (m as { amount?: unknown })?.amount === "string")
    ) {
      return null;
    }
    return {
      freelancer: data.freelancer,
      arbiter: data.arbiter,
      token: data.token,
      autoReleaseDays: data.autoReleaseDays,
      // Always normalise to empty arrays regardless of what was stored.
      acceptedAssets: [],
      requirements: [],
      milestones: (data.milestones as { amount: string }[]).map((m) => ({ amount: m.amount })),
    };
  } catch {
    return null;
  }
}

export function saveCreateJobDraft(address: string, draft: CreateJobDraft): void {
  try {
    if (isEmptyDraft(draft)) {
      window.sessionStorage.removeItem(draftKey(address));
    } else {
      window.sessionStorage.setItem(draftKey(address), JSON.stringify(draft));
    }
  } catch {
    // Storage can be unavailable (private mode, quota); drafts are best-effort.
  }
}

export function clearCreateJobDraft(address: string): void {
  try {
    window.sessionStorage.removeItem(draftKey(address));
  } catch {
    // Ignore unavailable storage.
  }
}
