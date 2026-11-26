import TransactionHash from "@/app/components/TransactionHash";
import { ActionState } from "@/app/hooks/useActionStates";
import { getPhaseLabel } from "@/app/lib/transactions";

interface Props {
  state: ActionState;
  successMessage?: string;
  /** Network passphrase used to decide whether an explorer link exists. */
  passphrase?: string;
  className?: string;
}

export default function TxStatusBanner({
  state,
  successMessage = "Transaction submitted successfully.",
  passphrase,
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
          <TransactionHash txHash={txHash} passphrase={passphrase} className="text-indigo-400" />
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
