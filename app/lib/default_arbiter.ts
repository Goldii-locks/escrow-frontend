import { StrKey } from "@stellar/stellar-sdk";

/**
 * Platform arbitration address offered as the recommended arbiter on the
 * create form, from NEXT_PUBLIC_DEFAULT_ARBITER. Returns null when unset or
 * not a valid Stellar G… or C… address (the same check validateArbiterAddress
 * uses), in which case only a custom arbiter is offered.
 */
export function getDefaultArbiter(): string | null {
  const value = process.env.NEXT_PUBLIC_DEFAULT_ARBITER?.trim() ?? "";
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value) ? value : null;
}
