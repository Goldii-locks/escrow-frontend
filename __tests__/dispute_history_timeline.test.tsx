import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DisputeHistoryTimeline from "@/app/components/DisputeHistoryTimeline";
import Toast from "@/app/components/Toast";
import { ToastProvider } from "@/app/context/ToastContext";
import {
  DISPUTE_STATUS_BADGES,
  MOCK_TIMELINE_EVENTS,
  buildTimelineCsv,
  canSubmitAction,
  downloadTimelineCsv,
  escapeCsvCell,
  getActionToast,
  getAvailableActions,
  getStatusBadge,
  type DisputeTimelineEvent,
  type DisputeTimelineStatus,
} from "@/app/lib/dispute_history_timeline";

function renderTimeline(
  props: Partial<React.ComponentProps<typeof DisputeHistoryTimeline>> = {},
) {
  return render(
    <ToastProvider>
      <DisputeHistoryTimeline disputeId="disp-101" events={MOCK_TIMELINE_EVENTS} {...props} />
      <Toast />
    </ToastProvider>,
  );
}

const event = (status: DisputeTimelineStatus, id: string = status): DisputeTimelineEvent => ({
  ...MOCK_TIMELINE_EVENTS[0],
  id,
  status,
});

describe("state badges (#444)", () => {
  it("gives every status a distinct colour class, glyph and label", () => {
    const badges = Object.values(DISPUTE_STATUS_BADGES);
    expect(new Set(badges.map((b) => b.className)).size).toBe(badges.length);
    expect(new Set(badges.map((b) => b.glyph)).size).toBe(badges.length);
    expect(new Set(badges.map((b) => b.label)).size).toBe(badges.length);
  });

  it("falls back to the pending badge for unknown statuses", () => {
    expect(getStatusBadge("bogus").status).toBe("pending");
    expect(getStatusBadge(null).status).toBe("pending");
    expect(getStatusBadge("constructor").status).toBe("pending");
  });

  it.each(Object.keys(DISPUTE_STATUS_BADGES) as DisputeTimelineStatus[])(
    "renders the %s marker",
    (status) => {
      renderTimeline({ events: [event(status)] });
      const badge = screen.getByTestId(`dispute-timeline-badge-${status}`);
      expect(badge).toHaveAttribute("data-status", status);
      expect(badge).toHaveTextContent(DISPUTE_STATUS_BADGES[status].label);
      expect(badge.className).toContain(DISPUTE_STATUS_BADGES[status].className);
    },
  );
});

describe("action confirmation (#445)", () => {
  it("blocks submit until the dialog is open and acknowledged", () => {
    expect(canSubmitAction({ opened: false, acknowledged: true, submitting: false })).toBe(false);
    expect(canSubmitAction({ opened: true, acknowledged: false, submitting: false })).toBe(false);
    expect(canSubmitAction({ opened: true, acknowledged: true, submitting: true })).toBe(false);
    expect(canSubmitAction({ opened: true, acknowledged: true, submitting: false })).toBe(true);
  });

  it("only offers actions on unsettled events", () => {
    expect(getAvailableActions("resolved")).toEqual([]);
    expect(getAvailableActions("rejected")).toEqual([]);
    expect(getAvailableActions("escalated")).toEqual(["withdraw"]);
  });

  it("does not sign when the action button is clicked without confirming", () => {
    const onAction = vi.fn();
    renderTimeline({ events: [event("pending", "e1")], onAction });
    expect(screen.queryByTestId("dispute-timeline-confirm-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("dispute-timeline-escalate-e1"));
    expect(screen.getByTestId("dispute-timeline-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dispute-timeline-confirm-submit")).toBeDisabled();

    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-submit"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("signs only after acknowledgement, then closes the dialog", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    renderTimeline({ events: [event("pending", "e1")], onAction });

    fireEvent.click(screen.getByTestId("dispute-timeline-withdraw-e1"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-ack"));
    expect(screen.getByTestId("dispute-timeline-confirm-submit")).toBeEnabled();
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-submit"));

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onAction).toHaveBeenCalledWith("withdraw", expect.objectContaining({ id: "e1" }));
    await waitFor(() =>
      expect(screen.queryByTestId("dispute-timeline-confirm-dialog")).not.toBeInTheDocument(),
    );
  });

  it("cancelling never signs", () => {
    const onAction = vi.fn();
    renderTimeline({ events: [event("pending", "e1")], onAction });
    fireEvent.click(screen.getByTestId("dispute-timeline-escalate-e1"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-cancel"));
    expect(screen.queryByTestId("dispute-timeline-confirm-dialog")).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("toast warnings (#446)", () => {
  it("builds success and error messages", () => {
    expect(getActionToast("escalate", "success")).toEqual({
      message: "Dispute escalated successfully.",
      type: "success",
    });
    expect(getActionToast("withdraw", "failure", new Error("rejected by wallet"))).toEqual({
      message: "Could not withdraw the dispute: rejected by wallet",
      type: "error",
    });
  });

  it("shows a success toast after a confirmed action", async () => {
    renderTimeline({ events: [event("pending", "e1")], onAction: vi.fn().mockResolvedValue(undefined) });
    fireEvent.click(screen.getByTestId("dispute-timeline-escalate-e1"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-ack"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dispute escalated successfully.");
  });

  it("shows an error toast when signing fails", async () => {
    renderTimeline({
      events: [event("pending", "e1")],
      onAction: vi.fn().mockRejectedValue(new Error("user declined")),
    });
    fireEvent.click(screen.getByTestId("dispute-timeline-escalate-e1"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-ack"));
    fireEvent.click(screen.getByTestId("dispute-timeline-confirm-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not escalate the dispute: user declined",
    );
  });

  it("shows a warning toast when exporting an empty timeline", () => {
    renderTimeline({ events: [] });
    fireEvent.click(screen.getByTestId("dispute-timeline-export"));
    expect(screen.getByRole("alert")).toHaveTextContent("There are no timeline events to export.");
  });
});

describe("CSV export (#447)", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock");
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("escapes quotes, delimiters, line breaks and formula triggers", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell(null)).toBe("");
  });

  it("puts the correct cell values in each row", () => {
    const [header, ...rows] = buildTimelineCsv(MOCK_TIMELINE_EVENTS).split("\r\n");
    expect(header).toBe(
      "Event ID,Dispute ID,Title,Description,Actor,Status,Occurred At",
    );
    expect(rows).toHaveLength(MOCK_TIMELINE_EVENTS.length);
    expect(rows[0]).toBe(
      "evt-001,disp-101,Dispute raised,Client disputed milestone 2 delivery.,client,Resolved,2026-09-20T10:15:00Z",
    );
    expect(rows[1]).toContain(",Under review,");
  });

  it("downloads a csv file with the events' cell values", async () => {
    expect(downloadTimelineCsv(MOCK_TIMELINE_EVENTS, "out.csv")).toBe(true);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toContain("text/csv");
    const text = await blob.text();
    // Blob.text() strips the BOM, so check the raw bytes for the UTF-8 BOM.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain("evt-003,disp-101,Awaiting freelancer response");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("downloads nothing for an empty timeline", () => {
    expect(downloadTimelineCsv([], "out.csv")).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("export button downloads and shows a success toast", () => {
    renderTimeline();
    fireEvent.click(screen.getByTestId("dispute-timeline-export"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Dispute history exported.");
  });
});
