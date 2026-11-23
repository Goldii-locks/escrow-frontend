/**
 * spec_hash — canonical milestone scope spec and its on-chain hash (#813).
 *
 * Each milestone's `spec_hash` is the SHA-256 of a canonical representation
 * of the milestone text so both parties can later prove what was agreed
 * (`get_milestone_spec_hash(i)` on the escrow contract).
 *
 * Canonical form: JSON with sorted keys, NFC-normalised strings, no
 * whitespace. Only `title` and `description` are hashed — amounts are not
 * part of the scope spec.
 */
export interface MilestoneSpec {
  title: string;
  description: string;
}

/** EMPTY_SPEC_HASH ("00" × 32) is kept for milestones whose spec is blank. */
export const EMPTY_SPEC_HASH = "00".repeat(32);

/** Canonicalise a milestone spec into a stable UTF-8 byte string. */
export function canonicaliseSpec(spec: MilestoneSpec): string {
  const normalise = (s: string): string => s.normalize("NFC").trim();
  const canonical: Record<string, string> = {};
  for (const key of Object.keys(spec).sort()) {
    canonical[key] = normalise((spec as Record<string, string>)[key]);
  }
  return JSON.stringify(canonical);
}

/** SHA-256 of the canonical spec, as lowercase hex. */
export async function hashSpec(spec: MilestoneSpec): Promise<string> {
  const bytes = new TextEncoder().encode(canonicaliseSpec(spec));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Spec hash for a blank milestone (title + description both empty). */
export async function blankSpecHash(): Promise<string> {
  return hashSpec({ title: "", description: "" });
}
