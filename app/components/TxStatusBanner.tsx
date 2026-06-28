import { getStellarExpertTxUrl } from "@/app/lib/stellar";
import { ActionState } from "@/app/hooks/useActionStates";
import { getPhaseLabel } from "@/app/lib/transactions";

interface Props {
  state: ActionState;
  successMessage?: string;
  className?: string;
}

export default function TxStatusBanner({
  state,
  successMessage = "Transaction submitted successfully.",
  className = "",
}: Props) {
  const { phase, error, txHash } = state;

  if (phase === "error" && error) {
    return (
      <p
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`text-sm text-danger-soft bg-danger-soft/10 border border-danger-soft/20 rounded-lg px-3 py-2 ${className}`}
      >
        {error}
      </p>
    );
  }

  if (phase === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`text-sm text-success-soft bg-success-soft/10 border border-success-soft/20 rounded-lg px-3 py-2 space-y-1 ${className}`}
      >
        <p>{successMessage}</p>
        {txHash && (
          <a
            href={getStellarExpertTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-soft hover:text-accent-soft-hover underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
          >
            View on Stellar Expert
          </a>
        )}
      </div>
    );
  }

  const label = getPhaseLabel(phase);
  if (label) {
    return (
      <p
        className={`text-sm text-text-muted ${className}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {label}
      </p>
    );
  }

  return null;
}
