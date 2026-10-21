import { parseDecimalToBaseUnits } from "./amounts";

/**
 * Validates a milestone amount string (decimal token amount, strictly greater than 0).
 * Returns an error message, or null when the value is valid. An empty value
 * returns null so untouched inputs do not show an error; callers that need a
 * value should check for emptiness separately.
 */
export function validateMilestoneAmount(raw: string, decimals = 7): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    const units = parseDecimalToBaseUnits(trimmed, decimals);
    if (units <= 0n) {
      return "Amount must be greater than 0";
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Enter a valid decimal amount";
  }
}
