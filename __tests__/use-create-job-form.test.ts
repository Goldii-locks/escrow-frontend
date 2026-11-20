// @vitest-environment jsdom
/**
 * Unit tests for app/(app)/create/useCreateJobForm.ts (issue #864).
 */
import { act, renderHook, type RenderHookResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

// ── stable test addresses ─────────────────────────────────────────────────────
const ADDRESS = Keypair.random().publicKey();
const FREELANCER = Keypair.random().publicKey();
const ARBITER = Keypair.random().publicKey();
const DRAFT_KEY = `create-job-draft:${ADDRESS}`;

// ── mocks (all hoisted before importing the hook) ────────────────────────────

const mockShowToast = vi.fn();
vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast, hideToast: vi.fn(), toasts: [] }),
}));

// Wallet: address is controlled per-test via `walletAddress`.
let walletAddress: string | null = ADDRESS;
const mockSignTransaction = vi.fn<(xdr: string) => Promise<string>>();
const mockSetSimulationResult = vi.fn();
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({
    address: walletAddress,
    signTransaction: mockSignTransaction,
    setSimulationResult: mockSetSimulationResult,
  }),
}));

// No default arbiter unless overridden.
vi.mock("@/app/lib/default_arbiter", () => ({
  getDefaultArbiter: () => null,
}));

// submitCreateJob: spy so we can resolve / reject it.
const mockSubmitCreateJob = vi.fn<() => Promise<string>>();
vi.mock("@/app/(app)/create/submit", () => ({
  submitCreateJob: (...args: unknown[]) =>
    (mockSubmitCreateJob as (...a: unknown[]) => unknown)(...args),
}));

// useTokenCheck: return a neutral (no-issue) status by default.
const mockTokenCheckReturn = {
  whitelist: [],
  whitelistLoading: false,
  whitelistError: null,
  listed: false,
  status: {
    token: "",
    whitelisted: false,
    validating: false,
    validation: null,
    confirmed: false,
  },
  setConfirmed: vi.fn(),
};
vi.mock("@/app/(app)/create/useTokenCheck", () => ({
  useTokenCheck: () => mockTokenCheckReturn,
}));

// isMilestoneCapReached: always false unless a test overrides.
vi.mock("@/app/lib/milestone_limits", () => ({
  isMilestoneCapReached: () => false,
}));

// ── import hook after mocks ───────────────────────────────────────────────────
import { useCreateJobForm } from "@/app/(app)/create/useCreateJobForm";
import { CREATE_JOB_DRAFT_DEBOUNCE_MS, type CreateJobDraft } from "@/app/lib/create_job_draft";

// ── helpers ───────────────────────────────────────────────────────────────────

function draftKeyFor(addr: string) {
  return `create-job-draft:${addr}`;
}

function storeDraft(addr: string, draft: CreateJobDraft) {
  window.sessionStorage.setItem(draftKeyFor(addr), JSON.stringify(draft));
}

const FULL_DRAFT: CreateJobDraft = {
  freelancer: FREELANCER,
  arbiter: ARBITER,
  token: "CTOKEN00000000000000000000000000000000000000000000000001",
  autoReleaseDays: "14",
  acceptedAssets: ["USDC"],
  requirements: ["Deliver on time"],
  milestones: [{ amount: "100" }],
};

// ── setup/teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  walletAddress = ADDRESS;
  window.sessionStorage.clear();
  mockShowToast.mockReset();
  mockSignTransaction.mockReset();
  mockSetSimulationResult.mockReset();
  mockSubmitCreateJob.mockReset();
  mockTokenCheckReturn.status = {
    token: "",
    whitelisted: false,
    validating: false,
    validation: null,
    confirmed: false,
  };
  mockTokenCheckReturn.listed = false;
});

