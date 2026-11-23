import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ARBITRATION_ESCROW_DETAILS } from "@/__tests__/fixtures/arbitration_escrow_details";
import {
  ESCROW_ROLE_LABELS,
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
      expect(normalizeEscrowPartyAddress(`  ${CLIENT}  `)).toBe(CLIENT.toLowerCase());
      expect(normalizeEscrowPartyAddress(CLIENT.toUpperCase())).toBe(CLIENT.toLowerCase());
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
      expect(isEscrowDetailsAuthorized(`  ${ARBITER.toLowerCase()}  `, RECORD)).toBe(true);
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
        })
      ).toBe(true);
      expect(isEscrowDetailsAuthorized(STRANGER, RECORD, { additionalViewers: [] })).toBe(false);
      expect(
        isEscrowDetailsAuthorized(null, RECORD, {
          additionalViewers: [STRANGER],
        })
      ).toBe(false);
    });

    it("distinguishes a disconnected wallet from an uninvolved one", () => {
      expect(getEscrowAccessDenialReason(null)).toBe("disconnected");
      expect(getEscrowAccessDenialReason("   ")).toBe("disconnected");
      expect(getEscrowAccessDenialReason(STRANGER)).toBe("not-a-party");
    });
  });

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
      const byLabel = Object.fromEntries(readouts.map((readout) => [readout.label, readout.value]));

      expect(byLabel.Reason).toBe("—");
      expect(byLabel.Token).toBe("—");
      expect(byLabel.Arbiter).toBe("—");
      expect(byLabel.Escrow).toBe(RECORD.escrowId);
    });

    it("rejects payloads that cannot answer the role check", () => {
      expect(isArbitrationEscrowDetailsRecord(RECORD)).toBe(true);
      expect(isArbitrationEscrowDetailsRecord({ ...RECORD, clientAddress: 5 })).toBe(false);
      // An unassigned arbiter is valid; a missing arbiter key is not, because
      // it cannot be told apart from "every wallet unauthorized".
      expect(isArbitrationEscrowDetailsRecord(UNASSIGNED)).toBe(true);
      const missingArbiter: Record<string, unknown> = { ...RECORD };
      delete missingArbiter.arbiterAddress;
      expect(isArbitrationEscrowDetailsRecord(missingArbiter)).toBe(false);
      expect(isArbitrationEscrowDetailsRecord(null)).toBe(false);
    });

    it("throws when the backend is unreachable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down")))
      );

      await expect(fetchArbitrationEscrowDetails(RECORD.disputeId)).rejects.toThrow(/network down/);
    });

    it("throws when the backend payload is incomplete", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ disputeId: RECORD.disputeId }),
          })
        )
      );

      await expect(fetchArbitrationEscrowDetails(RECORD.disputeId)).rejects.toThrow(
        /Invalid escrow details/
      );
    });
  });
});
