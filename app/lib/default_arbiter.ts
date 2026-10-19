const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

/**
 * Platform arbitration address offered as the recommended arbiter on the
 * create form, from NEXT_PUBLIC_DEFAULT_ARBITER. Returns null when unset or
 * not a valid Stellar public key, in which case only a custom arbiter is
 * offered.
 */
export function getDefaultArbiter(): string | null {
  const value = process.env.NEXT_PUBLIC_DEFAULT_ARBITER?.trim() ?? "";
  return STELLAR_PUBLIC_KEY.test(value) ? value : null;
}
