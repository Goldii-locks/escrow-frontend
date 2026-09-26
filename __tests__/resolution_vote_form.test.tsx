import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResolutionVoteForm from "@/app/components/ResolutionVoteForm";
import {
  MOCK_RESOLUTION_DISPUTES,
  RESOLUTION_BADGE_STYLES,
  RESOLUTION_LOAD_ERROR,
  VOTE_CUSTOM_SPLIT_ERROR,
  VOTE_RATIONALE_MARKUP_ERROR,
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
const HOUR = 60 * 60 * 1000;

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

function renderForm(
  data: ResolutionDisputeData | null = makeDispute(),
  onSubmitVote: (s: unknown) => void | Promise<void> = vi.fn(),
) {
  const utils = render(
    <ResolutionVoteForm
      disputeId={data?.disputeId ?? "disp-missing"}
      initialData={data}
      onSubmitVote={onSubmitVote}
      nowMs={NOW}
    />,
  );
  return { ...utils, onSubmitVote };
}

const submitButton = () => screen.getByRole("button", { name: "Submit Vote" });
const rationaleField = () => screen.getByLabelText("Rationale") as HTMLTextAreaElement;
const confirmModal = () => screen.queryByTestId("resolution-vote-confirm-modal");

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

  it("strips a script payload from the rationale before it reaches the modal or the signer", async () => {
    const onSubmitVote = vi.fn();
    const { container } = renderForm(makeDispute(), onSubmitVote);

    fireEvent.change(rationaleField(), {
      target: { value: '<script>alert("xss")</script>Delivered late <img src=x onerror=alert(2)>' },
    });
    expect(screen.getByTestId("resolution-vote-markup-warning")).toBeInTheDocument();

    fireEvent.click(submitButton());

    const summary = screen.getByTestId("resolution-vote-confirm-rationale");
    expect(summary).toHaveTextContent(/^Delivered late$/);
    expect(container.querySelector("script, iframe, img")).toBeNull();
    // The textarea still echoes the raw draft (as escaped text); what matters
    // is that nothing executable reaches the confirmation summary.
    expect(screen.getByTestId("resolution-vote-confirm-modal").innerHTML).not.toContain("alert(");

    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));
    await waitFor(() => expect(onSubmitVote).toHaveBeenCalledTimes(1));
    expect(onSubmitVote.mock.calls[0][0].rationale).toBe("Delivered late");
  });

  it("sanitizes the rationale field value on blur", () => {
    renderForm();
    fireEvent.change(rationaleField(), { target: { value: "<b onclick=x()>Scope</b> met" } });
    fireEvent.blur(rationaleField());
    expect(rationaleField().value).toBe("Scope met");
    expect(screen.queryByTestId("resolution-vote-markup-warning")).not.toBeInTheDocument();
  });

  it("rejects a rationale that is nothing but markup", () => {
    const { onSubmitVote } = renderForm();
    fireEvent.change(rationaleField(), { target: { value: "<script>alert(1)</script>" } });
    fireEvent.click(submitButton());

    expect(screen.getByRole("alert")).toHaveTextContent(VOTE_RATIONALE_MARKUP_ERROR);
    expect(confirmModal()).not.toBeInTheDocument();
    expect(onSubmitVote).not.toHaveBeenCalled();
  });

  it("strips non-digits from the custom split field as the user types", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Custom split/ }));
    const input = screen.getByLabelText("Client share (bps)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "75<b>00" } });
    expect(input.value).toBe("7500");
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

// ============================================================================
// Issue #453 — backend data bindings
// ============================================================================

describe("resolution_vote_form data bindings (Issue #453)", () => {
  const apiPayload = {
    disputeId: "disp-777",
    jobId: "job-88",
    amount: "3,250 XLM",
    currentSplit: { clientBps: 2_500, freelancerBps: 7_500 },
    arbitratorStatus: "eligible",
    deadline: "2026-12-01T00:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "refund", label: "Refund client", clientBps: 10_000, freelancerBps: 0 },
      { id: "lean-freelancer", label: "Lean freelancer", clientBps: 2_500, freelancerBps: 7_500 },
      { id: "broken", label: "Does not sum", clientBps: 6_000, freelancerBps: 6_000 },
    ],
  };

  it("shows a loading skeleton, then binds API values to the form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(apiPayload));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResolutionVoteForm disputeId="disp-777" nowMs={NOW} />);

    expect(screen.getByTestId("resolution-vote-form-loading")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    expect(await screen.findByTestId("resolution-vote-dispute-id")).toHaveTextContent(
      "Dispute #disp-777 · Job job-88",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/disputes/disp-777/resolution",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByTestId("resolution-vote-amount")).toHaveTextContent("3,250 XLM");
    expect(screen.getByTestId("resolution-vote-current-split")).toHaveTextContent(
      "Client 25% / Freelancer 75%",
    );

    // Options come from the payload; the one matching the current split is
    // pre-selected and the invalid one is dropped.
    expect(screen.getByRole("radio", { name: /Refund client/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Lean freelancer/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Does not sum/ })).not.toBeInTheDocument();
  });

  it("uses a custom API endpoint when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(apiPayload));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResolutionVoteForm disputeId="disp-777" apiEndpoint="/custom/resolution" nowMs={NOW} />);

    await screen.findByTestId("resolution-vote-form");
    expect(fetchMock).toHaveBeenCalledWith("/custom/resolution", expect.anything());
  });

  it("submits the API-provided split for the selected option", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(apiPayload)));
    const onSubmitVote = vi.fn();

    render(<ResolutionVoteForm disputeId="disp-777" onSubmitVote={onSubmitVote} nowMs={NOW} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Refund client/ }));
    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    await waitFor(() =>
      expect(onSubmitVote).toHaveBeenCalledWith({
        disputeId: "disp-777",
        optionId: "refund",
        clientBps: 10_000,
        freelancerBps: 0,
        rationale: "",
      }),
    );
  });

  it("renders the empty state when the API returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, 404)));

    render(<ResolutionVoteForm disputeId="disp-404" nowMs={NOW} />);

    expect(await screen.findByTestId("resolution-vote-form-empty")).toHaveTextContent(
      "No open resolution vote was found for dispute #disp-404.",
    );
  });

  it("renders an error state with a working retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse(apiPayload));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResolutionVoteForm disputeId="disp-777" nowMs={NOW} />);

    const error = await screen.findByTestId("resolution-vote-form-error");
    expect(error).toHaveTextContent(RESOLUTION_LOAD_ERROR);

    fireEvent.click(within(error).getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("resolution-vote-amount")).toHaveTextContent("3,250 XLM");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the mock dataset when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ResolutionVoteForm disputeId="disp-101" nowMs={NOW} />);

    expect(await screen.findByTestId("resolution-vote-amount")).toHaveTextContent(
      MOCK_RESOLUTION_DISPUTES["disp-101"].amount,
    );
    expect(screen.getByRole("radio", { name: /Even split/ })).toBeChecked();
  });

  it("fetchResolutionDispute throws for an unknown dispute when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(fetchResolutionDispute("disp-unknown")).rejects.toThrow(RESOLUTION_LOAD_ERROR);
  });

  it("renders the empty state for explicit null initial data without fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderForm(null);

    expect(screen.getByTestId("resolution-vote-form-empty")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Issue #454 — status badges
// ============================================================================

describe("resolution_vote_form status badges (Issue #454)", () => {
  it("classifies dispute and vote states", () => {
    const base = makeDispute();
    expect(getResolutionVoteStatus(base, NOW)).toBe("pending_vote");
    expect(getResolutionVoteStatus({ ...base, deadline: "2026-09-01T12:00:00Z" }, NOW)).toBe(
      "action_required",
    );
    expect(getResolutionVoteStatus({ ...base, arbitratorStatus: "voted" }, NOW)).toBe("voted");
    expect(getResolutionVoteStatus(base, NOW, true)).toBe("voted");
    expect(getResolutionVoteStatus({ ...base, resolved: true }, NOW)).toBe("closed");
    expect(getResolutionVoteStatus({ ...base, deadline: "2026-08-31T00:00:00Z" }, NOW)).toBe(
      "closed",
    );
    // Closed wins over voted.
    expect(
      getResolutionVoteStatus({ ...base, arbitratorStatus: "voted", resolved: true }, NOW),
    ).toBe("closed");
  });

  it.each([
    ["pending_vote", makeDispute(), "Pending Vote", "amber", "bg-amber-900/40"],
    [
      "action_required",
      makeDispute({ deadline: new Date(NOW + 2 * HOUR).toISOString() }),
      "Action Required",
      "orange",
      "bg-orange-900/40",
    ],
    ["voted", makeDispute({ arbitratorStatus: "voted" }), "Voted", "green", "bg-emerald-900/40"],
    ["closed", makeDispute({ resolved: true }), "Resolution Closed", "red", "bg-red-900/40"],
  ] as const)("renders the %s badge", (status, data, label, tone, bgClass) => {
    renderForm(data);
    const badge = screen.getByTestId("resolution-vote-status-badge");

    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute("data-status", status);
    expect(badge).toHaveAttribute("data-tone", tone);
    expect(badge).toHaveClass(bgClass);
    expect(badge.className).toBe(RESOLUTION_BADGE_STYLES[status].className);
  });

  it("gives every status a distinct colour", () => {
    const tones = Object.values(RESOLUTION_BADGE_STYLES).map((s) => s.tone);
    expect(new Set(tones).size).toBe(tones.length);
  });

  it("locks the form for closed and already-voted disputes", () => {
    const { unmount } = renderForm(makeDispute({ resolved: true }));
    expect(submitButton()).toBeDisabled();
    expect(screen.getByTestId("resolution-vote-locked-note")).toHaveTextContent(
      "Voting on this dispute has closed.",
    );
    unmount();

    renderForm(makeDispute({ arbitratorStatus: "voted" }));
    expect(submitButton()).toBeDisabled();
    expect(screen.getByTestId("resolution-vote-locked-note")).toHaveTextContent(
      "You have already voted on this dispute.",
    );
  });

  it("shows a Not Eligible badge for ineligible arbitrators", () => {
    renderForm(makeDispute({ arbitratorStatus: "ineligible" }));
    expect(screen.getByTestId("resolution-vote-eligibility-badge")).toHaveTextContent(
      "Not Eligible",
    );
    expect(submitButton()).toBeDisabled();
  });

  it("switches the badge to Voted after a confirmed vote", async () => {
    renderForm();
    const badge = screen.getByTestId("resolution-vote-status-badge");
    expect(badge).toHaveAttribute("data-status", "pending_vote");

    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    await waitFor(() =>
      expect(screen.getByTestId("resolution-vote-status-badge")).toHaveAttribute(
        "data-status",
        "voted",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Your vote has been signed and submitted.");
  });
});

// ============================================================================
// Issue #455 — confirmation modal
// ============================================================================

describe("resolution_vote_form confirmation modal (Issue #455)", () => {
  it("opens the modal on submit without calling the signer", () => {
    const { onSubmitVote } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: /Favor freelancer/ }));
    fireEvent.change(rationaleField(), { target: { value: "Most milestones shipped" } });
    fireEvent.click(submitButton());

    const modal = screen.getByRole("dialog", { name: "Confirm your vote" });
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("resolution-vote-confirm-client")).toHaveTextContent("25%");
    expect(screen.getByTestId("resolution-vote-confirm-freelancer")).toHaveTextContent("75%");
    expect(screen.getByTestId("resolution-vote-confirm-rationale")).toHaveTextContent(
      "Most milestones shipped",
    );
    expect(onSubmitVote).not.toHaveBeenCalled();
  });

  it("does not sign when the modal is cancelled", () => {
    const { onSubmitVote } = renderForm();

    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirmModal()).not.toBeInTheDocument();
    expect(onSubmitVote).not.toHaveBeenCalled();
  });

  it("closes on Escape without signing", () => {
    const { onSubmitVote } = renderForm();

    fireEvent.click(submitButton());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(confirmModal()).not.toBeInTheDocument();
    expect(onSubmitVote).not.toHaveBeenCalled();
  });

  it("signs exactly once, only after Confirm & Sign", async () => {
    const { onSubmitVote } = renderForm();

    fireEvent.click(submitButton());
    expect(onSubmitVote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    await waitFor(() => expect(confirmModal()).not.toBeInTheDocument());
    expect(onSubmitVote).toHaveBeenCalledTimes(1);
    expect(onSubmitVote).toHaveBeenCalledWith({
      disputeId: "disp-555",
      optionId: "even-split",
      clientBps: 5_000,
      freelancerBps: 5_000,
      rationale: "",
    });
  });

  it("shows the custom split in the modal", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: /Custom split/ }));
    fireEvent.change(screen.getByLabelText("Client share (bps)"), { target: { value: "7500" } });
    expect(screen.getByTestId("resolution-vote-custom-preview")).toHaveTextContent(
      "Freelancer receives 25%",
    );
    fireEvent.click(submitButton());

    expect(screen.getByTestId("resolution-vote-confirm-client")).toHaveTextContent("75%");
    expect(screen.getByTestId("resolution-vote-confirm-freelancer")).toHaveTextContent("25%");
  });

  it("blocks the modal when the custom split is empty", () => {
    const { onSubmitVote } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: /Custom split/ }));
    fireEvent.change(screen.getByLabelText("Client share (bps)"), { target: { value: "" } });
    fireEvent.click(submitButton());

    expect(screen.getByRole("alert")).toHaveTextContent(VOTE_CUSTOM_SPLIT_ERROR);
    expect(confirmModal()).not.toBeInTheDocument();
    expect(onSubmitVote).not.toHaveBeenCalled();
  });

  it("keeps the modal open and surfaces the error when signing fails", async () => {
    const onSubmitVote = vi.fn().mockRejectedValue(new Error("User rejected the request"));
    renderForm(makeDispute(), onSubmitVote);

    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    const modal = screen.getByRole("dialog");
    expect(await within(modal).findByRole("alert")).toHaveTextContent("User rejected the request");
    expect(screen.getByTestId("resolution-vote-status-badge")).toHaveAttribute(
      "data-status",
      "pending_vote",
    );
  });

  it("disables both modal actions while the signature is pending", async () => {
    let resolveSign: () => void = () => {};
    const onSubmitVote = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSign = resolve;
        }),
    );
    renderForm(makeDispute(), onSubmitVote);

    fireEvent.click(submitButton());
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    const signing = await screen.findByRole("button", { name: "Signing…" });
    expect(signing).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // A second click while pending must not sign twice.
    fireEvent.click(signing);
    expect(onSubmitVote).toHaveBeenCalledTimes(1);

    resolveSign();
    await waitFor(() => expect(confirmModal()).not.toBeInTheDocument());
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
});

// Ported from #533 (issues #450, #451), adapted to this form's props.
describe("ResolutionVoteForm access restriction and loading (#450, #451)", () => {
  const renderGated = (props: { isAuthorizedArbiter?: boolean; isLoading?: boolean }) => {
    const data = makeDispute();
    return render(
      <ResolutionVoteForm
        disputeId={data.disputeId}
        initialData={data}
        nowMs={NOW}
        {...props}
      />,
    );
  };

  it("shows the access-restricted block for non-arbiters", () => {
    renderGated({ isAuthorizedArbiter: false });
    expect(screen.getByTestId("resolution-vote-form-unauthorized")).toBeInTheDocument();
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.getByText(/only authorized arbiters/i)).toBeInTheDocument();
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders the form when the wallet is an authorized arbiter", () => {
    renderGated({ isAuthorizedArbiter: true });
    expect(screen.queryByTestId("resolution-vote-form-unauthorized")).not.toBeInTheDocument();
  });

  it("shows skeletons while the caller is still loading, even during the auth check", () => {
    renderGated({ isAuthorizedArbiter: false, isLoading: true });
    expect(screen.getByTestId("resolution-vote-form-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("resolution-vote-form-unauthorized")).not.toBeInTheDocument();
  });
});
