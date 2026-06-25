"use client";

export interface MilestoneValidationErrors {
  /** Amount is empty or not a valid positive integer */
  invalidAmount?: string;
  /** Status value is not one of the known enum values */
  unknownStatus?: string;
  /** Action is not permitted for the current role (e.g. client trying to mark delivered) */
  unauthorizedAction?: string;
  /** Generic catch-all for any other configuration problems */
  configError?: string;
}

interface Milestone {
  index: number;
  amount: string;
  status: string;
}

interface Props {
  milestone: Milestone;
  isClient: boolean;
  isFreelancer: boolean;
  onMarkDelivered?: (i: number) => void;
  onApprove?: (i: number) => void;
  onDispute?: (i: number) => void;
  /** Validation errors to surface inside this card */
  validationErrors?: MilestoneValidationErrors;
}

const KNOWN_STATUSES = ["Pending", "Delivered", "Released", "Disputed", "Refunded"];

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Released: "bg-green-500/10 text-green-400 border-green-500/20",
  Disputed: "bg-red-500/10 text-red-400 border-red-500/20",
  Refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

/**
 * Derives validation errors from milestone data and role flags.
 * Returns null when there are no errors.
 */
export function validateMilestone(
  milestone: Milestone,
  isClient: boolean,
  isFreelancer: boolean
): MilestoneValidationErrors | null {
  const errors: MilestoneValidationErrors = {};

  // Amount must be a non-empty string representing a positive integer (stroops)
  const amountNum = Number(milestone.amount);
  if (
    !milestone.amount ||
    milestone.amount.trim() === "" ||
    !Number.isInteger(amountNum) ||
    amountNum <= 0
  ) {
    errors.invalidAmount = "Amount must be a positive whole number (stroops).";
  }

  // Status must be a recognised value
  if (!KNOWN_STATUSES.includes(milestone.status)) {
    errors.unknownStatus = `Unknown status "${milestone.status}". Expected one of: ${KNOWN_STATUSES.join(", ")}.`;
  }

  // Role conflict: both isClient and isFreelancer should not be true at once
  if (isClient && isFreelancer) {
    errors.unauthorizedAction =
      "A single address cannot be both client and freelancer on the same milestone.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  onMarkDelivered,
  onApprove,
  onDispute,
  validationErrors: externalErrors,
}: Props) {
  // Merge auto-derived errors with any errors passed in from the parent
  const derived = validateMilestone(milestone, isClient, isFreelancer);
  const merged: MilestoneValidationErrors = { ...derived, ...externalErrors };
  const errorMessages = Object.values(merged).filter(Boolean) as string[];
  const hasErrors = errorMessages.length > 0;

  return (
    <div
      data-testid="milestone-card"
      className="
        border border-gray-800 rounded-lg p-4 bg-gray-900
        flex flex-col gap-3
        sm:flex-row sm:items-center sm:justify-between sm:gap-4
      "
    >
      {/* Milestone info */}
      <div className="min-w-0">
        <p className="text-sm text-gray-400">Milestone {milestone.index + 1}</p>
        <p className="font-mono text-white text-sm mt-1 truncate">
          {milestone.amount} stroops
        </p>
      </div>

      {/* Status badge + action buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
            statusColor[milestone.status] ?? "bg-gray-800 text-gray-400"
          }`}
        >
          {milestone.status}
        </span>

        {isFreelancer && milestone.status === "Pending" && (
          <button
            onClick={() => onMarkDelivered?.(milestone.index)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            Mark Delivered
          </button>
        )}

        {isClient && milestone.status === "Delivered" && (
          <button
            onClick={() => onApprove?.(milestone.index)}
            className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            Approve
          </button>
        )}

        {(isClient || isFreelancer) &&
          ["Pending", "Delivered"].includes(milestone.status) && (
            <button
              onClick={() => onDispute?.(milestone.index)}
              className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Dispute
            </button>
          )}
      </div>
    </div>
  );
}
