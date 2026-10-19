import { describe, expect, it } from "vitest";
import {
  parseMultiSigTxPayload,
  evaluateMultiSigAssembly,
  MultiSigTxPayload,
} from "@/app/lib/ledger_usb_bridge";

describe("ledger_usb_bridge - MultiSig Transaction Helpers", () => {
  const validPayload: MultiSigTxPayload = {
    signatures: [
      { publicKey: "pubkey_1", signature: "sig_1" },
      { publicKey: "pubkey_2" },
    ],
    threshold: 2,
    rawTransaction: "0x1234567890abcdef",
  };

  it("should successfully parse valid multi-sig transaction payloads", () => {
    const parsed = parseMultiSigTxPayload(validPayload);
    expect(parsed.threshold).toBe(2);
    expect(parsed.signatures.length).toBe(2);
  });

  it("should throw error if payload threshold is invalid", () => {
    expect(() => {
      parseMultiSigTxPayload({ ...validPayload, threshold: 0 });
    }).toThrow("threshold must be a positive number");
  });

  it("should throw error if rawTransaction is missing", () => {
    expect(() => {
      parseMultiSigTxPayload({ ...validPayload, rawTransaction: "" });
    }).toThrow("rawTransaction must be a non-empty string");
  });

  it("should evaluate multi-sig assembly readiness correctly", () => {
    const incompleteAssembly = evaluateMultiSigAssembly(validPayload);
    expect(incompleteAssembly.isReady).toBe(false);
    expect(incompleteAssembly.validSignaturesCount).toBe(1);

    const completePayload: MultiSigTxPayload = {
      ...validPayload,
      signatures: [
        { publicKey: "pubkey_1", signature: "sig_1" },
        { publicKey: "pubkey_2", signature: "sig_2" },
      ],
    };
    const readyAssembly = evaluateMultiSigAssembly(completePayload);
    expect(readyAssembly.isReady).toBe(true);
    expect(readyAssembly.validSignaturesCount).toBe(2);
  });
});
