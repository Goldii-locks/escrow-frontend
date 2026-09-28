import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArbitrationEscrowDetails from "@/app/components/ArbitrationEscrowDetails";
import Toast from "@/app/components/Toast";
import { ToastProvider } from "@/app/context/ToastContext";
import {
  ESCROW_ROLE_LABELS,
  MOCK_ARBITRATION_ESCROW_DETAILS,
  UNAUTHORIZED_ARBITRATION_WARNING,
  type ArbitrationEscrowDetailsRecord,
  getArbitrationEscrowReadouts,
  getEscrowAccessDenialReason,
  isArbitrationEscrowDetailsRecord,
  isEscrowDetailsAuthorized,
  normalizeEscrowPartyAddress,
  resolveEscrowPartyRole,
  fetchArbitrationEscrowDetails,
} from "@/app/lib/arbitration_escrow_details";

const RECORD = MOCK_ARBITRATION_ESCROW_DETAILS;
const CLIENT = RECORD.clientAddress;
const FREELANCER = RECORD.freelancerAddress;
const ARBITER = RECORD.arbiterAddress as string;
const STRANGER = "GSTRANGER8RM4VDP2WK6HNQZTBX5C1JZKM0QWASEK3";

/** A record whose arbiter slot has not been filled in yet. */
const UNASSIGNED: ArbitrationEscrowDetailsRecord = {
  ...RECORD,
  arbiterAddress: null,
};

