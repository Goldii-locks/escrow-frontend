/**
 * Per-tab draft persistence for the create-job wizard.
 *
 * Only public form values (addresses, token, amounts, text) are stored, in
 * `sessionStorage`, keyed by the connected wallet address.
 */

export interface CreateJobDraft {
  freelancer: string;
  arbiter: string;
  token: string;
  autoReleaseDays: string;
  acceptedAssets: string[];
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function isEmptyDraft(draft: CreateJobDraft): boolean {
  return JSON.stringify(draft) === JSON.stringify(EMPTY_CREATE_JOB_DRAFT);
}

export function loadCreateJobDraft(address: string): CreateJobDraft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(address));
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CreateJobDraft>;
    if (
      typeof data.freelancer !== "string" ||
      typeof data.arbiter !== "string" ||
      typeof data.token !== "string" ||
      typeof data.autoReleaseDays !== "string" ||
      !isStringArray(data.acceptedAssets) ||
      !isStringArray(data.requirements) ||
      !Array.isArray(data.milestones) ||
      !data.milestones.every((m) => typeof m?.amount === "string")
    ) {
      return null;
    }
    return {
      freelancer: data.freelancer,
      arbiter: data.arbiter,
      token: data.token,
      autoReleaseDays: data.autoReleaseDays,
      acceptedAssets: data.acceptedAssets,
      requirements: data.requirements,
      milestones: data.milestones.map((m) => ({ amount: m.amount })),
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
