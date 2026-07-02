const DEFAULT_TOKEN_DECIMALS = 7;

function toDecimals(decimals?: number): number {
  if (typeof decimals !== "number" || !Number.isFinite(decimals) || decimals < 0) {
    return DEFAULT_TOKEN_DECIMALS;
  }
  return Math.floor(decimals);
}

function getScale(decimals?: number): bigint {
  return BigInt(10) ** BigInt(toDecimals(decimals));
}

export function parseDecimalToBaseUnits(value: string, decimals?: number): bigint {
  const input = value.trim();
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error("Enter a valid decimal amount");
  }

  const resolvedDecimals = toDecimals(decimals);
  const [wholePart, fractionPart = ""] = input.split(".");

  if (fractionPart.length > resolvedDecimals) {
    throw new Error(`Amount supports up to ${resolvedDecimals} decimal places`);
  }

  const whole = BigInt(wholePart || "0") * getScale(resolvedDecimals);
  const fraction = fractionPart
    ? BigInt(fractionPart.padEnd(resolvedDecimals, "0"))
    : BigInt(0);

  return whole + fraction;
}

export function formatBaseUnits(
  amount: string,
  options?: { decimals?: number; trimTrailingZeros?: boolean }
): string {
  if (!/^\d+$/.test(amount)) return amount;

  const resolvedDecimals = toDecimals(options?.decimals);
  const raw = BigInt(amount);
  const scale = getScale(resolvedDecimals);

  const whole = raw / scale;
  const fraction = raw % scale;

  if (resolvedDecimals === 0) return whole.toString();

  let fractionText = fraction.toString().padStart(resolvedDecimals, "0");
  if (options?.trimTrailingZeros !== false) {
    fractionText = fractionText.replace(/0+$/, "");
  }

  return fractionText.length > 0 ? `${whole.toString()}.${fractionText}` : whole.toString();
}
