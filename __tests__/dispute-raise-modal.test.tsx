/**
 * Unit tests for DisputeRaiseModal
 *
 * Covers (issue #339):
 *  1.  Node rendering — modal open/closed guard
 *  2.  Empty-state node rendering (#333) — null milestoneIndex
 *  3.  Empty-state layout / design-token classes (#333)
 *  4.  Confirmation body — valid milestoneIndex
 *  5.  Milestone label helper (milestoneLabel)
 *  6.  ARIA attribute compliance (#330)
 *       - role="dialog", aria-modal, aria-labelledby, aria-describedby
 *       - role="alert" on warning banner
 *       - aria-label on action buttons
 *       - aria-disabled mirroring HTML disabled
 *       - aria-live="polite" on empty state
 *       - Escape key closes the modal
 *       - Backdrop click closes the modal
 *  7.  Interactive states / Tailwind classes (#331)
 *       - hover, focus-visible, disabled class presence
 *       - active:scale-[0.97] on action buttons
 *       - disabled:opacity-40, disabled:cursor-not-allowed
 *  8.  Action button behaviour
 *       - onConfirm / onClose callbacks
 *       - isPending disables both buttons and shows spinner label
 *       - no-handler (null milestoneIndex) disables confirm
 *  9.  Amount display
 * 10.  TxStatusBanner visibility
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DisputeRaiseModal, {
  milestoneLabel,
} from "@/app/components/DisputeRaiseModal";

// ---------------------------------------------------------------------------
// Mocks — TxStatusBanner and ButtonSpinner are simple presentational
// components; we stub them to keep tests focused on DisputeRaiseModal logic.
// ---------------------------------------------------------------------------

vi.mock("@/app/components/TxStatusBanner", () => ({
  default: ({ state, successMessage }: { state: { phase: string }; successMessage?: string }) =>
    state.phase !== "idle" ? (
      <div data-testid="tx-status-banner" data-phase={state.phase}>
        {successMessage}
      </div>
    ) : null,
}));

vi.mock("@/app/components/ButtonSpinner", () => ({
  default: () => <span data-testid="button-spinner" aria-hidden="true" />,
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const idleState = { phase: "idle" as const, error: null, txHash: null };
const buildingState = { phase: "building" as const, error: null, txHash: null };

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  milestoneIndex: 0,
};

const renderModal = (
  overrides: Partial<Parameters<typeof DisputeRaiseModal>[0]> = {}
) => render(<DisputeRaiseModal {...baseProps} {...overrides} />);

// ---------------------------------------------------------------------------
// 1. Node rendering — open / closed guard
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — open/closed rendering", () => {
  it("renders nothing when isOpen is false", () => {
    renderModal({ isOpen: false });
    expect(
      screen.queryByTestId("dispute-raise-modal")
    ).not.toBeInTheDocument();
  });

  it("renders the modal backdrop when isOpen is true", () => {
    renderModal();
    expect(screen.getByTestId("dispute-raise-modal")).toBeInTheDocument();
  });

  it("renders the modal panel when isOpen is true", () => {
    renderModal();
    expect(
      screen.getByTestId("dispute-raise-modal-content")
    ).toBeInTheDocument();
  });

  it("renders the title 'Raise a Dispute'", () => {
    renderModal();
    expect(
      screen.getByTestId("dispute-modal-title")
    ).toHaveTextContent("Raise a Dispute");
  });

  it("renders the close button", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toBeInTheDocument();
  });

  it("renders the actions row", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-actions")).toBeInTheDocument();
  });

  it("renders the Cancel button", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toBeInTheDocument();
  });

  it("renders the Confirm button", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Empty-state node rendering (#333)
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — empty-state node rendering (#333)", () => {
  it("renders the empty-state when milestoneIndex is null", () => {
    renderModal({ milestoneIndex: null });
    expect(
      screen.getByTestId("dispute-modal-empty-state")
    ).toBeInTheDocument();
  });

  it("does NOT render the confirmation body when milestoneIndex is null", () => {
    renderModal({ milestoneIndex: null });
    expect(
      screen.queryByTestId("dispute-modal-body")
    ).not.toBeInTheDocument();
  });

  it("does NOT render the empty-state when milestoneIndex is a number", () => {
    renderModal({ milestoneIndex: 0 });
    expect(
      screen.queryByTestId("dispute-modal-empty-state")
    ).not.toBeInTheDocument();
  });

  it("renders the empty-state heading 'No milestone selected'", () => {
    renderModal({ milestoneIndex: null });
    expect(
      screen.getByTestId("dispute-modal-empty-heading")
    ).toHaveTextContent("No milestone selected");
  });

  it("renders the empty-state description text", () => {
    renderModal({ milestoneIndex: null });
    expect(
      screen.getByTestId("dispute-modal-empty-description")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("dispute-modal-empty-description")
    ).toHaveTextContent(/Select a milestone/i);
  });

  it("renders the 'Waiting for selection' badge", () => {
    renderModal({ milestoneIndex: null });
    expect(
      screen.getByTestId("dispute-modal-empty-badge")
    ).toHaveTextContent("Waiting for selection");
  });

  it("empty-state description mentions 'Pending' and 'Delivered' statuses", () => {
    renderModal({ milestoneIndex: null });
    const desc = screen.getByTestId("dispute-modal-empty-description");
    expect(desc).toHaveTextContent(/Pending/);
    expect(desc).toHaveTextContent(/Delivered/);
  });
});

// ---------------------------------------------------------------------------
// 3. Empty-state layout / design-token classes (#333)
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — empty-state layout classes (#333)", () => {
  it("empty-state wrapper has 'border' class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "border"
    );
  });

  it("empty-state wrapper has 'rounded-lg' class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "rounded-lg"
    );
  });

  it("empty-state wrapper has 'bg-surface-field' design token", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "bg-surface-field"
    );
  });

  it("empty-state wrapper has 'flex' and 'flex-col' classes", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "flex",
      "flex-col"
    );
  });

  it("empty-state wrapper has 'sm:flex-row' responsive class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "sm:flex-row"
    );
  });

  it("empty-state wrapper has 'sm:items-center' responsive class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "sm:items-center"
    );
  });

  it("empty-state wrapper has 'sm:justify-between' responsive class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "sm:justify-between"
    );
  });

  it("badge has 'rounded-full' class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-badge")).toHaveClass(
      "rounded-full"
    );
  });

  it("badge has 'border' class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-badge")).toHaveClass(
      "border"
    );
  });

  it("badge has 'bg-surface-field' design token", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-badge")).toHaveClass(
      "bg-surface-field"
    );
  });

  it("badge has 'text-text-muted' design token", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-badge")).toHaveClass(
      "text-text-muted"
    );
  });

  it("empty-state wrapper has 'animate-fade-in' animation class", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveClass(
      "animate-fade-in"
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Confirmation body — valid milestoneIndex
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — confirmation body rendering", () => {
  it("renders the confirmation body when milestoneIndex is 0", () => {
    renderModal({ milestoneIndex: 0 });
    expect(screen.getByTestId("dispute-modal-body")).toBeInTheDocument();
  });

  it("renders the confirmation body when milestoneIndex is 3", () => {
    renderModal({ milestoneIndex: 3 });
    expect(screen.getByTestId("dispute-modal-body")).toBeInTheDocument();
  });

  it("renders the warning alert banner", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-warning")).toBeInTheDocument();
  });

  it("renders the details row", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-details")).toBeInTheDocument();
  });

  it("renders the milestone label 'Milestone 1' for index 0", () => {
    renderModal({ milestoneIndex: 0 });
    expect(
      screen.getByTestId("dispute-modal-milestone-label")
    ).toHaveTextContent("Milestone 1");
  });

  it("renders the milestone label 'Milestone 4' for index 3", () => {
    renderModal({ milestoneIndex: 3 });
    expect(
      screen.getByTestId("dispute-modal-milestone-label")
    ).toHaveTextContent("Milestone 4");
  });

  it("renders the description paragraph", () => {
    renderModal();
    expect(
      screen.getByTestId("dispute-modal-description")
    ).toBeInTheDocument();
  });

  it("description mentions arbiter review", () => {
    renderModal();
    expect(
      screen.getByTestId("dispute-modal-description")
    ).toHaveTextContent(/arbiter/i);
  });

  it("does NOT render the amount row when milestoneAmount is omitted", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: undefined });
    expect(
      screen.queryByTestId("dispute-modal-amount")
    ).not.toBeInTheDocument();
  });

  it("renders the amount when milestoneAmount is provided", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: "25.0000000 XLM" });
    expect(
      screen.getByTestId("dispute-modal-amount")
    ).toHaveTextContent("25.0000000 XLM");
  });

  it("does NOT render the amount row when milestoneAmount is null", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: null });
    expect(
      screen.queryByTestId("dispute-modal-amount")
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. milestoneLabel helper
// ---------------------------------------------------------------------------

describe("milestoneLabel helper", () => {
  it("returns 'Milestone 1' for index 0", () => {
    expect(milestoneLabel(0)).toBe("Milestone 1");
  });

  it("returns 'Milestone 5' for index 4", () => {
    expect(milestoneLabel(4)).toBe("Milestone 5");
  });

  it("returns 'Milestone 10' for index 9", () => {
    expect(milestoneLabel(9)).toBe("Milestone 10");
  });

  it("returns 'this milestone' for null", () => {
    expect(milestoneLabel(null)).toBe("this milestone");
  });

  it("returns 'this milestone' for NaN", () => {
    expect(milestoneLabel(NaN)).toBe("this milestone");
  });

  it("returns 'this milestone' for Infinity", () => {
    expect(milestoneLabel(Infinity)).toBe("this milestone");
  });
});

// ---------------------------------------------------------------------------
// 6. ARIA attribute compliance (#330)
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — ARIA attributes (#330)", () => {
  // role="dialog" + aria-modal
  it("backdrop has role='dialog'", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("backdrop has aria-modal='true'", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  // aria-labelledby
  it("dialog has aria-labelledby pointing to the title element", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "dispute-modal-title");
  });

  it("the title element has id='dispute-modal-title'", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-title")).toHaveAttribute(
      "id",
      "dispute-modal-title"
    );
  });

  // aria-describedby
  it("dialog has aria-describedby pointing to the description element when milestoneIndex is set", () => {
    renderModal({ milestoneIndex: 0 });
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-describedby",
      "dispute-modal-desc"
    );
  });

  it("description element has id='dispute-modal-desc'", () => {
    renderModal({ milestoneIndex: 0 });
    expect(screen.getByTestId("dispute-modal-description")).toHaveAttribute(
      "id",
      "dispute-modal-desc"
    );
  });

  it("dialog does NOT have aria-describedby when milestoneIndex is null", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByRole("dialog")).not.toHaveAttribute(
      "aria-describedby"
    );
  });

  // role="alert" on warning banner
  it("warning banner has role='alert'", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-warning")).toHaveAttribute(
      "role",
      "alert"
    );
  });

  // aria-live on empty state
  it("empty-state wrapper has aria-live='polite'", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-state")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  // aria-label on close button
  it("close button has accessible aria-label", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveAttribute(
      "aria-label",
      "Close dispute modal"
    );
  });

  // aria-label on cancel button
  it("Cancel button has aria-label", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveAttribute(
      "aria-label",
      "Cancel — do not raise dispute"
    );
  });

  // aria-label on confirm button includes milestone name
  it("Confirm button aria-label includes 'Milestone 1' for index 0", () => {
    renderModal({ milestoneIndex: 0 });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-label",
      "Confirm raise dispute for Milestone 1"
    );
  });

  it("Confirm button aria-label includes 'Milestone 3' for index 2", () => {
    renderModal({ milestoneIndex: 2 });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-label",
      "Confirm raise dispute for Milestone 3"
    );
  });

  it("Confirm button aria-label falls back to 'this milestone' when index is null", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-label",
      "Confirm raise dispute for this milestone"
    );
  });

  // aria-disabled — mirrors HTML disabled
  it("Confirm has aria-disabled='true' when milestoneIndex is null", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("Confirm has aria-disabled='false' when milestoneIndex is valid", () => {
    renderModal({ milestoneIndex: 0 });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-disabled",
      "false"
    );
  });

  it("aria-disabled on Confirm is consistent with HTML disabled (null index)", () => {
    renderModal({ milestoneIndex: null });
    const btn = screen.getByTestId("dispute-modal-confirm");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("aria-disabled on Confirm is consistent with HTML disabled (valid index)", () => {
    renderModal({ milestoneIndex: 0 });
    const btn = screen.getByTestId("dispute-modal-confirm");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "false");
  });

  it("Cancel has aria-disabled='true' when isPending is true", () => {
    renderModal({ isPending: true });
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("Cancel has aria-disabled='false' when isPending is false", () => {
    renderModal({ isPending: false });
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveAttribute(
      "aria-disabled",
      "false"
    );
  });

  it("Confirm has aria-disabled='true' when isPending is true", () => {
    renderModal({ milestoneIndex: 0, isPending: true });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  // empty-state badge aria-label
  it("empty-state badge has aria-label='Status: no milestone selected'", () => {
    renderModal({ milestoneIndex: null });
    expect(screen.getByTestId("dispute-modal-empty-badge")).toHaveAttribute(
      "aria-label",
      "Status: no milestone selected"
    );
  });

  // Escape key closes the modal
  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Backdrop click closes the modal
  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    // The backdrop is the dialog element itself
    fireEvent.click(screen.getByTestId("dispute-raise-modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the panel does NOT call onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("dispute-raise-modal-content"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Interactive states / Tailwind classes (#331)
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — interactive state classes (#331)", () => {
  // Confirm button — danger palette
  it("Confirm button has 'bg-danger' token", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass("bg-danger");
  });

  it("Confirm button has 'hover:bg-danger-soft/20' hover class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "hover:bg-danger-soft/20"
    );
  });

  it("Confirm button has 'hover:border-danger-soft' hover class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "hover:border-danger-soft"
    );
  });

  it("Confirm button has 'focus-visible:ring-danger-soft' focus class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "focus-visible:ring-danger-soft"
    );
  });

  it("Confirm button has 'focus-visible:ring-2' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "focus-visible:ring-2"
    );
  });

  it("Confirm button has 'active:scale-[0.97]' press-feedback class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "active:scale-[0.97]"
    );
  });

  it("Confirm button has 'disabled:opacity-40' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "disabled:opacity-40"
    );
  });

  it("Confirm button has 'disabled:cursor-not-allowed' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "disabled:cursor-not-allowed"
    );
  });

  it("Confirm button has 'transition-all' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "transition-all"
    );
  });

  it("Confirm button has 'rounded-lg' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "rounded-lg"
    );
  });

  it("Confirm button has 'focus-visible:outline-none' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "focus-visible:outline-none"
    );
  });

  it("Confirm button has 'focus-visible:ring-offset-2' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "focus-visible:ring-offset-2"
    );
  });

  it("Confirm button has 'focus-visible:ring-offset-surface-page' token", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveClass(
      "focus-visible:ring-offset-surface-page"
    );
  });

  // Cancel button — neutral palette
  it("Cancel button has 'bg-surface-field' token", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "bg-surface-field"
    );
  });

  it("Cancel button has 'hover:bg-border-subtle' hover class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "hover:bg-border-subtle"
    );
  });

  it("Cancel button has 'hover:text-text-primary' hover class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "hover:text-text-primary"
    );
  });

  it("Cancel button has 'focus-visible:ring-accent-soft' focus class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "focus-visible:ring-accent-soft"
    );
  });

  it("Cancel button has 'active:scale-[0.97]' press-feedback class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "active:scale-[0.97]"
    );
  });

  it("Cancel button has 'disabled:opacity-40' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "disabled:opacity-40"
    );
  });

  it("Cancel button has 'disabled:cursor-not-allowed' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-cancel")).toHaveClass(
      "disabled:cursor-not-allowed"
    );
  });

  // Close button — hover and focus classes
  it("close button has 'hover:text-text-primary' hover class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveClass(
      "hover:text-text-primary"
    );
  });

  it("close button has 'focus-visible:ring-2' focus class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveClass(
      "focus-visible:ring-2"
    );
  });

  it("close button has 'focus-visible:ring-accent-soft' focus class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveClass(
      "focus-visible:ring-accent-soft"
    );
  });

  it("close button has 'disabled:opacity-40' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveClass(
      "disabled:opacity-40"
    );
  });

  it("close button has 'transition-colors' class", () => {
    renderModal();
    expect(screen.getByTestId("dispute-modal-close")).toHaveClass(
      "transition-colors"
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Action button behaviour
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — action button behaviour", () => {
  it("calls onConfirm when Confirm button is clicked", () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });
    fireEvent.click(screen.getByTestId("dispute-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("dispute-modal-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close (✕) button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("dispute-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onConfirm when Confirm button is disabled (null index)", () => {
    const onConfirm = vi.fn();
    renderModal({ milestoneIndex: null, onConfirm });
    const btn = screen.getByTestId("dispute-modal-confirm");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables both action buttons when isPending is true", () => {
    renderModal({ isPending: true });
    expect(screen.getByTestId("dispute-modal-confirm")).toBeDisabled();
    expect(screen.getByTestId("dispute-modal-cancel")).toBeDisabled();
  });

  it("disables the close button when isPending is true", () => {
    renderModal({ isPending: true });
    expect(screen.getByTestId("dispute-modal-close")).toBeDisabled();
  });

  it("does NOT call onConfirm when isPending is true", () => {
    const onConfirm = vi.fn();
    renderModal({ isPending: true, onConfirm });
    const btn = screen.getByTestId("dispute-modal-confirm");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does NOT call onClose when Cancel is disabled (isPending)", () => {
    const onClose = vi.fn();
    renderModal({ isPending: true, onClose });
    const btn = screen.getByTestId("dispute-modal-cancel");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows 'Raising dispute…' label and spinner when isPending is true", () => {
    renderModal({ isPending: true });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveTextContent(
      "Raising dispute…"
    );
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
  });

  it("shows 'Raise Dispute' label when isPending is false", () => {
    renderModal({ isPending: false });
    expect(screen.getByTestId("dispute-modal-confirm")).toHaveTextContent(
      "Raise Dispute"
    );
    expect(
      screen.queryByTestId("button-spinner")
    ).not.toBeInTheDocument();
  });

  it("Confirm is enabled when milestoneIndex is 0 and isPending is false", () => {
    renderModal({ milestoneIndex: 0, isPending: false });
    expect(screen.getByTestId("dispute-modal-confirm")).not.toBeDisabled();
  });

  it("Cancel is enabled when isPending is false", () => {
    renderModal({ isPending: false });
    expect(screen.getByTestId("dispute-modal-cancel")).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 9. Amount display
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — milestone amount display", () => {
  it("renders the amount with XLM suffix", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: "10.5000000 XLM" });
    expect(screen.getByTestId("dispute-modal-amount")).toHaveTextContent(
      "10.5000000 XLM"
    );
  });

  it("amount element has 'font-mono' class", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: "5.0000000 XLM" });
    expect(screen.getByTestId("dispute-modal-amount")).toHaveClass("font-mono");
  });

  it("does not render amount row when milestoneAmount is an empty string", () => {
    renderModal({ milestoneIndex: 0, milestoneAmount: "" });
    expect(
      screen.queryByTestId("dispute-modal-amount")
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 10. TxStatusBanner visibility
// ---------------------------------------------------------------------------

describe("DisputeRaiseModal — TxStatusBanner visibility", () => {
  it("does NOT render the status banner when disputeState is null", () => {
    renderModal({ disputeState: null });
    expect(
      screen.queryByTestId("dispute-modal-status-banner")
    ).not.toBeInTheDocument();
  });

  it("does NOT render the status banner when disputeState is idle", () => {
    renderModal({ disputeState: idleState });
    expect(
      screen.queryByTestId("dispute-modal-status-banner")
    ).not.toBeInTheDocument();
  });

  it("renders the status banner when disputeState phase is 'building'", () => {
    renderModal({ disputeState: buildingState });
    expect(
      screen.getByTestId("dispute-modal-status-banner")
    ).toBeInTheDocument();
  });

  it("renders the status banner when disputeState phase is 'success'", () => {
    renderModal({
      disputeState: { phase: "success", error: null, txHash: "abc123" },
    });
    expect(
      screen.getByTestId("dispute-modal-status-banner")
    ).toBeInTheDocument();
  });

  it("status banner wrapper is not rendered when disputeState is omitted", () => {
    renderModal({});
    expect(
      screen.queryByTestId("dispute-modal-status-banner")
    ).not.toBeInTheDocument();
  });
});
