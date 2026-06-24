"use client";

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
}

/**
 * Status badge styles.
 *
 * Colour contrast audit (WCAG AA, 4.5:1 for normal text):
 *   Pending  – text-yellow-300 (#fde047) on bg-gray-900 (#111827) → ~9.5:1  ✓
 *   Delivered– text-blue-300   (#93c5fd) on bg-gray-900             → ~7.4:1  ✓
 *   Released – text-green-300  (#86efac) on bg-gray-900             → ~8.9:1  ✓
 *   Disputed – text-red-300    (#fca5a5) on bg-gray-900             → ~6.4:1  ✓
 *   Refunded – text-gray-300   (#d1d5db) on bg-gray-900             → ~8.1:1  ✓
 *
 * Upgraded from *-400 to *-300 variants to clear the 4.5:1 threshold on
 * the dark card background used throughout the app.
 */
const statusStyles: Record<string, string> = {
  Pending:
    "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  Delivered:
    "bg-blue-500/10 text-blue-300 border-blue-500/30",
  Released:
    "bg-green-500/10 text-green-300 border-green-500/30",
  Disputed:
    "bg-red-500/10 text-red-300 border-red-500/30",
  Refunded:
    "bg-gray-500/10 text-gray-300 border-gray-500/30",
};

/** Human-readable milestone number (1-indexed). */
function milestoneLabel(index: number) {
  return `Milestone ${index + 1}`;
}

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  onMarkDelivered,
  onApprove,
  onDispute,
}: Props) {
  const label = milestoneLabel(milestone.index);
  const badgeStyle =
    statusStyles[milestone.status] ??
    "bg-gray-800 text-gray-300 border-gray-600";

  const canMarkDelivered = isFreelancer && milestone.status === "Pending";
  const canApprove = isClient && milestone.status === "Delivered";
  const canDispute =
    (isClient || isFreelancer) &&
    ["Pending", "Delivered"].includes(milestone.status);

  return (
    /*
     * role="article" – each card is a self-contained, individually labelled
     * piece of content within the milestone list.
     * aria-label – ties the accessible name to the specific milestone so
     * screen readers announce "Milestone 1 – Pending" rather than a
     * generic container.
     */
    <article
      className="border border-gray-800 rounded-lg p-4 bg-gray-900 flex items-center justify-between gap-4"
      aria-label={`${label} – ${milestone.status}`}
    >
      {/* ── Left: milestone identity ─────────────────────────────────── */}
      <div>
        {/*
         * Using <h3> so the milestone name participates in the document
         * heading hierarchy (Dashboard h1 → Job h2 → Milestone h3).
         * text-gray-300 instead of text-gray-400 for contrast compliance.
         */}
        <h3 className="text-sm text-gray-300">{label}</h3>
        <p className="font-mono text-white text-sm mt-1">
          {milestone.amount}{" "}
          {/* "stroops" is a technical unit; wrap in an abbr for clarity */}
          <abbr title="Stellar stroops (1 XLM = 10,000,000 stroops)">
            stroops
          </abbr>
        </p>
      </div>

      {/* ── Right: status badge + action buttons ─────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap justify-end">
        {/*
         * role="status" – live region so assistive technologies announce
         * status changes without requiring focus.
         * aria-label on the <span> gives context beyond the bare word.
         */}
        <span
          role="status"
          aria-label={`${label} status: ${milestone.status}`}
          className={`text-xs px-2 py-1 rounded-full border ${badgeStyle}`}
        >
          {milestone.status}
        </span>

        {canMarkDelivered && (
          <button
            type="button"
            onClick={() => onMarkDelivered?.(milestone.index)}
            aria-label={`Mark ${label} as delivered`}
            className="text-xs bg-blue-600 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
          >
            Mark Delivered
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            onClick={() => onApprove?.(milestone.index)}
            aria-label={`Approve ${label}`}
            className="text-xs bg-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
          >
            Approve
          </button>
        )}

        {canDispute && (
          <button
            type="button"
            onClick={() => onDispute?.(milestone.index)}
            aria-label={`Dispute ${label}`}
            className="text-xs bg-red-800 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
          >
            Dispute
          </button>
        )}
      </div>
    </article>
  );
}