describe("arbitration_escrow_details module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // Access restriction role checks (Issue #480)
  // =========================================================================

  describe("Access restrictions UI blocks (Issue #480)", () => {
    it("normalises addresses for comparison and rejects unusable values", () => {
      expect(normalizeEscrowPartyAddress(`  ${CLIENT}  `)).toBe(
        CLIENT.toLowerCase(),
      );
      expect(normalizeEscrowPartyAddress(CLIENT.toUpperCase())).toBe(
        CLIENT.toLowerCase(),
      );
      expect(normalizeEscrowPartyAddress("   ")).toBeNull();
      expect(normalizeEscrowPartyAddress("")).toBeNull();
      expect(normalizeEscrowPartyAddress(null)).toBeNull();
      expect(normalizeEscrowPartyAddress(undefined)).toBeNull();
    });

    it("resolves the role held by each party on the record", () => {
      expect(resolveEscrowPartyRole(CLIENT, RECORD)).toBe("client");
      expect(resolveEscrowPartyRole(FREELANCER, RECORD)).toBe("freelancer");
      expect(resolveEscrowPartyRole(ARBITER, RECORD)).toBe("arbiter");
      expect(ESCROW_ROLE_LABELS.client).toBe("Client");
      expect(ESCROW_ROLE_LABELS.freelancer).toBe("Freelancer");
      expect(ESCROW_ROLE_LABELS.arbiter).toBe("Arbiter");
    });

    it("blocks wallets that are not a party on the record", () => {
      expect(resolveEscrowPartyRole(STRANGER, RECORD)).toBeNull();
      expect(resolveEscrowPartyRole(null, RECORD)).toBeNull();
      expect(resolveEscrowPartyRole("", RECORD)).toBeNull();
      expect(isEscrowDetailsAuthorized(STRANGER, RECORD)).toBe(false);
      expect(isEscrowDetailsAuthorized(null, RECORD)).toBe(false);
    });

    it("authorizes exactly the three named parties", () => {
      expect(isEscrowDetailsAuthorized(CLIENT, RECORD)).toBe(true);
      expect(isEscrowDetailsAuthorized(FREELANCER, RECORD)).toBe(true);
      expect(isEscrowDetailsAuthorized(ARBITER, RECORD)).toBe(true);
    });

    it("ignores case and surrounding whitespace on both sides of the check", () => {
      expect(
        isEscrowDetailsAuthorized(`  ${ARBITER.toLowerCase()}  `, RECORD),
      ).toBe(true);
      expect(isEscrowDetailsAuthorized(` ${CLIENT} `, RECORD)).toBe(true);
    });

    it("does not treat an unassigned arbiter slot as a wildcard", () => {
      expect(resolveEscrowPartyRole(ARBITER, UNASSIGNED)).toBeNull();
      expect(isEscrowDetailsAuthorized(ARBITER, UNASSIGNED)).toBe(false);
      expect(isEscrowDetailsAuthorized(STRANGER, UNASSIGNED)).toBe(false);
      // The parties that are still named remain readable.
      expect(isEscrowDetailsAuthorized(CLIENT, UNASSIGNED)).toBe(true);
      expect(isEscrowDetailsAuthorized(FREELANCER, UNASSIGNED)).toBe(true);
    });

    it("extends the allowlist only through additionalViewers", () => {
      expect(isEscrowDetailsAuthorized(STRANGER, RECORD)).toBe(false);
      expect(
        isEscrowDetailsAuthorized(STRANGER, RECORD, {
          additionalViewers: [CLIENT, STRANGER],
        }),
      ).toBe(true);
      expect(
        isEscrowDetailsAuthorized(STRANGER, RECORD, { additionalViewers: [] }),
      ).toBe(false);
      expect(
        isEscrowDetailsAuthorized(null, RECORD, {
          additionalViewers: [STRANGER],
        }),
      ).toBe(false);
    });

    it("distinguishes a disconnected wallet from an uninvolved one", () => {
      expect(getEscrowAccessDenialReason(null)).toBe("disconnected");
      expect(getEscrowAccessDenialReason("   ")).toBe("disconnected");
      expect(getEscrowAccessDenialReason(STRANGER)).toBe("not-a-party");
    });

    it("renders the fallback warning screen for unauthorized accounts", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
          initialRecord={RECORD}
        />,
      );

      const warning = screen.getByTestId(
        "arbitration-escrow-details-unauthorized",
      );
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveAttribute("role", "alert");
      expect(warning).toHaveAttribute("aria-live", "assertive");
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Access Restricted: Only the client, freelancer, and assigned arbiter on this locked escrow can view its dispute details.",
        ),
      ).toBeInTheDocument();
      expect(UNAUTHORIZED_ARBITRATION_WARNING).toMatch(/Access Restricted/);
    });

    it("blocks the whole view: no locked record field reaches the DOM", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
          initialRecord={RECORD}
        />,
      );

      expect(
        screen.queryByTestId("arbitration-escrow-details-container"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(RECORD.reason)).not.toBeInTheDocument();
      expect(screen.queryByText(RECORD.lockedAmount)).not.toBeInTheDocument();
      expect(screen.queryByText(RECORD.escrowId)).not.toBeInTheDocument();
      expect(screen.queryByText(RECORD.clientAddress)).not.toBeInTheDocument();
      expect(screen.queryByText(RECORD.freelancerAddress)).not.toBeInTheDocument();
    });

    it("blocks a disconnected wallet with a connect-wallet prompt", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          initialRecord={RECORD}
        />,
      );

      expect(
        screen.getByTestId("arbitration-escrow-details-unauthorized"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Connect the wallet that is a party on this dispute/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Current Wallet: Not connected/i)).toBeInTheDocument();
    });

    it("tells a connected-but-uninvolved wallet why it is blocked", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
          initialRecord={RECORD}
        />,
      );

      expect(
        screen.getByText(/This wallet is connected but is not a party/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`Current Wallet: ${STRANGER}`),
      ).toBeInTheDocument();
    });

    it("blocks an unassigned-arbiter wallet from reading the locked record", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={ARBITER}
          initialRecord={UNASSIGNED}
        />,
      );

      expect(
        screen.getByTestId("arbitration-escrow-details-unauthorized"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("arbitration-escrow-details-container"),
      ).not.toBeInTheDocument();
    });

    it("renders the details for the client, the freelancer, and the arbiter", () => {
      for (const [wallet, label] of [
        [CLIENT, "Viewing as Client"],
        [FREELANCER, "Viewing as Freelancer"],
        [ARBITER, "Viewing as Arbiter"],
      ] as const) {
        const { unmount } = render(
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={wallet}
            initialRecord={RECORD}
          />,
        );

        expect(
          screen.getByTestId("arbitration-escrow-details-container"),
        ).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
        unmount();
      }
    });

    it("never leaks a record value into the unauthorized warning", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
          initialRecord={RECORD}
        />,
      );

      const warning = screen.getByTestId(
        "arbitration-escrow-details-unauthorized",
      );
      for (const value of [
        RECORD.escrowId,
        RECORD.disputeId,
        RECORD.lockedAmount,
        RECORD.clientAddress,
        RECORD.freelancerAddress,
        ARBITER,
        RECORD.reason,
      ]) {
        expect(warning.textContent).not.toContain(value);
      }
    });

    it("swaps the warning for the details when the wallet changes", () => {
      const { rerender } = render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
          initialRecord={RECORD}
        />,
      );

      expect(
        screen.getByTestId("arbitration-escrow-details-unauthorized"),
      ).toBeInTheDocument();

      rerender(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={CLIENT}
          initialRecord={RECORD}
        />,
      );

      expect(
        screen.queryByTestId("arbitration-escrow-details-unauthorized"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("arbitration-escrow-details-container"),
      ).toBeInTheDocument();
    });

    it("shows placeholders while the record resolves", async () => {
      render(<ArbitrationEscrowDetails disputeId={RECORD.disputeId} isLoading />);

      const loading = screen.getByTestId("arbitration-escrow-details-loading");
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(
        screen.queryByTestId("arbitration-escrow-details-unauthorized"),
      ).not.toBeInTheDocument();

      // Flush the mock fetch so the pending update lands inside the test.
      await waitFor(() => {
        expect(
          screen.getByTestId("arbitration-escrow-details-loading"),
        ).toHaveAttribute("aria-busy", "true");
      });
    });
  });

  // =========================================================================
  // Readout mapping and mock bindings supporting the access-restricted view
  // =========================================================================

  describe("Record readout mapping and bindings", () => {
    it("maps every field of the record onto a labelled readout", () => {
      const readouts = getArbitrationEscrowReadouts(RECORD);

      expect(readouts.map((readout) => readout.label)).toEqual([
        "Escrow",
        "Dispute",
        "Status",
        "Locked At",
        "Amount",
        "Token",
        "Client",
        "Freelancer",
        "Arbiter",
        "Reason",
      ]);
      expect(readouts.every((readout) => readout.value.length > 0)).toBe(true);
    });

    it("falls back to a dash rather than rendering an empty row", () => {
      const readouts = getArbitrationEscrowReadouts({
        ...RECORD,
        reason: "  ",
        token: "",
        arbiterAddress: null,
      });
      const byLabel = Object.fromEntries(
        readouts.map((readout) => [readout.label, readout.value]),
      );

      expect(byLabel.Reason).toBe("—");
      expect(byLabel.Token).toBe("—");
      expect(byLabel.Arbiter).toBe("—");
      expect(byLabel.Escrow).toBe(RECORD.escrowId);
    });

    it("renders every readout value inside the details view", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={ARBITER}
          initialRecord={RECORD}
        />,
      );

      const grid = screen.getByTestId("arbitration-escrow-details-grid");
      for (const readout of getArbitrationEscrowReadouts(RECORD)) {
        expect(screen.getByText(readout.label)).toBeInTheDocument();
        expect(grid.textContent).toContain(readout.value);
      }
    });

    it("keeps long addresses inside their cell instead of overflowing", () => {
      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={CLIENT}
          initialRecord={RECORD}
        />,
      );

      const value = screen.getByText(RECORD.clientAddress);
      const cell = value.closest("div");
      expect(cell?.className).toContain("min-w-0");
      expect(value.className).toContain("min-w-0");
      expect(value.className).toContain("break-words");
    });

    it("rejects payloads that cannot answer the role check", () => {
      expect(isArbitrationEscrowDetailsRecord(RECORD)).toBe(true);
      expect(isArbitrationEscrowDetailsRecord({ ...RECORD, clientAddress: 5 })).toBe(
        false,
      );
      // An unassigned arbiter is valid; a missing arbiter key is not, because
      // it cannot be told apart from "every wallet unauthorized".
      expect(isArbitrationEscrowDetailsRecord(UNASSIGNED)).toBe(true);
      const missingArbiter: Record<string, unknown> = { ...RECORD };
      delete missingArbiter.arbiterAddress;
      expect(isArbitrationEscrowDetailsRecord(missingArbiter)).toBe(false);
      expect(isArbitrationEscrowDetailsRecord(null)).toBe(false);
    });

    it("returns the mock record when the backend is unreachable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      await expect(
        fetchArbitrationEscrowDetails(RECORD.disputeId),
      ).resolves.toEqual(RECORD);
    });

    it("returns the mock record when the backend payload is incomplete", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ disputeId: RECORD.disputeId }),
          }),
        ),
      );

      await expect(
        fetchArbitrationEscrowDetails(RECORD.disputeId),
      ).resolves.toEqual(RECORD);
    });

    it("still enforces the role check against a mock-fetched record", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={STRANGER}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("arbitration-escrow-details-unauthorized"),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("arbitration-escrow-details-container"),
      ).not.toBeInTheDocument();
    });

    it("renders the fetched record for an authorized wallet", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      render(
        <ArbitrationEscrowDetails
          disputeId={RECORD.disputeId}
          currentWalletAddress={FREELANCER}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("arbitration-escrow-details-container"),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("Viewing as Freelancer")).toBeInTheDocument();
    });

    it("exposes action controls when onAction is provided", () => {
      render(
        <ToastProvider>
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={CLIENT}
            initialRecord={RECORD}
            onAction={vi.fn()}
          />
        </ToastProvider>,
      );

      expect(screen.getByTestId("action-request-review")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Validation Modals and Toasts (Issues #485 & #486) & Mock Integration (#489)
  // =========================================================================

  describe("Validation modals, toasts, and mock integration checks (#485, #486, #489)", () => {
    it("blocks submit until confirmation dialog is double-confirmed (#485)", async () => {
      const handleAction = vi.fn();
      render(
        <ToastProvider>
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={CLIENT}
            initialRecord={RECORD}
            onAction={handleAction}
          />
        </ToastProvider>,
      );

      // Trigger action button
      fireEvent.click(screen.getByTestId("action-request-review"));

      // Confirmation modal appears
      const modal = screen.getByTestId("arbitration-escrow-details-confirm-modal");
      expect(modal).toBeInTheDocument();

      const submitBtn = screen.getByTestId("arbitration-confirm-modal-submit");
      expect(submitBtn).toBeDisabled();
      expect(handleAction).not.toHaveBeenCalled();

      // Check acknowledgment box
      const checkbox = screen.getByTestId("arbitration-confirm-modal-checkbox");
      fireEvent.click(checkbox);
      expect(submitBtn).not.toBeDisabled();

      // Submit confirmation
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleAction).toHaveBeenCalledWith("request_review");
      });
    });

    it("triggers toast warnings on action success and failure (#486)", async () => {
      const handleSuccess = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(
        <ToastProvider>
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={CLIENT}
            initialRecord={RECORD}
            onAction={handleSuccess}
          />
          <Toast />
        </ToastProvider>,
      );

      // Success flow
      fireEvent.click(screen.getByTestId("action-request-review"));
      fireEvent.click(screen.getByTestId("arbitration-confirm-modal-checkbox"));
      fireEvent.click(screen.getByTestId("arbitration-confirm-modal-submit"));

      await waitFor(() => {
        expect(screen.getByText("Action 'request_review' completed successfully.")).toBeInTheDocument();
      });

      // Failure flow
      const handleFailure = vi.fn().mockRejectedValue(new Error("Transaction rejected"));
      rerender(
        <ToastProvider>
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={CLIENT}
            initialRecord={RECORD}
            onAction={handleFailure}
          />
          <Toast />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByTestId("action-request-review"));
      fireEvent.click(screen.getByTestId("arbitration-confirm-modal-checkbox"));
      fireEvent.click(screen.getByTestId("arbitration-confirm-modal-submit"));

      await waitFor(() => {
        expect(screen.getByText("Action failed: Transaction rejected")).toBeInTheDocument();
      });
    });

    it("confirms mock layout setup elements render correctly in test environments (#489)", () => {
      render(
        <ToastProvider>
          <ArbitrationEscrowDetails
            disputeId={RECORD.disputeId}
            currentWalletAddress={CLIENT}
            initialRecord={RECORD}
          />
        </ToastProvider>,
      );

      expect(screen.getByTestId("arbitration-escrow-details-container")).toBeInTheDocument();
      expect(screen.getByTestId("arbitration-escrow-details-grid")).toBeInTheDocument();
      expect(screen.getByText("Locked Escrow Details")).toBeInTheDocument();
      expect(screen.getByText("Viewing as Client")).toBeInTheDocument();
    });
  });
});
