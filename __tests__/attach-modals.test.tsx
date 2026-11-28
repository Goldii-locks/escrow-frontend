import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddEvidenceModal from "@/app/components/AddEvidenceModal";
import DeliverableAttachModal from "@/app/components/DeliverableAttachModal";

describe("DeliverableAttachModal (#823)", () => {
  it("renders nothing while closed", () => {
    render(<DeliverableAttachModal isOpen={false} onClose={vi.fn()} milestoneIndex={0} />);
    expect(screen.queryByTestId("deliverable-attach-modal")).not.toBeInTheDocument();
  });

  it("requires some content before confirming", async () => {
    const onConfirm = vi.fn();
    render(
      <DeliverableAttachModal isOpen onClose={vi.fn()} onConfirm={onConfirm} milestoneIndex={1} />
    );
    expect(screen.getByTestId("deliverable-attach-modal-title")).toHaveTextContent("Milestone 2");
    fireEvent.click(screen.getByTestId("deliverable-attach-modal-confirm"));
    expect(await screen.findByText(/Attach a link, note, or file/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("rejects an invalid link", async () => {
    render(<DeliverableAttachModal isOpen onClose={vi.fn()} milestoneIndex={0} />);
    fireEvent.change(screen.getByTestId("deliverable-attach-modal-link"), {
      target: { value: "not a url" },
    });
    fireEvent.click(screen.getByTestId("deliverable-attach-modal-confirm"));
    expect(await screen.findByText("Please enter a valid link.")).toBeInTheDocument();
  });

  it("hashes the content, confirms and closes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <DeliverableAttachModal isOpen onClose={onClose} onConfirm={onConfirm} milestoneIndex={0} />
    );
    fireEvent.change(screen.getByTestId("deliverable-attach-modal-link"), {
      target: { value: "https://example.com/work.pdf" },
    });
    fireEvent.change(screen.getByTestId("deliverable-attach-modal-note"), {
      target: { value: "all done" },
    });
    fireEvent.click(screen.getByTestId("deliverable-attach-modal-confirm"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [hash, payload] = onConfirm.mock.calls[0];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload).toMatchObject({ link: "https://example.com/work.pdf", note: "all done" });
  });

  it("shows the error when confirming fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    render(
      <DeliverableAttachModal isOpen onClose={onClose} onConfirm={onConfirm} milestoneIndex={0} />
    );
    fireEvent.change(screen.getByTestId("deliverable-attach-modal-note"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByTestId("deliverable-attach-modal-confirm"));
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels", () => {
    const onClose = vi.fn();
    render(<DeliverableAttachModal isOpen onClose={onClose} milestoneIndex={0} />);
    fireEvent.click(screen.getByTestId("deliverable-attach-modal-cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AddEvidenceModal (#820)", () => {
  it("renders nothing while closed", () => {
    render(<AddEvidenceModal isOpen={false} onClose={vi.fn()} milestoneIndex={0} />);
    expect(screen.queryByTestId("add-evidence-modal")).not.toBeInTheDocument();
  });

  it("requires a title", async () => {
    const onConfirm = vi.fn();
    render(<AddEvidenceModal isOpen onClose={vi.fn()} onConfirm={onConfirm} milestoneIndex={0} />);
    fireEvent.click(screen.getByTestId("add-evidence-modal-confirm"));
    expect(await screen.findByText("Please give the evidence a title.")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("hashes the evidence, confirms and closes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AddEvidenceModal isOpen onClose={onClose} onConfirm={onConfirm} milestoneIndex={0} />);
    fireEvent.change(screen.getByPlaceholderText(/Deployment logs/), { target: { value: "Logs" } });
    fireEvent.change(screen.getByTestId("add-evidence-modal-description"), {
      target: { value: "proof" },
    });
    fireEvent.click(screen.getByTestId("add-evidence-modal-confirm"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [hash, payload] = onConfirm.mock.calls[0];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload).toMatchObject({ title: "Logs", description: "proof" });
  });

  it("shows the error when confirming fails and cancels", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    render(<AddEvidenceModal isOpen onClose={onClose} onConfirm={onConfirm} milestoneIndex={0} />);
    fireEvent.change(screen.getByPlaceholderText(/Deployment logs/), { target: { value: "Logs" } });
    fireEvent.click(screen.getByTestId("add-evidence-modal-confirm"));
    expect(await screen.findByText("nope")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("add-evidence-modal-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
