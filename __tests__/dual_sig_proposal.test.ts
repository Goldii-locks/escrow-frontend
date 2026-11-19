/**
 * Tests for app/lib/dual_sig_proposal.ts (#897).
 *
 * These are pure-logic tests: they stub fetch and wallet functions rather than
 * mounting any components, so they run in the lightweight node environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildProposal,
  describeProposal,
  isProposalLive,
  signAuthEntry,
  assembleAndSubmit,
  encodeProposalToFragment,
  decodeProposalFromFragment,
  DualSigError,
  DEFAULT_AUTH_EXPIRY_LEDGERS,
  DUAL_SIG_METHODS,
  type DualSigProposal,
} from "@/app/lib/dual_sig_proposal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposal(overrides: Partial<DualSigProposal> = {}): DualSigProposal {
  return {
    contractId: "CCONTRACT",
    method: "replace_arbiter",
    transactionXdr: "TXBASE64XDR==",
    authEntryXdr: "AUTHENTRY==",
    expirationLedger: 1_000,
    createdAt: Date.now(),
    parties: { partyA: "GAAAAAA", partyB: "GBBBBBBB" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// encodeProposalToFragment / decodeProposalFromFragment
// ---------------------------------------------------------------------------

describe("encodeProposalToFragment / decodeProposalFromFragment", () => {
  it("round-trips a proposal losslessly", () => {
    const proposal = makeProposal();
    const fragment = encodeProposalToFragment(proposal);
    expect(typeof fragment).toBe("string");
    expect(fragment.length).toBeGreaterThan(0);
    const decoded = decodeProposalFromFragment(fragment);
    expect(decoded).toEqual(proposal);
  });

  it("throws DualSigError on invalid input", () => {
    expect(() => decodeProposalFromFragment("!!!")).toThrow(DualSigError);
  });
});

// ---------------------------------------------------------------------------
// describeProposal
// ---------------------------------------------------------------------------

describe("describeProposal", () => {
  it("maps method to actionLabel", () => {
    const proposal = makeProposal({ method: "replace_arbiter" });
    const summary = describeProposal(proposal, 500);
    expect(summary.actionLabel).toBe(DUAL_SIG_METHODS["replace_arbiter"]);
  });

  it("sets isExpired = true when currentLedger >= expirationLedger", () => {
    const proposal = makeProposal({ expirationLedger: 100 });
    expect(describeProposal(proposal, 100).isExpired).toBe(true);
    expect(describeProposal(proposal, 101).isExpired).toBe(true);
  });

  it("sets isExpired = false when currentLedger < expirationLedger", () => {
    const proposal = makeProposal({ expirationLedger: 100 });
    expect(describeProposal(proposal, 99).isExpired).toBe(false);
  });

  it("sets isExpired = false when currentLedger = 0 (unknown)", () => {
    const proposal = makeProposal({ expirationLedger: 100 });
    expect(describeProposal(proposal, 0).isExpired).toBe(false);
  });

  it("surfaces parties correctly", () => {
    const proposal = makeProposal({
      parties: { partyA: "GAAA", partyB: "GBBB" },
    });
    const summary = describeProposal(proposal, 0);
    expect(summary.initiator).toBe("GAAA");
    expect(summary.counterparty).toBe("GBBB");
  });
});

// ---------------------------------------------------------------------------
// isProposalLive
// ---------------------------------------------------------------------------

describe("isProposalLive", () => {
  it("is true when currentLedger < expirationLedger", () => {
    expect(isProposalLive(makeProposal({ expirationLedger: 500 }), 499)).toBe(true);
  });

  it("is false when currentLedger >= expirationLedger", () => {
    expect(isProposalLive(makeProposal({ expirationLedger: 500 }), 500)).toBe(false);
    expect(isProposalLive(makeProposal({ expirationLedger: 500 }), 600)).toBe(false);
  });

  it("assumes live when currentLedger = 0", () => {
    expect(isProposalLive(makeProposal({ expirationLedger: 1 }), 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildProposal
// ---------------------------------------------------------------------------

describe("buildProposal", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("throws DualSigError('unsupported_method') for unknown methods", async () => {
    await expect(
      buildProposal({
        contractId: "C1",
        method: "unknown_method",
        args: [],
        partyA: "GAAA",
        partyB: "GBBB",
      })
    ).rejects.toMatchObject({ name: "DualSigError", code: "unsupported_method" });
  });

  it("builds a proposal from a successful backend response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          xdr: "TXBASE64XDR==",
          authEntryXdr: "AUTHENTRY==",
          expirationLedger: 1200,
        },
      }),
    } as unknown as Response);

    const proposal = await buildProposal({
      contractId: "CCONTRACT",
      method: "replace_arbiter",
      args: [{ type: "address", value: "GNEWARBITER" }],
      partyA: "GAAA",
      partyB: "GBBB",
    });

    expect(proposal.transactionXdr).toBe("TXBASE64XDR==");
    expect(proposal.authEntryXdr).toBe("AUTHENTRY==");
    expect(proposal.expirationLedger).toBe(1200);
    expect(proposal.parties.partyA).toBe("GAAA");
    expect(proposal.parties.partyB).toBe("GBBB");
    expect(proposal.method).toBe("replace_arbiter");
  });

  it("uses DEFAULT_AUTH_EXPIRY_LEDGERS when backend omits expirationLedger", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { xdr: "TX==" } }),
    } as unknown as Response);

    const proposal = await buildProposal({
      contractId: "C1",
      method: "replace_arbiter",
      args: [],
      partyA: "GAAA",
      partyB: "GBBB",
    });

    expect(proposal.expirationLedger).toBe(DEFAULT_AUTH_EXPIRY_LEDGERS);
  });

  it("throws DualSigError('build_failed') when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      buildProposal({
        contractId: "C1",
        method: "replace_arbiter",
        args: [],
        partyA: "GAAA",
        partyB: "GBBB",
      })
    ).rejects.toMatchObject({ name: "DualSigError", code: "build_failed" });
  });

  it("throws DualSigError('build_failed') when backend returns !ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Simulation failed" }),
    } as unknown as Response);

    await expect(
      buildProposal({
        contractId: "C1",
        method: "replace_arbiter",
        args: [],
        partyA: "GAAA",
        partyB: "GBBB",
      })
    ).rejects.toMatchObject({ name: "DualSigError", code: "build_failed" });
  });

  it("throws DualSigError('build_failed') when XDR is missing from response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { noXdrHere: true } }),
    } as unknown as Response);

    await expect(
      buildProposal({
        contractId: "C1",
        method: "replace_arbiter",
        args: [],
        partyA: "GAAA",
        partyB: "GBBB",
      })
    ).rejects.toMatchObject({ name: "DualSigError", code: "build_failed" });
  });
});

// ---------------------------------------------------------------------------
// signAuthEntry
// ---------------------------------------------------------------------------

describe("signAuthEntry", () => {
  it("calls the wallet sign function and returns a SignedAuthEntry", async () => {
    const walletSign = vi.fn().mockResolvedValue("SIGNEDENTRY==");
    const proposal = makeProposal({ expirationLedger: 1_000 });

    const result = await signAuthEntry(proposal, 500, walletSign);

    expect(walletSign).toHaveBeenCalledWith("AUTHENTRY==", { address: "GBBBBBBB" });
    expect(result.signedAuthEntryXdr).toBe("SIGNEDENTRY==");
    expect(result.signerAddress).toBe("GBBBBBBB");
  });

  it("throws DualSigError('expired') when entry is expired", async () => {
    const walletSign = vi.fn();
    const proposal = makeProposal({ expirationLedger: 100 });

    await expect(signAuthEntry(proposal, 100, walletSign)).rejects.toMatchObject({
      name: "DualSigError",
      code: "expired",
    });
    expect(walletSign).not.toHaveBeenCalled();
  });

  it("throws DualSigError('missing_auth_entry') when no authEntryXdr", async () => {
    const walletSign = vi.fn();
    const proposal = makeProposal({ authEntryXdr: undefined });

    await expect(signAuthEntry(proposal, 0, walletSign)).rejects.toMatchObject({
      name: "DualSigError",
      code: "missing_auth_entry",
    });
  });

  it("throws DualSigError('sign_failed') when wallet rejects", async () => {
    const walletSign = vi.fn().mockRejectedValue(new Error("User rejected"));
    const proposal = makeProposal({ expirationLedger: 1_000 });

    await expect(signAuthEntry(proposal, 500, walletSign)).rejects.toMatchObject({
      name: "DualSigError",
      code: "sign_failed",
    });
  });

  it("throws DualSigError('sign_failed') when wallet returns empty string", async () => {
    const walletSign = vi.fn().mockResolvedValue("");
    const proposal = makeProposal({ expirationLedger: 1_000 });

    await expect(signAuthEntry(proposal, 500, walletSign)).rejects.toMatchObject({
      name: "DualSigError",
      code: "sign_failed",
    });
  });
});

// ---------------------------------------------------------------------------
// assembleAndSubmit
// ---------------------------------------------------------------------------

describe("assembleAndSubmit", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetAllMocks();
  });

  const proposal = makeProposal();
  const signedAuthEntry = {
    signedAuthEntryXdr: "SIGNEDENTRY==",
    signerAddress: "GBBBBBBB",
  };

  it("returns the transaction hash on success", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNEDTX==");
    // assemble call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { xdr: "ASSEMBLEDXDR==" } }),
    } as unknown as Response);
    // submit call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { hash: "TXHASH123" } }),
    } as unknown as Response);

    const txHash = await assembleAndSubmit({ proposal, signedAuthEntry, signTransaction });
    expect(txHash).toBe("TXHASH123");
    expect(signTransaction).toHaveBeenCalledWith("ASSEMBLEDXDR==");
  });

  it("throws DualSigError('assemble_failed') when assemble call fails", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNEDTX==");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Assembly error" }),
    } as unknown as Response);

    await expect(
      assembleAndSubmit({ proposal, signedAuthEntry, signTransaction })
    ).rejects.toMatchObject({ name: "DualSigError", code: "assemble_failed" });
  });

  it("throws DualSigError('assemble_failed') when assembled XDR is missing", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNEDTX==");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    } as unknown as Response);

    await expect(
      assembleAndSubmit({ proposal, signedAuthEntry, signTransaction })
    ).rejects.toMatchObject({ name: "DualSigError", code: "assemble_failed" });
  });

  it("re-throws wallet errors from signTransaction untouched", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { xdr: "ASSEMBLEDXDR==" } }),
    } as unknown as Response);
    const walletError = new Error("User declined");
    const failingSign = vi.fn().mockRejectedValue(walletError);

    await expect(
      assembleAndSubmit({ proposal, signedAuthEntry, signTransaction: failingSign })
    ).rejects.toBe(walletError);
  });

  it("throws DualSigError('submit_failed') when submit call fails", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNEDTX==");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { xdr: "ASSEMBLEDXDR==" } }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Submit error" }),
    } as unknown as Response);

    await expect(
      assembleAndSubmit({ proposal, signedAuthEntry, signTransaction })
    ).rejects.toMatchObject({ name: "DualSigError", code: "submit_failed" });
  });

  it("throws DualSigError('submit_failed') when hash is missing from submit response", async () => {
    const signTransaction = vi.fn().mockResolvedValue("SIGNEDTX==");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { xdr: "ASSEMBLEDXDR==" } }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    } as unknown as Response);

    await expect(
      assembleAndSubmit({ proposal, signedAuthEntry, signTransaction })
    ).rejects.toMatchObject({ name: "DualSigError", code: "submit_failed" });
  });
});
