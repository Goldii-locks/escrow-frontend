/**
 * `raise_dispute` takes a `reason_hash: BytesN<32>`, not the reason text:
 * the contract stores only a commitment to the reason. Hash the text the
 * user typed with SHA-256 and send it as hex for the build-tx `bytes` type.
 */
export async function hashDisputeReason(reason: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(reason.trim()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
