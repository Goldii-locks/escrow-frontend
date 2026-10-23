import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  applyMultiSigSignature,
  createMultiSigSplit,
  createStellarEnvelopeParser,
  DEFAULT_MULTISIG_MIN_SIGNATURES,
  NetworkSyncMultiSigStructureError,
  parseMultiSigEnvelope,
  simulateMultiSigAssembly,
  toNetworkSyncSignRequest,
  validateMultiSigAssembly,
  type NetworkSyncMultiSigSplit,
} from "@/app/lib/network_sync_checker";

function validBase64(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) bytes[i] = i % 256;
  return Buffer.from(bytes).toString("base64");
}

describe("network_sync_checker multi-sig assembly (#159)", () => {
  it("exposes DEFAULT_MULTISIG_MIN_SIGNATURES = 2", () => {
    expect(DEFAULT_MULTISIG_MIN_SIGNATURES).toBe(2);
  });

  describe("parseMultiSigEnvelope", () => {
    it("parses a valid base64 envelope and reports signature slots", () => {
      const xdr = validBase64(160); // 160 bytes → 2 signature slots by default extractor.
      const shape = parseMultiSigEnvelope(xdr);
      expect(shape.baseXdr).toBe(xdr);
      expect(shape.signatures).toBe(2);
      expect(shape.sourceAccount).toBeNull();
      expect(shape.signatureSlotIndices).toEqual([1, 2]);
    });

    it("trims surrounding whitespace before validating", () => {
      const xdr = validBase64(80);
      const shape = parseMultiSigEnvelope(`  \n\t${xdr}  `);
      expect(shape.baseXdr).toBe(xdr);
      expect(shape.signatures).toBe(1);
    });

    it("rejects an empty XDR with code empty_xdr", () => {
      expect(() => parseMultiSigEnvelope("")).toThrowError(NetworkSyncMultiSigStructureError);
      try {
        parseMultiSigEnvelope("");
      } catch (err) {
        const e = err as NetworkSyncMultiSigStructureError;
        expect(e.name).toBe("NetworkSyncMultiSigStructureError");
        expect(e.code).toBe("empty_xdr");
        expect(e.message).toMatch(/empty/i);
      }
    });

    it("rejects whitespace-only XDR", () => {
      expect(() => parseMultiSigEnvelope("   \n\t  ")).toThrowError(/empty/i);
    });

    it("rejects non-string XDR inputs", () => {
      // Cast through `any` so we exercise the runtime guard at runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => parseMultiSigEnvelope(undefined as any)).toThrowError(
        NetworkSyncMultiSigStructureError
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => parseMultiSigEnvelope(123 as any)).toThrowError(
        NetworkSyncMultiSigStructureError
      );
    });

    it("rejects XDR that cannot round-trip through base64", () => {
      expect(() => parseMultiSigEnvelope("AAA@")).toThrowError(NetworkSyncMultiSigStructureError);
      try {
        parseMultiSigEnvelope("AAA@");
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("invalid_base64");
        expect((err as NetworkSyncMultiSigStructureError).message).toMatch(/base64/i);
      }
    });

    it("flags a decorator mismatch when expectedSignatures differ", () => {
      const xdr = validBase64(160); // 2 slots; expect 3.
      try {
        parseMultiSigEnvelope(xdr, { expectedSignatures: 3 });
      } catch (err) {
        const e = err as NetworkSyncMultiSigStructureError;
        expect(e.code).toBe("decorator_mismatch");
        expect(e.message).toMatch(/3/);
        expect(e.message).toMatch(/2/);
      }
    });

    it("accepts a matching expectedSignatures override", () => {
      const xdr = validBase64(160);
      const shape = parseMultiSigEnvelope(xdr, { expectedSignatures: 2 });
      expect(shape.signatures).toBe(2);
    });

    it("throws missing_signatures when the extractor returns zero", () => {
      const xdr = validBase64(80);
      try {
        parseMultiSigEnvelope(xdr, { countSignatures: () => 0 });
      } catch (err) {
        const e = err as NetworkSyncMultiSigStructureError;
        expect(e.code).toBe("missing_signatures");
      }
    });

    it("honours a custom signature extractor", () => {
      const xdr = validBase64(240);
      const shape = parseMultiSigEnvelope(xdr, {
        countSignatures: () => 7,
      });
      expect(shape.signatures).toBe(7);
      expect(shape.signatureSlotIndices).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("forwards an injected sourceAccount onto the envelope shape", () => {
      const xdr = validBase64(80);
      const shape = parseMultiSigEnvelope(xdr, {
        sourceAccount: "GABCDEFG",
      });
      expect(shape.sourceAccount).toBe("GABCDEFG");
    });
  });

  describe("parseMultiSigEnvelope XDR injection (#159+p)", () => {
    it("prefers parseEnvelopeXdr over the byte-level heuristic", () => {
      const xdr = validBase64(80); // byte heuristic would say 1 sig.
      const shape = parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => ({
          signatures: 3,
          sourceAccount: "GFROM_PARSER",
        }),
      });
      expect(shape.signatures).toBe(3);
      expect(shape.sourceAccount).toBe("GFROM_PARSER");
      expect(shape.signatureSlotIndices).toEqual([1, 2, 3]);
    });

    it("falls back to options.sourceAccount when parser returns null", () => {
      const xdr = validBase64(80);
      const shape = parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => ({ signatures: 1, sourceAccount: null }),
        sourceAccount: "GFROM_OPTIONS",
      });
      expect(shape.sourceAccount).toBe("GFROM_OPTIONS");
    });

    it("returns null sourceAccount when parser and options both omit it", () => {
      const xdr = validBase64(80);
      const shape = parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => ({ signatures: 1, sourceAccount: null }),
      });
      expect(shape.sourceAccount).toBeNull();
    });

    it("treats empty-string parser sourceAccount as not authoritative", () => {
      const xdr = validBase64(80);
      const shape = parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => ({ signatures: 1, sourceAccount: "" }),
        sourceAccount: "GFROM_OPTIONS",
      });
      expect(shape.sourceAccount).toBe("GFROM_OPTIONS");
    });

    it("allows a real XDR parser to return zero signatures without throwing", () => {
      const xdr = validBase64(80);
      // FeeBump / freshly built envelopes may legitimately have 0 sigs.
      expect(() =>
        parseMultiSigEnvelope(xdr, {
          parseEnvelopeXdr: () => ({ signatures: 0, sourceAccount: null }),
        })
      ).not.toThrow();
    });

    it("re-throws parser throws as envelope_parse_failure", () => {
      const xdr = validBase64(80);
      expect(() =>
        parseMultiSigEnvelope(xdr, {
          parseEnvelopeXdr: () => {
            throw new Error("XDR shape unexpected");
          },
        })
      ).toThrowError(NetworkSyncMultiSigStructureError);
      try {
        parseMultiSigEnvelope(xdr, {
          parseEnvelopeXdr: () => {
            throw new Error("XDR shape unexpected");
          },
        });
      } catch (err) {
        const e = err as NetworkSyncMultiSigStructureError;
        expect(e.code).toBe("envelope_parse_failure");
        expect(e.message).toMatch(/XDR shape unexpected/);
      }
    });

    it("raises envelope_parse_failure when parser returns an invalid shape", () => {
      const xdr = validBase64(80);
      expect(() =>
        parseMultiSigEnvelope(xdr, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parseEnvelopeXdr: (() => ({ signatures: NaN })) as any,
        })
      ).toThrowError(NetworkSyncMultiSigStructureError);
      try {
        parseMultiSigEnvelope(xdr, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parseEnvelopeXdr: (() => ({ signatures: NaN })) as any,
        });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("envelope_parse_failure");
      }
    });

    it("still throws missing_signatures via the countSignatures fallback only", () => {
      const xdr = validBase64(80);
      try {
        parseMultiSigEnvelope(xdr, {
          countSignatures: () => 0,
        });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("missing_signatures");
      }
    });

    it("countSignatures fallback still reports the custom count", () => {
      const xdr = validBase64(160);
      const shape = parseMultiSigEnvelope(xdr, {
        countSignatures: () => 5,
      });
      expect(shape.signatures).toBe(5);
    });
  });

  describe("createStellarEnvelopeParser factory (#159+p)", () => {
    it("eagerly rejects empty passphrases", () => {
      expect(() => createStellarEnvelopeParser("")).toThrow(/non-empty/);
      expect(() => createStellarEnvelopeParser("   ")).toThrow(/non-empty/);
    });

    it("returns real DecoratedSignature counts from a built Transaction envelope", () => {
      const kp = Keypair.random();
      const account = new Account(kp.publicKey(), "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.bumpSequence({ bumpTo: "0" }))
        .setTimeout(30)
        .build();
      const xdr = tx.toEnvelope().toXDR("base64");

      function escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      const parser = createStellarEnvelopeParser(Networks.TESTNET);
      const shape = parseMultiSigEnvelope(xdr, { parseEnvelopeXdr: parser });
      // Source account must come back as the G address we built from. stellar-sdk
      // v13 may emit a muxed `M…` form rather than the bare `G` string, so we
      // accept either an exact G match or a muxed substring containing the G key.
      const expected = `^(${escapeRegExp(kp.publicKey())}|M.*${escapeRegExp(kp.publicKey())}.*)$`;
      expect(shape.sourceAccount).toMatch(new RegExp(expected));
    });

    it("surfaces SDK failures as envelope_parse_failure", () => {
      // Random bytes that aren't a real envelope — the SDK will throw on parse.
      const bytes = validBase64(80);
      const parser = createStellarEnvelopeParser(Networks.TESTNET);
      expect(() => parseMultiSigEnvelope(bytes, { parseEnvelopeXdr: parser })).toThrowError(
        NetworkSyncMultiSigStructureError
      );
      try {
        parseMultiSigEnvelope(bytes, { parseEnvelopeXdr: parser });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("envelope_parse_failure");
      }
    });
  });

  describe("createMultiSigSplit", () => {
    it("creates a split whose signedXdr is initialised to the base XDR", () => {
      const base = validBase64(80);
      const split = createMultiSigSplit(base, {
        publicKey: "GABC",
        hint: "hint-1",
      });
      expect(split.signer.publicKey).toBe("GABC");
      expect(split.signer.hint).toBe("hint-1");
      expect(split.signedXdr).toBe(split.baseXdr);
      expect(split.baseXdr).toBe(base);
    });

    it("rejects empty XDR with code empty_xdr", () => {
      try {
        createMultiSigSplit("", { publicKey: "GABC", hint: "x" });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("empty_xdr");
      }
    });

    it("rejects a missing publicKey", () => {
      try {
        createMultiSigSplit(validBase64(80), {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          publicKey: "" as any,
          hint: "h",
        });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("malformed_envelope");
      }
    });

    it("rejects a missing hint", () => {
      try {
        createMultiSigSplit(validBase64(80), {
          publicKey: "GABC",
          hint: "",
        });
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("malformed_envelope");
      }
    });

    it("rejects a fully absent signer", () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createMultiSigSplit(validBase64(80), undefined as any);
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("malformed_envelope");
      }
    });
  });

  describe("applyMultiSigSignature", () => {
    it("records the signed XDR and returns the same split reference", () => {
      const split = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "hint-1",
      });
      const signedXdr = validBase64(160);
      const returned = applyMultiSigSignature(split, signedXdr);
      expect(returned).toBe(split);
      expect(split.signedXdr).toBe(signedXdr);
      expect(split.baseXdr).toBe(split.baseXdr);
      expect(split.signer).toEqual({ publicKey: "GABC", hint: "hint-1" });
    });

    it("preserves every other split field while overwriting signedXdr", () => {
      const base = validBase64(80);
      const split = createMultiSigSplit(base, {
        publicKey: "GABC",
        hint: "hint-1",
      });
      applyMultiSigSignature(split, validBase64(160));
      expect(split.baseXdr).toBe(base);
      expect(split.signer.publicKey).toBe("GABC");
      expect(split.signer.hint).toBe("hint-1");
    });

    it("rejects an empty signed XDR with code empty_xdr", () => {
      const split = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "hint-1",
      });
      try {
        applyMultiSigSignature(split, "   ");
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("empty_xdr");
      }
    });
  });

  describe("toNetworkSyncSignRequest", () => {
    it("projects a split into a NetworkSyncSignRequest with null payload", () => {
      const split = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "hint-1",
      });
      const req = toNetworkSyncSignRequest(split);
      expect(req.xdr).toBe(split.baseXdr);
      expect(req.payload).toBeNull();
    });
  });

  describe("simulateMultiSigAssembly", () => {
    it("returns zero unique signers for empty input", () => {
      const sim = simulateMultiSigAssembly([]);
      expect(sim.uniqueSigners).toBe(0);
      expect(sim.duplicates).toEqual([]);
    });

    it("counts unique signers and reports no duplicates", () => {
      const splitA: NetworkSyncMultiSigSplit = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "h1",
      });
      const splitB: NetworkSyncMultiSigSplit = createMultiSigSplit(validBase64(80), {
        publicKey: "GDEF",
        hint: "h2",
      });
      const sim = simulateMultiSigAssembly([splitA, splitB]);
      expect(sim.uniqueSigners).toBe(2);
      expect(sim.duplicates).toEqual([]);
    });

    it("detects a duplicate signer and reports it once", () => {
      const splitA = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "h1",
      });
      const splitDup = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "h1",
      });
      const splitB = createMultiSigSplit(validBase64(80), {
        publicKey: "GDEF",
        hint: "h2",
      });
      const sim = simulateMultiSigAssembly([splitA, splitDup, splitB]);
      expect(sim.uniqueSigners).toBe(2);
      expect(sim.duplicates).toEqual([{ publicKey: "GABC", hint: "h1" }]);
    });
  });

  describe("validateMultiSigAssembly", () => {
    it("accepts a default 2-of-2 assembly", () => {
      const splits = [
        createMultiSigSplit(validBase64(160), {
          publicKey: "GABC",
          hint: "h1",
        }),
        createMultiSigSplit(validBase64(160), {
          publicKey: "GDEF",
          hint: "h2",
        }),
      ];
      const result = validateMultiSigAssembly(splits);
      expect(result.uniqueSigners).toBe(2);
      expect(result.splitsValidated).toBe(2);
    });

    it("rejects a single-signer assembly with insufficient_signatures", () => {
      const splits = [
        createMultiSigSplit(validBase64(80), {
          publicKey: "GABC",
          hint: "h1",
        }),
      ];
      try {
        validateMultiSigAssembly(splits);
      } catch (err) {
        const e = err as NetworkSyncMultiSigStructureError;
        expect(e.code).toBe("insufficient_signatures");
        expect(e.message).toMatch(/minimum/i);
      }
    });

    it("rejects duplicate signers with duplicate_signer code", () => {
      const splits = [
        createMultiSigSplit(validBase64(80), {
          publicKey: "GABC",
          hint: "h1",
        }),
        createMultiSigSplit(validBase64(80), {
          publicKey: "GABC",
          hint: "h1",
        }),
        createMultiSigSplit(validBase64(80), {
          publicKey: "GDEF",
          hint: "h2",
        }),
      ];
      try {
        validateMultiSigAssembly(splits);
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("duplicate_signer");
      }
    });

    it("accepts a custom minRequired=1 for single-signer flows", () => {
      const splits = [
        createMultiSigSplit(validBase64(80), {
          publicKey: "GABC",
          hint: "h1",
        }),
      ];
      const result = validateMultiSigAssembly(splits, { minRequired: 1 });
      expect(result.uniqueSigners).toBe(1);
      expect(result.splitsValidated).toBe(1);
    });

    it("propagates invalid_base64 from a malformed split", () => {
      const splitOk = createMultiSigSplit(validBase64(80), {
        publicKey: "GABC",
        hint: "h1",
      });
      const splitBad: NetworkSyncMultiSigSplit = {
        baseXdr: "AAA@",
        signer: { publicKey: "GDEF", hint: "h2" },
        signedXdr: "AAA@",
      };
      try {
        validateMultiSigAssembly([splitOk, splitBad]);
      } catch (err) {
        expect((err as NetworkSyncMultiSigStructureError).code).toBe("invalid_base64");
      }
    });

    it("propagates decorator_mismatch through parseOptions", () => {
      const splits = [
        createMultiSigSplit(validBase64(160), {
          publicKey: "GABC",
          hint: "h1",
        }),
        createMultiSigSplit(validBase64(160), {
          publicKey: "GDEF",
          hint: "h2",
        }),
      ];
      expect(() =>
        validateMultiSigAssembly(splits, {
          parseOptions: { expectedSignatures: 7 },
        })
      ).toThrowError(NetworkSyncMultiSigStructureError);
    });
  });
});
