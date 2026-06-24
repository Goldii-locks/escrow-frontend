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
        className={`text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 ${className}`}
      >
        {error}
      </p>
    );
  }

  if (phase === "success") {
    return (
      <div
        role="status"
        className={`text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 space-y-1 ${className}`}
      >
        <p>{successMessage}</p>
        {txHash && (
          <a
            href={getStellarExpertTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
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
      <p className={`text-sm text-gray-400 ${className}`} aria-live="polite">
        {label}
      </p>
    );
  }

  return null;
}
