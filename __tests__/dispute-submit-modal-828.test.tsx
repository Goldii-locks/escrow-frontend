// @vitest-environment jsdom
/**
 * Tests for issue #828: a failed dispute submission must NOT close the
 * dispute modal or clear the typed reason.
 *
 * The dashboard's handleDisputeSubmit awaits executeTx, which resolves to
 * `null` on failure (it never rejects) and stores the error in the action
 * state keyed by `jobId:dispute:milestoneIndex`. The modal must close only
 * when a transaction hash comes back.
 *
 * This test renders DisputeRaiseModal behind a harness that reproduces the
 * dashboard wiring (disputeModalOpen / disputeMilestoneIndex state, action
 * state map, and the fixed close-only-on-success submit handler) so the
 * acceptance criteria can be asserted without mounting the whole dashboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";

/**
 * Mirrors the dashboard's dispute wiring: keeps the modal open until
 * executeTx resolves with a non-null hash, and surfaces the action-state
 * error through the `submissionError` prop.
 */
function DisputeFlowHarness({
  executeTx,
}: {
  executeTx: (reason: string, milestoneIndex: number) => Promise<string | null>;
}) {
  const [disputeModalOpen, setDisputeModalOpen] = useState(true);
  const [disputeMilestoneIndex, setDisputeMilestoneIndex] = useState<number | null>(0);
  const [phase, setPhase] = useState<"idle" | "pending" | "error" | "success">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const jobId = "C123";

  if (disputeMilestoneIndex === null) return null;

  // Same contract as the fixed handleDisputeSubmit in
  // app/(app)/dashboard/page.tsx (issue #828).
  const handleSubmit = async (reason: string) => {
    setPhase("pending");
    const txHash = await executeTx(reason, disputeMilestoneIndex);
    if (txHash === null) {
      // Failure: keep the modal open with the reason intact.
      setPhase("error");
      setActionError("Wallet rejected the transaction");
      return;
    }
    setPhase("success");
    setDisputeModalOpen(false);
    setDisputeMilestoneIndex(null);
  };

  return (
    <DisputeRaiseModal
      isOpen={disputeModalOpen}
      onClose={() => {
        setDisputeModalOpen(false);
        setDisputeMilestoneIndex(null);
      }}
      onSubmit={handleSubmit}
      jobId={jobId}
      milestoneIndex={disputeMilestoneIndex}
      isLoading={phase === "pending"}
      submissionError={actionError}
    />
  );
}

const REASON = "The delivered work does not match the agreed specification.";

describe("Issue #828 – dispute modal survives a failed submission", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the modal open, the reason intact, and the error visible when the transaction is rejected", async () => {
    const executeTx = vi.fn().mockResolvedValue(null); // wallet rejection
    render(<DisputeFlowHarness executeTx={executeTx} />);

    const textarea = screen.getByTestId("dispute-raise-modal-reason");
    fireEvent.change(textarea, { target: { value: REASON } });
    fireEvent.click(screen.getByTestId("dispute-raise-modal-confirm"));

    await waitFor(() => expect(executeTx).toHaveBeenCalledTimes(1));

    // Modal never closed and the milestone index was never cleared.
    expect(screen.getByTestId("dispute-raise-modal")).toBeInTheDocument();

    // The typed reason survived the failed submission.
    await waitFor(() => {
      expect(screen.getByTestId("dispute-raise-modal-reason")).toHaveValue(REASON);
    });

    // The action error is surfaced through the submissionError prop.
    await waitFor(() => {
      expect(screen.getByTestId("dispute-raise-modal-error")).toHaveTextContent(
        /wallet rejected the transaction/i
      );
    });
  });

  it("closes the modal after a successful submission", async () => {
    const executeTx = vi.fn().mockResolvedValue("tx-hash-abc123");
    render(<DisputeFlowHarness executeTx={executeTx} />);

    fireEvent.change(screen.getByTestId("dispute-raise-modal-reason"), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId("dispute-raise-modal-confirm"));

    await waitFor(() => expect(executeTx).toHaveBeenCalledTimes(1));

    // The modal is unmounted: closed on success only.
    await waitFor(() => {
      expect(screen.queryByTestId("dispute-raise-modal")).not.toBeInTheDocument();
    });
  });

  it("disables the confirm button while the submission is pending", async () => {
    let resolveTx: (hash: string | null) => void = () => {};
    const executeTx = vi
      .fn()
      .mockImplementation(() => new Promise<string | null>((resolve) => (resolveTx = resolve)));
    render(<DisputeFlowHarness executeTx={executeTx} />);

    fireEvent.change(screen.getByTestId("dispute-raise-modal-reason"), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId("dispute-raise-modal-confirm"));

    const confirm = screen.getByTestId("dispute-raise-modal-confirm");
    await waitFor(() => expect(confirm).toBeDisabled());

    resolveTx(null);
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });
});