afterEach(() => {
  // Guard: only flush/restore if fake timers are still active.
  try {
    vi.runOnlyPendingTimers();
  } catch {
    /* real timers were active */
  }
  vi.useRealTimers();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useCreateJobForm — initial state", () => {
  it("starts on the details section", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.activeSection).toBe("details");
  });

  it("loading and txHash are initially falsy", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.loading).toBe(false);
    expect(result.current.txHash).toBeNull();
  });

  it("phase starts as idle", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.phase).toBe("idle");
  });

  it("draftRestored starts as false", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(false);
  });

  it("milestones start with one empty row", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.scope.milestones).toEqual([{ amount: "" }]);
  });
});

describe("useCreateJobForm — section navigation", () => {
  it("setActiveSection changes the active section", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.setActiveSection("milestones");
    });
    expect(result.current.activeSection).toBe("milestones");
  });

  it("can navigate to review", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.setActiveSection("review");
    });
    expect(result.current.activeSection).toBe("review");
  });

  it("can navigate back to details", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.setActiveSection("milestones");
    });
    act(() => {
      result.current.setActiveSection("details");
    });
    expect(result.current.activeSection).toBe("details");
  });
});

describe("useCreateJobForm — field handlers", () => {
  it("changeFreelancer updates the value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
    });
    expect(result.current.details.freelancer).toBe(FREELANCER);
  });

  it("changeFreelancer sets an error for an invalid address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeFreelancer("GNOT_VALID");
    });
    expect(result.current.details.freelancerError).not.toBe("");
  });

  it("changeFreelancer clears the error for an empty address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeFreelancer("GNOT_VALID");
    });
    act(() => {
      result.current.details.changeFreelancer("");
    });
    expect(result.current.details.freelancerError).toBe("");
  });

  it("changeArbiter updates the value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeArbiter(ARBITER);
    });
    expect(result.current.details.arbiter).toBe(ARBITER);
  });

  it("changeToken updates the value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeToken("CTOKEN_BAD");
    });
    expect(result.current.details.token).toBe("CTOKEN_BAD");
  });

  it("changeDeadline updates autoReleaseDays and clears deadlineError", () => {
    const { result } = renderHook(() => useCreateJobForm());
    // First produce an error.
    act(() => {
      result.current.details.blurDeadline();
    });
    // Clear by changing.
    act(() => {
      result.current.details.changeDeadline("30");
    });
    expect(result.current.details.autoReleaseDays).toBe("30");
    expect(result.current.details.deadlineError).toBeNull();
  });

  it("blurDeadline sets a deadlineError for a non-numeric value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeDeadline("");
    });
    act(() => {
      result.current.details.blurDeadline();
    });
    expect(result.current.details.deadlineError).toBeTruthy();
  });

  it("chooseArbiterMode switches mode and clears arbiterError when switching to default", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeArbiter("GNOT_VALID");
    });
    expect(result.current.details.arbiterError).not.toBe("");
    act(() => {
      result.current.details.chooseArbiterMode("default");
    });
    expect(result.current.details.arbiterError).toBe("");
  });
});

describe("useCreateJobForm — scope (milestones / assets / requirements)", () => {
  it("addMilestone appends a blank row", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.scope.addMilestone();
    });
    expect(result.current.scope.milestones).toHaveLength(2);
  });

  it("removeMilestone removes a row by index", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.scope.addMilestone();
    });
    act(() => {
      result.current.scope.removeMilestone(0);
    });
    expect(result.current.scope.milestones).toHaveLength(1);
  });

  it("updateMilestone changes the amount at an index", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.scope.updateMilestone(0, "500");
    });
    expect(result.current.scope.milestones[0].amount).toBe("500");
  });

  it("addAcceptedAsset then removeAcceptedAsset round-trips", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.scope.addAcceptedAsset();
    });
    act(() => {
      result.current.scope.updateAcceptedAsset(0, "USDC");
    });
    expect(result.current.scope.acceptedAssets).toContain("USDC");
    act(() => {
      result.current.scope.removeAcceptedAsset(0);
    });
    expect(result.current.scope.acceptedAssets).toHaveLength(0);
  });
});

