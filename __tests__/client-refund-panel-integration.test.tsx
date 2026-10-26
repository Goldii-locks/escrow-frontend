import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientRefundPanel from "@/app/components/ClientRefundPanel";

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe("ClientRefundPanel mock API integration (#509)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the loading skeleton while an apiEndpoint fetch is in flight", () => {
    stubFetch({ data: [] });
    render(<ClientRefundPanel apiEndpoint="/api/mock/refunds" />);

    expect(screen.getByTestId("client-refund-panel-loading")).toBeInTheDocument();
  });

  it("replaces the mock dataset with fetched entries once the apiEndpoint resolves", async () => {
    stubFetch({
      data: [
        {
          id: "ref-fetched-1",
          job_title: "Mobile app redesign",
          amount: "420.00",
          token: "USDC",
          status: "pending",
          reason: "Scope changed mid-contract.",
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
    });

    render(<ClientRefundPanel apiEndpoint="/api/mock/refunds" />);

    await waitFor(() => {
      expect(screen.getByText("Mobile app redesign")).toBeInTheDocument();
    });

    // The built-in mock dataset entries should no longer be present.
    expect(screen.queryByText("Fullstack web application")).not.toBeInTheDocument();
    expect(screen.queryByTestId("client-refund-panel-loading")).not.toBeInTheDocument();
  });

  it("stops loading and falls back gracefully when the apiEndpoint fetch fails", async () => {
    stubFetch({}, false);

    render(<ClientRefundPanel apiEndpoint="/api/mock/refunds" />);

    await waitFor(() => {
      expect(screen.queryByTestId("client-refund-panel-loading")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("client-refund-panel")).toBeInTheDocument();
  });

  it("does not fetch when initialRefunds is supplied, and renders it verbatim", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ClientRefundPanel
        apiEndpoint="/api/mock/refunds"
        initialRefunds={[
          {
            id: "ref-static-1",
            escrowId: "esc-static",
            jobTitle: "Static entry from caller",
            amount: "10.00",
            token: "XLM",
            status: "approved",
            reason: "Caller-supplied, no fetch needed.",
            clientAddress: "GSTATIC",
            createdAt: "2026-10-05T00:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Static entry from caller")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders the empty state when there are no refund entries", () => {
    render(<ClientRefundPanel initialRefunds={[]} />);

    expect(screen.getByText("No refund requests found.")).toBeInTheDocument();
    expect(screen.getByText("0 Refund Requests")).toBeInTheDocument();
  });

  it("disables the submit button and shows a submitting label while isPending", () => {
    render(<ClientRefundPanel isPending={true} />);

    const submitBtn = screen.getByTestId("client-refund-submit-button");
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent("Submitting...");
  });

  it("merges a caller-supplied className onto the panel root", () => {
    render(<ClientRefundPanel initialRefunds={[]} className="custom-refund-class" />);

    expect(screen.getByTestId("client-refund-panel")).toHaveClass("custom-refund-class");
  });
});
