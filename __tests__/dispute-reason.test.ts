import { describe, expect, it } from "vitest";
import { hashDisputeReason } from "@/app/lib/dispute_reason";

describe("hashDisputeReason", () => {
  it("returns the 32-byte SHA-256 of the trimmed reason as hex", async () => {
    // sha256("abc")
    await expect(hashDisputeReason("  abc ")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("always yields 64 hex characters (BytesN<32>)", async () => {
    const hash = await hashDisputeReason("Work was not delivered");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
