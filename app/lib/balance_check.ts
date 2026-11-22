import { formatBaseUnits } from "@/app/lib/amounts";

export function sumBaseUnits(values: string[]): string | null {
  let total = BigInt(0);
  let found = false;
  for (const value of values) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    total += BigInt(trimmed);
    found = true;
  }
  return found ? total.toString() : null;
}

export function hasInsufficientBalance(balance: string | null, required: string | null): boolean {
  if (balance === null || required === null) return false;
  if (!/^\d+$/.test(balance) || !/^\d+$/.test(required)) return false;
  return BigInt(balance) < BigInt(required);
}

export function formatTokenAmount(
  amount: string | null,
  options?: { decimals?: number; symbol?: string }
): string {
  if (amount === null) return "—";
  const value = formatBaseUnits(amount, { decimals: options?.decimals });
  return options?.symbol ? `${value} ${options.symbol}` : value;
}

export function insufficientBalanceMessage(
  balance: string | null,
  required: string | null,
  options?: { decimals?: number; symbol?: string }
): string {
  return `Insufficient balance: you have ${formatTokenAmount(balance, options)}, need ${formatTokenAmount(required, options)}`;
}
