// @vitest-environment jsdom
/**
 * Tests for issue #896: EscrowLockBanner component and MilestoneCard
 * button-disabled behaviour under each lock state.
 *
 * Acceptance criteria:
 *  - Banner shown with the correct message for admin_pause, emergency_pause,
 *    and cancel_locked.
 *  - Banner absent when kind is "none".
 *  - Action buttons on MilestoneCard are disabled (and carry a tooltip) when
 *    escrowLocked is true.
 *  - Action buttons are enabled when escrowLocked is false / absent.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EscrowLockBanner from "@/app/components/EscrowLockBanner";
import MilestoneCard from "@/app/components/MilestoneCard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const idleState = { phase: "idle" as const, error: null, txHash: null };

function renderCard(
  status: string,
  role: "client" | "freelancer",
  escrowLocked: boolean,
  lockTooltip = "Escrow is locked."
) {
  return render(
    <MilestoneCard
      milestone={{ index: 0, amount: "1000", status }}
      isClient={role === "client"}
      isFreelancer={role === "freelancer"}
      partialReleaseState={idleState}
      claimAutoReleaseState={idleState}
      isPartialReleasePending={false}
      isClaimAutoReleasePending={false}
      onMarkDelivered={() => {}}
      onApprove={() => {}}
      onDispute={() => {}}
      onPartialRelease={() => {}}
      escrowLocked={escrowLocked}
      lockTooltip={lockTooltip}
    />
  );
}

// ---------------------------------------------------------------------------
// EscrowLockBanner
// ---------------------------------------------------------------------------

describe("EscrowLockBanner", () => {
  it("renders nothing when kind is none", () => {
    const { container } = render(<EscrowLockBanner kind="none" message="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner with the admin_pause message", () => {
    render(
      <EscrowLockBanner
        kind="admin_pause"
        message="Paused by the platform admin. Actions will be available once the admin unpauses."
      />
    );
    const banner = screen.getByTestId("escrow-lock-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("escrow-lock-banner-message").textContent).toMatch(/admin/i);
  });

  it("renders the banner with the emergency_pause message", () => {
    render(
      <EscrowLockBanner
        kind="emergency_pause"
        message="Emergency-paused by both parties. Actions will be available once both parties agree to resume."
      />
    );
    const banner = screen.getByTestId("escrow-lock-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("escrow-lock-banner-message").textContent).toMatch(/emergency/i);
  });

  it("renders the banner with the cancel_locked message", () => {
    render(
      <EscrowLockBanner
        kind="cancel_locked"
        message="Cancellation agreed by both parties. Waiting for the admin to settle the escrow."
      />
    );
    const banner = screen.getByTestId("escrow-lock-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("escrow-lock-banner-message").textContent).toMatch(/cancel/i);
  });

  it("renders nothing when kind is none even if message is non-empty", () => {
    const { container } = render(<EscrowLockBanner kind="none" message="should not show" />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MilestoneCard — action buttons disabled under lock
// ---------------------------------------------------------------------------

describe("MilestoneCard with escrowLocked", () => {
  it("freelancer: Mark Delivered is disabled when escrowLocked", () => {
    renderCard("Pending", "freelancer", true, "Escrow paused.");
    const btn = screen.getByRole("button", { name: /mark milestone 1 as delivered/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Escrow paused.");
  });

  it("freelancer: Mark Delivered is enabled when escrowLocked is false", () => {
    renderCard("Pending", "freelancer", false);
    const btn = screen.getByRole("button", { name: /mark milestone 1 as delivered/i });
    expect(btn).not.toBeDisabled();
  });

  it("client: Approve is disabled when escrowLocked", () => {
    renderCard("Delivered", "client", true, "Escrow paused.");
    const btn = screen.getByRole("button", { name: /approve milestone 1/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Escrow paused.");
  });

  it("client: Approve is enabled when escrowLocked is false", () => {
    renderCard("Delivered", "client", false);
    const btn = screen.getByRole("button", { name: /approve milestone 1/i });
    expect(btn).not.toBeDisabled();
  });

  it("client: Dispute is disabled when escrowLocked on a Pending milestone", () => {
    renderCard("Pending", "client", true, "Escrow locked.");
    const btn = screen.getByRole("button", { name: /dispute milestone 1/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Escrow locked.");
  });

  it("client: Dispute is enabled when escrowLocked is false", () => {
    renderCard("Pending", "client", false);
    const btn = screen.getByRole("button", { name: /dispute milestone 1/i });
    expect(btn).not.toBeDisabled();
  });

  it("freelancer: Dispute is disabled when escrowLocked on a Delivered milestone", () => {
    renderCard("Delivered", "freelancer", true, "Escrow locked.");
    const btn = screen.getByRole("button", { name: /dispute milestone 1/i });
    expect(btn).toBeDisabled();
  });

  it("client: partial-release button disabled when escrowLocked on Delivered milestone", () => {
    renderCard("Delivered", "client", true, "Escrow paused.");
    const btn = screen.getByTestId("partial-release-btn");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Escrow paused.");
  });

  it("client: partial-release button enabled when escrowLocked is false", () => {
    renderCard("Delivered", "client", false);
    const btn = screen.getByTestId("partial-release-btn");
    expect(btn).not.toBeDisabled();
  });
});
