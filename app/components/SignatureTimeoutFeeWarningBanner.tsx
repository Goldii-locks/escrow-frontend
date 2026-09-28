"use client";

import {
  inspectSignatureFee,
  DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS,
  type SignatureFeeSeverity,
  type SignatureTimeoutSimulationResult,
} from "@/app/lib/signature_timeout_alert";

interface Props {
  /** Simulation result inspected for fee warnings. */
  simulation: SignatureTimeoutSimulationResult | null | undefined;
  /** Override the default fee limit (stroops). Defaults to {@link DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS}. */
  feeLimitStroops?: number;
  className?: string;
}

const SEVERITY_CLASSES: Record<SignatureFeeSeverity, string> = {
  none: "",
  elevated: "bg-warning/20 border-warning text-warning-soft",
  exceeded: "bg-warning/40 border-warning text-warning-soft",
  error: "bg-danger/30 border-danger text-danger-soft",
};

/**
 * Warning banner rendered by signature_timeout_alert when the simulation
 * result behind a pending signature request reports a fee outside standard
 * bounds, or when the simulation itself failed.
 */
export default function SignatureTimeoutFeeWarningBanner({
  simulation,
  feeLimitStroops = DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS,
  className = "",
}: Props) {
  const state = inspectSignatureFee(simulation, feeLimitStroops);

  if (!state.hasWarning || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="signature-timeout-fee-warning-banner"
      data-severity={state.severity}
      role="alert"
      className={`border px-4 py-3 rounded-lg text-sm ${SEVERITY_CLASSES[state.severity]} ${className}`}
    >
      <span aria-hidden="true">⚠️</span> {state.warningMessage}
    </div>
  );
}
