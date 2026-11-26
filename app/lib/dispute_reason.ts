/**
 * `raise_dispute` takes a `reason_hash: BytesN<32>`, not the reason text:
 * the contract stores only a commitment to the reason. Hash the text the
 * user typed with SHA-256 and send it as hex for the build-tx `bytes` type.
 */
export async function hashDisputeReason(reason: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(reason.trim()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * #804: the contract only ever sees `reason_hash`, never the text — nobody
 * (arbiter, counterparty, or the submitter after a reload) can read the
 * original reason back. Until an escrow-backend endpoint exists to store it
 * off-chain keyed by the hash, this is the stopgap the issue asks for: let
 * the user copy or download their own reason paired with its hash right
 * after submitting, so they have evidence of what they actually wrote.
 */
export function buildDisputeReasonBackupText(reason: string, hash: string): string {
  return `Dispute Reason\n\nHash: 0x${hash}\n\nText:\n${reason.trim()}\n`;
}

/** Filename for the downloadable backup, keyed by the hash so it's unique. */
export function disputeReasonBackupFilename(hash: string): string {
  return `dispute-reason-${hash.slice(0, 12)}.txt`;
}
