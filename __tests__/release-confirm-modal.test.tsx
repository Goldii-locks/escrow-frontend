import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReleaseConfirmModal from "@/app/components/ReleaseConfirmModal";

describe("ReleaseConfirmModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    action: "approve" as const,
    amountStroops: "10000000",
    decimals: 7,
    symbol: "XLM",
    recipientAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal when isOpen is true", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    expect(
      screen.getByRole("dialog", { name: /confirm approve & release/i })
    ).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<ReleaseConfirmModal {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByRole("dialog", { name: /confirm approve & release/i })
    ).not.toBeInTheDocument();
  });

  it("renders the approve title", () => {
    render(<ReleaseConfirmModal {...defaultProps} action="approve" />);
    expect(screen.getByTestId("release-confirm-modal-title")).toHaveTextContent(
      /confirm approve & release/i
    );
  });

  it("renders the partial release title", () => {
    render(
      <ReleaseConfirmModal {...defaultProps} action="partial-release" />
    );
    expect(screen.getByTestId("release-confirm-modal-title")).toHaveTextContent(
      /confirm partial release/i
    );
  });

  it("shows the amount in human-readable token units", () => {
    // 10000000 stroops with 7 decimals = 1 XLM
    render(<ReleaseConfirmModal {...defaultProps} amountStroops="10000000" />);
    expect(screen.getByTestId("release-confirm-modal-amount")).toHaveTextContent(
      "1 XLM"
    );
  });

  it("shows the recipient's short address", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    expect(
      screen.getByTestId("release-confirm-modal-recipient")
    ).toHaveTextContent("GAAA...AAAA");
  });

  it("shows the remaining balance after release", () => {
    render(
      <ReleaseConfirmModal
        {...defaultProps}
        amountStroops="40000000"
        remainingBalanceStroops="60000000"
      />
    );
    expect(
      screen.getByTestId("release-confirm-modal-remaining")
    ).toHaveTextContent("6 XLM");
  });

  it("shows the irreversibility warning", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    expect(
      screen.getByTestId("release-confirm-modal-warning")
    ).toHaveTextContent(/cannot be undone/i);
  });

  it("renders Cancel and Confirm buttons", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /approve & release/i })
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm when Confirm is clicked", () => {
    render(<ReleaseConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /approve & release/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("disables Confirm while confirming", () => {
    render(<ReleaseConfirmModal {...defaultProps} isConfirming={true} />);
    expect(
      screen.getByRole("button", { name: /releasing…/i })
    ).toBeDisabled();
  });

  it("renders the partial release confirm label", () => {
    render(
      <ReleaseConfirmModal {...defaultProps} action="partial-release" />
    );
    expect(
      screen.getByRole("button", { name: /release amount/i })
    ).toBeInTheDocument();
  });
});
