"use client";

import { tokenLabel } from "@/app/lib/whitelist";
import type { CreateJobForm } from "../useCreateJobForm";
import { inputClassName } from "../ui";

/**
 * Token selector — the text input and whitelist select share the same state
 * (token) but must have distinct IDs to avoid duplicate-id violations and
 * broken label associations.
 *
 * - input#token-manual: always visible, allows direct paste
 * - select#token-select: shown once the whitelist is loaded
 * - The label targets token-manual (primary control); the select is linked
 *   via aria-labelledby pointing at the shared label.
 * - Whitelist errors are associated to both controls via
 *   aria-describedby="token-whitelist-error".
 */
export default function TokenField({ form }: { form: CreateJobForm }) {
  const { loading, setActiveSection } = form;
  const { token, changeToken, blurToken, selectToken, tokenCheck } = form.details;
  const { whitelist, whitelistLoading, whitelistError, status, setConfirmed } = tokenCheck;
  const { validating, validation, whitelisted, confirmed } = status;
  const onFocus = () => setActiveSection("details");

  return (
    <div>
      <label id="token-label" htmlFor="token-manual" className="block text-sm text-text-muted mb-1">
        Token Contract Address
      </label>
      <input
        id="token-manual"
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-required="true"
        aria-describedby={whitelistError ? "token-whitelist-error" : undefined}
        className={inputClassName}
        value={token}
        onChange={(e) => changeToken(e.target.value)}
        onBlur={(e) => blurToken(e.target.value)}
        onFocus={onFocus}
        placeholder="C..."
        required
        disabled={loading}
      />
      {whitelistLoading ? (
        <select
          id="token-select"
          aria-labelledby="token-label"
          aria-busy="true"
          className={`mt-2 ${inputClassName}`}
          disabled
        >
          <option>Loading accepted tokens…</option>
        </select>
      ) : whitelistError ? (
        <p
          id="token-whitelist-error"
          role="alert"
          data-testid="token-whitelist-error"
          className="mt-1 text-sm text-danger-soft"
        >
          {whitelistError}
        </p>
      ) : whitelist.length === 0 ? (
        <p
          id="token-whitelist-empty"
          data-testid="token-whitelist-empty"
          className="mt-1 text-sm text-text-muted"
          aria-live="polite"
        >
          No accepted tokens are configured for this contract yet. Ask an admin to whitelist a token
          before creating a job.
        </p>
      ) : (
        <select
          id="token-select"
          aria-labelledby="token-label"
          className={`mt-2 ${inputClassName}`}
          value={token}
          onChange={(e) => selectToken(e.target.value)}
          onFocus={onFocus}
          required
          disabled={loading}
        >
          <option value="">Select a token</option>
          {whitelist.map((option) => (
            <option key={option.address} value={option.address}>
              {tokenLabel(option)}
            </option>
          ))}
        </select>
      )}

      {/*
       * Token validation and non-whitelist warning (issue #668). When the
       * entered address isn't on the loaded whitelist, show a prominent
       * warning and require explicit confirmation. The contract is validated
       * as a SEP-41 token via symbol() and decimals() simulation so the user
       * can verify it.
       */}
      {validating && (
        <p
          className="mt-2 text-sm text-text-muted"
          data-testid="token-validating"
          role="status"
          aria-live="polite"
        >
          Validating token contract…
        </p>
      )}
      {!validating && validation?.valid && !whitelisted && (
        <div
          className="mt-2 rounded-lg border border-warning-soft/40 bg-warning/10 p-3"
          data-testid="token-non-whitelist-warning"
        >
          <p className="text-sm font-medium text-warning-soft">
            ⚠️ This token isn&rsquo;t on the accepted list
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Token: {validation.symbol} ({validation.decimals} decimals)
          </p>
          <p className="mt-1 text-xs text-text-muted">
            The contract auto-whitelists any token passed to it. Verify this is the token you intend
            before proceeding.
          </p>
          <label className="mt-2 flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={loading}
              data-testid="token-confirm-checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border-subtle accent-accent"
            />
            <span>I confirm this is the correct token contract.</span>
          </label>
        </div>
      )}
      {!validating && validation && !validation.valid && !whitelisted && (
        <div
          className="mt-2 rounded-lg border border-danger-soft/40 bg-danger/10 p-3"
          data-testid="token-validation-error"
          role="alert"
        >
          <p className="text-sm font-medium text-danger-soft">
            This address is not a valid token contract
          </p>
          <p className="mt-1 text-xs text-text-secondary">{validation.error}</p>
        </div>
      )}
    </div>
  );
}
