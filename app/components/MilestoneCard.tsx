"use client";

import { useState } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { ActionState } from "@/app/hooks/useActionStates";
import { getPhaseLabel } from "@/app/lib/transactions";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

interface Props {
  milestone: Milestone;
  isClient: boolean;
  isFreelancer: boolean;
  partialReleaseState: ActionState;
  claimAutoReleaseState: ActionState;
  isPartialReleasePending: boolean;
  isClaimAutoReleasePending: boolean;
  onPartialRelease?: (index: number, amount: string) => void;
  onClaimAutoRelease?: (index: number) => void;
  onMarkDelivered?: (i: number) => void;
  onApprove?: (i: number) => void;
  onDispute?: (i: number) => void;
}

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PartiallyReleased: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Released: "bg-green-500/10 text-green-400 border-green-500/20",
  Disputed: "bg-red-500/10 text-red-400 border-red-500/20",
  Refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  partialReleaseState,
  claimAutoReleaseState,
  isPartialReleasePending,
  isClaimAutoReleasePending,
  onPartialRelease,
  onClaimAutoRelease,
  onMarkDelivered,
  onApprove,
  onDispute,
}: Props) {
  const [partialAmount, setPartialAmount] = useState("");

  const canPartialRelease =
    isClient &&
    ["Delivered", "PartiallyReleased"].includes(milestone.status);

  const canClaimAutoRelease =
    isFreelancer && milestone.status === "Delivered";

  const released = milestone.releasedAmount ?? "0";
  const remaining = BigInt(milestone.amount) - BigInt(released);

  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">Milestone {milestone.index + 1}</p>
          <p className="font-mono text-white text-sm mt-1">
            {milestone.amount} stroops
          </p>
          {BigInt(released) > BigInt(0) && (
            <p className="text-xs text-gray-500 mt-1">
              Released: {released} · Remaining: {remaining.toString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              statusColor[milestone.status] || "bg-gray-800 text-gray-400"
            }`}
          >
            {milestone.status}
          </span>
          {isFreelancer && milestone.status === "Pending" && (
            <button
              onClick={() => onMarkDelivered?.(milestone.index)}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition"
            >
              Mark Delivered
            </button>
          )}
          {isClient && ["Delivered", "PartiallyReleased"].includes(milestone.status) && (
            <button
              onClick={() => onApprove?.(milestone.index)}
              className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg transition"
            >
              Approve Full
            </button>
          )}
          {(isClient || isFreelancer) &&
            ["Pending", "Delivered", "PartiallyReleased"].includes(milestone.status) && (
              <button
                onClick={() => onDispute?.(milestone.index)}
                className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded-lg transition"
              >
                Dispute
              </button>
            )}
        </div>
      </div>

      {canPartialRelease && (
        <div className="border-t border-gray-800 pt-3 space-y-2">
          <p className="text-xs text-gray-400">Partial Release</p>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="number"
              min="1"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              disabled={isPartialReleasePending}
              placeholder="Amount (stroops)"
              className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              aria-label={`Partial release amount for milestone ${milestone.index + 1}`}
            />
            <button
              onClick={() => onPartialRelease?.(milestone.index, partialAmount)}
              disabled={isPartialReleasePending || !partialAmount}
              className="inline-flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
            >
              {isPartialReleasePending && <ButtonSpinner />}
              {isPartialReleasePending
                ? getPhaseLabel(partialReleaseState.phase) || "Processing..."
                : "Release Partial"}
            </button>
          </div>
          <TxStatusBanner
            state={partialReleaseState}
            successMessage="Partial release submitted successfully."
          />
        </div>
      )}

      {canClaimAutoRelease && (
        <div className="border-t border-gray-800 pt-3 space-y-2">
          <p className="text-xs text-gray-400">Auto-Release Claim</p>
          <button
            onClick={() => onClaimAutoRelease?.(milestone.index)}
            disabled={isClaimAutoReleasePending}
            className="inline-flex items-center gap-2 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
          >
            {isClaimAutoReleasePending && <ButtonSpinner />}
            {isClaimAutoReleasePending
              ? getPhaseLabel(claimAutoReleaseState.phase) || "Processing..."
              : "Claim Auto-Release"}
          </button>
          <TxStatusBanner
            state={claimAutoReleaseState}
            successMessage="Auto-release claimed successfully."
          />
        </div>
      )}
    </div>
  );
}
