"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ID, FACTORY_CONTRACT_ID } from "@/app/lib/transactions";
import { fetchWhitelistedTokens, type WhitelistToken } from "@/app/lib/whitelist";
import { validateTokenContract, type TokenValidationResult } from "@/app/lib/token_validation";
import { TOKEN_CONTRACT_PATTERN, type TokenStatus } from "./validation";

const TOKEN_VALIDATION_DEBOUNCE_MS = 500;

/**
 * Loads the accepted-token whitelist (the escrow factory's allowed tokens when
 * one is configured) and, for a well-formed token that isn't
 * on it, validates the contract as SEP-41 and tracks the user's explicit
 * confirmation (#668).
 */
export function useTokenCheck(token: string) {
  const [whitelist, setWhitelist] = useState<WhitelistToken[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(true);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  // Validation result and confirmation are keyed by the token they belong to,
  // so changing the token invalidates both without resetting state in an effect.
  const [tokenCheck, setTokenCheck] = useState<{
    token: string;
    result: TokenValidationResult;
  } | null>(null);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        // New escrows are created through the factory, which only accepts
        // its own allowed tokens.
        const tokens = await fetchWhitelistedTokens(FACTORY_CONTRACT_ID || CONTRACT_ID, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setWhitelist(tokens);
        setWhitelistError(null);
      } catch {
        if (controller.signal.aborted) return;
        setWhitelistError("Could not load the accepted-token whitelist.");
      } finally {
        if (!controller.signal.aborted) setWhitelistLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const listed = whitelist.some((option) => option.address === token);
  const whitelisted = !whitelistLoading && !whitelistError && whitelist.length > 0 && listed;
  const needsValidation = TOKEN_CONTRACT_PATTERN.test(token) && !listed;
  const validation = tokenCheck?.token === token ? tokenCheck.result : null;
  const validating = needsValidation && validation === null;
  const confirmed = confirmedToken === token;

  // Debounced so the SEP-41 simulation doesn't fire on every keystroke.
  useEffect(() => {
    if (!needsValidation) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      let result: TokenValidationResult;
      try {
        result = await validateTokenContract(token);
      } catch {
        result = { valid: false, error: "Failed to validate this contract as a token." };
      }
      if (!cancelled) setTokenCheck({ token, result });
    }, TOKEN_VALIDATION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, needsValidation]);

  const status: TokenStatus = { token, whitelisted, validating, validation, confirmed };

  return {
    whitelist,
    whitelistLoading,
    whitelistError,
    /** The token appears in the whitelist, whatever its load state. */
    listed,
    status,
    setConfirmed: (value: boolean) => setConfirmedToken(value ? token : null),
  };
}