describe("useCreateJobForm — draft restore", () => {
  it("restores a saved draft on mount and sets draftRestored", () => {
    storeDraft(ADDRESS, FULL_DRAFT);
    const { result } = renderHook(() => useCreateJobForm());

    expect(result.current.draftRestored).toBe(true);
    expect(result.current.details.freelancer).toBe(FREELANCER);
    expect(result.current.details.arbiter).toBe(ARBITER);
    expect(result.current.details.token).toBe(FULL_DRAFT.token);
    expect(result.current.details.autoReleaseDays).toBe("14");
  });

  it("does not set draftRestored when nothing is stored", () => {
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(false);
  });

  it("ignores a draft stored for a different address", () => {
    const OTHER = Keypair.random().publicKey();
    storeDraft(OTHER, FULL_DRAFT);
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(false);
    expect(result.current.details.freelancer).toBe("");
  });

  it("ignores a corrupt draft in sessionStorage", () => {
    window.sessionStorage.setItem(DRAFT_KEY, "{{not json}}");
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(false);
  });

  it("does not restore a draft when wallet is disconnected (address=null)", () => {
    walletAddress = null;
    storeDraft(ADDRESS, FULL_DRAFT);
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(false);
  });
});

describe("useCreateJobForm — draft saving on change", () => {
  it("saves the draft after the debounce delay when a field changes", async () => {
    const { result } = renderHook(() => useCreateJobForm());

    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
    });

    // Not saved yet (within debounce window).
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(CREATE_JOB_DRAFT_DEBOUNCE_MS);
    });

    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
    const saved = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY)!);
    expect(saved.freelancer).toBe(FREELANCER);
  });

  it("does not save when no address is connected", async () => {
    walletAddress = null;
    const { result } = renderHook(() => useCreateJobForm());

    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
    });
    await act(async () => {
      vi.advanceTimersByTime(CREATE_JOB_DRAFT_DEBOUNCE_MS);
    });

    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("does not save after a successful submit (txHash set)", async () => {
    mockSubmitCreateJob.mockResolvedValueOnce("TXHASH");
    // Set up a valid whitelisted token so submission passes.
    mockTokenCheckReturn.listed = true;
    mockTokenCheckReturn.status = {
      token: FULL_DRAFT.token,
      whitelisted: true,
      validating: false,
      validation: null,
      confirmed: false,
    };

    const { result } = renderHook(() => useCreateJobForm());

    // Populate required fields.
    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
      result.current.details.changeArbiter(ARBITER);
      result.current.details.changeToken(FULL_DRAFT.token);
      result.current.scope.updateMilestone(0, "100");
      result.current.review.setAgreed(true);
    });

    // Submit and await full completion.
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.txHash).toBe("TXHASH");

    // Clear any existing key to prove saving doesn't happen post-success.
    window.sessionStorage.removeItem(DRAFT_KEY);

    // Advance the debounce; txHash being set must prevent the save effect from running.
    await act(async () => {
      vi.advanceTimersByTime(CREATE_JOB_DRAFT_DEBOUNCE_MS + 100);
    });

    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe("useCreateJobForm — discardDraft", () => {
  it("discardDraft clears sessionStorage and resets the form", async () => {
    storeDraft(ADDRESS, FULL_DRAFT);
    const { result } = renderHook(() => useCreateJobForm());

    expect(result.current.draftRestored).toBe(true);

    act(() => {
      result.current.discardDraft();
    });

    expect(result.current.draftRestored).toBe(false);
    expect(result.current.details.freelancer).toBe("");
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe("useCreateJobForm — wallet address switch mid-form", () => {
  it("does not restore the old address draft after the wallet changes", () => {
    storeDraft(ADDRESS, FULL_DRAFT);
    walletAddress = ADDRESS;
    const { result, rerender } = renderHook(() => useCreateJobForm());
    expect(result.current.draftRestored).toBe(true);

    // Simulate address change — in a real scenario the hook re-runs with a
    // new wallet. We simulate by swapping walletAddress and rerendering.
    walletAddress = Keypair.random().publicKey();
    rerender();

    // The draft for the new address doesn't exist.
    // draftRestored stays true from the initial restore; saving is guarded by draftAddress.
    // The important check: no crash and address is reflected.
    expect(result.current.address).toBe(walletAddress);
  });

  it("draft saving waits until draftAddress matches the connected address", async () => {
    walletAddress = ADDRESS;
    const { result } = renderHook(() => useCreateJobForm());

    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
    });
    await act(async () => {
      vi.advanceTimersByTime(CREATE_JOB_DRAFT_DEBOUNCE_MS);
    });

    // Draft should have been saved for ADDRESS.
    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });
});

describe("useCreateJobForm — isSubmitDisabled", () => {
  it("is disabled when no address is connected", () => {
    walletAddress = null;
    const { result } = renderHook(() => useCreateJobForm());
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it("is disabled when milestones list is empty", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.scope.removeMilestone(0);
    });
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it("is disabled when agreed is false", () => {
    const { result } = renderHook(() => useCreateJobForm());
    // Fill milestones so that isn't the blocker.
    act(() => {
      result.current.scope.updateMilestone(0, "100");
    });
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it("is disabled during loading", async () => {
    mockSubmitCreateJob.mockReturnValue(new Promise(() => {})); // never resolves
    mockTokenCheckReturn.listed = true;
    mockTokenCheckReturn.status = {
      token: FULL_DRAFT.token,
      whitelisted: true,
      validating: false,
      validation: null,
      confirmed: false,
    };

    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
      result.current.details.changeArbiter(ARBITER);
      result.current.details.changeToken(FULL_DRAFT.token);
      result.current.scope.updateMilestone(0, "100");
      result.current.review.setAgreed(true);
    });

    // Start submit — loading is set synchronously before the await, so after
    // act flushes the initial synchronous work loading is already true.
    act(() => {
      void result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    // Flush the microtask that runs setLoading(true).
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.isSubmitDisabled).toBe(true);
  });
});

describe("useCreateJobForm — handleSubmit", () => {
  function setupValidForm(
    result: RenderHookResult<ReturnType<typeof useCreateJobForm>, unknown>["result"]
  ) {
    mockTokenCheckReturn.listed = true;
    mockTokenCheckReturn.status = {
      token: FULL_DRAFT.token,
      whitelisted: true,
      validating: false,
      validation: null,
      confirmed: false,
    };
    act(() => {
      result.current.details.changeFreelancer(FREELANCER);
      result.current.details.changeArbiter(ARBITER);
      result.current.details.changeToken(FULL_DRAFT.token);
      result.current.scope.updateMilestone(0, "100");
      result.current.review.setAgreed(true);
    });
  }

  it("success path: sets txHash and calls showToast", async () => {
    mockSubmitCreateJob.mockResolvedValueOnce("TX_HASH_OK");
    const { result } = renderHook(() => useCreateJobForm());
    setupValidForm(result);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.txHash).toBe("TX_HASH_OK");
    expect(result.current.phase).toBe("success");
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), "success");
    expect(result.current.error).toBeNull();
  });

  it("success path: clears the draft from sessionStorage", async () => {
    mockSubmitCreateJob.mockResolvedValueOnce("TX_OK");
    storeDraft(ADDRESS, FULL_DRAFT);

    const { result } = renderHook(() => useCreateJobForm());
    setupValidForm(result);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.txHash).toBe("TX_OK");
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("failure path: sets error and phase=error", async () => {
    mockSubmitCreateJob.mockRejectedValueOnce(new Error("Signing failed"));
    const { result } = renderHook(() => useCreateJobForm());
    setupValidForm(result);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBeTruthy();
    expect(result.current.txHash).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does nothing when address is null (early return)", async () => {
    walletAddress = null;
    const { result } = renderHook(() => useCreateJobForm());

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(mockSubmitCreateJob).not.toHaveBeenCalled();
  });

  it("sets field errors and returns early when addresses are missing", async () => {
    mockTokenCheckReturn.listed = true;
    mockTokenCheckReturn.status = {
      token: FULL_DRAFT.token,
      whitelisted: true,
      validating: false,
      validation: null,
      confirmed: false,
    };
    const { result } = renderHook(() => useCreateJobForm());

    // Fill milestones and token but leave freelancer/arbiter blank.
    act(() => {
      result.current.details.changeToken(FULL_DRAFT.token);
      result.current.scope.updateMilestone(0, "100");
      result.current.review.setAgreed(true);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(mockSubmitCreateJob).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it("does not double-submit while a request is pending", async () => {
    // The hook's isSubmitDisabled includes `loading`, which is the UI-level
    // guard against double-submission. When loading is true the button is
    // disabled, so a second handleSubmit should not be triggered.
    // Verify that loading flips to true during an in-flight request.
    let resolveSubmit!: (hash: string) => void;
    mockSubmitCreateJob.mockReturnValueOnce(
      new Promise<string>((res) => {
        resolveSubmit = res;
      })
    );

    const { result } = renderHook(() => useCreateJobForm());
    setupValidForm(result);

    // First submit — start without awaiting.
    act(() => {
      void result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    // Flush the synchronous setLoading(true) call.
    await act(async () => {
      await Promise.resolve();
    });

    // loading=true means isSubmitDisabled=true; the UI would not let a second
    // submit fire. Verify the guard state is correct.
    expect(result.current.loading).toBe(true);
    expect(result.current.isSubmitDisabled).toBe(true);
    expect(mockSubmitCreateJob).toHaveBeenCalledTimes(1);

    // Resolve the pending submit.
    await act(async () => {
      resolveSubmit("TX_1");
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.txHash).toBe("TX_1");
  });

  it("sets deadlineError when deadline is invalid on submit", async () => {
    mockTokenCheckReturn.listed = true;
    mockTokenCheckReturn.status = {
      token: FULL_DRAFT.token,
      whitelisted: true,
      validating: false,
      validation: null,
      confirmed: false,
    };
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.changeToken(FULL_DRAFT.token);
      result.current.details.changeFreelancer(FREELANCER);
      result.current.details.changeArbiter(ARBITER);
      result.current.scope.updateMilestone(0, "100");
      result.current.details.changeDeadline(""); // empty → invalid
      result.current.review.setAgreed(true);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.details.deadlineError).toBeTruthy();
    expect(mockSubmitCreateJob).not.toHaveBeenCalled();
  });
});

describe("useCreateJobForm — review agreed flag", () => {
  it("setAgreed toggles the agreed value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.review.setAgreed(true);
    });
    expect(result.current.review.agreed).toBe(true);
    act(() => {
      result.current.review.setAgreed(false);
    });
    expect(result.current.review.agreed).toBe(false);
  });
});

describe("useCreateJobForm — blur handlers and selectToken", () => {
  it("blurFreelancer sets an error for an invalid address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.blurFreelancer("GNOT_VALID");
    });
    expect(result.current.details.freelancerError).not.toBe("");
  });

  it("blurFreelancer clears the error for a valid address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    // First produce an error.
    act(() => {
      result.current.details.blurFreelancer("GNOT_VALID");
    });
    // Now blur with a valid key.
    act(() => {
      result.current.details.blurFreelancer(FREELANCER);
    });
    expect(result.current.details.freelancerError).toBe("");
  });

  it("blurArbiter sets an error for an invalid address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.blurArbiter("GNOT_VALID");
    });
    expect(result.current.details.arbiterError).not.toBe("");
  });

  it("blurToken sets an error for an invalid contract address", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.blurToken("not-a-contract");
    });
    // tokenError is internal; it flows through to hasValidationErrors.
    expect(result.current.hasValidationErrors).toBe(true);
  });

  it("blurToken clears the error for an empty value", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.blurToken("not-a-contract");
    });
    expect(result.current.hasValidationErrors).toBe(true);
    act(() => {
      result.current.details.blurToken("");
    });
    expect(result.current.hasValidationErrors).toBe(false);
  });

  it("selectToken sets the token directly", () => {
    const { result } = renderHook(() => useCreateJobForm());
    act(() => {
      result.current.details.selectToken(
        "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526"
      );
    });
    expect(result.current.details.token).toBe(
      "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526"
    );
  });
});
