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
 * Maps each milestone status to Tailwind classes that meet WCAG AA contrast
 * requirements (≥ 4.5:1) on the dark bg-gray-900 (#111827) background.
 *
 * Colour audit (text on bg-gray-900 #111827):
 *   yellow-300  #fde047  → 10.5:1  ✓
 *   blue-300    #93c5fd  → 8.1:1   ✓
 *   green-300   #86efac  → 9.1:1   ✓
 *   red-300     #fca5a5  → 7.7:1   ✓
 *   gray-300    #d1d5db  → 11.4:1  ✓
 *
 * The semi-transparent tinted backgrounds are kept for visual grouping while
 * the text colours are bumped to *-300 variants (previously *-400) to clear
 * the 4.5:1 threshold against the card's bg-gray-900 base.
 */
const statusColor: Record<string, string> = {
  Pending:   "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  Delivered: "bg-blue-500/10   text-blue-300   border-blue-500/30",
  Released:  "bg-green-500/10  text-green-300  border-green-500/30",
  Disputed:  "bg-red-500/10    text-red-300    border-red-500/30",
  Refunded:  "bg-gray-500/10   text-gray-300   border-gray-500/30",
};

/** Human-readable descriptions surfaced to screen readers via aria-label. */
const statusLabel: Record<string, string> = {
  Pending:   "Pending — awaiting delivery",
  Delivered: "Delivered — awaiting client approval",
  Released:  "Released — funds disbursed",
  Disputed:  "Disputed — under arbitration",
  Refunded:  "Refunded — funds returned",
};

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  onMarkDelivered,
  onApprove,
  onDispute,
}: Props) {
  const milestoneNumber = milestone.index + 1;
  const resolvedStatusLabel =
    statusLabel[milestone.status] ?? milestone.status;

  return (
    /**
     * `article` is the correct landmark for a self-contained, independently
     * meaningful piece of content. `aria-label` gives each card a unique
     * accessible name so screen readers can distinguish them in a list.
     */
    <article
      aria-label={`Milestone ${milestoneNumber}: ${resolvedStatusLabel}`}
      className="border border-gray-800 rounded-lg p-4 bg-gray-900 flex items-center justify-between gap-4"
    >
      {/* ── Left: milestone identity ── */}
      <div>
        {/*
         * Use a heading so assistive-technology users can navigate between
         * milestone cards via heading shortcuts (h / H in NVDA / JAWS).
         * h3 is appropriate inside a section hierarchy that starts with h1
         * (page) → h2 (job panel in dashboard).
         */}
        <h3 className="text-sm text-gray-300 font-medium">
          Milestone {milestoneNumber}
        </h3>
        <p className="font-mono text-white text-sm mt-1">
          {/* "stroops" is the unit; spelling it out in aria-label avoids
              screen readers mis-pronouncing the abbreviation */}
          <span aria-label={`${milestone.amount} stroops`}>
            {milestone.amount} stroops
          </span>
        </p>
      </div>

      {/* ── Right: status badge + action buttons ── */}
      <div className="flex items-center gap-3">
        {/*
         * role="status" implies aria-live="polite" so any dynamic status
         * change is announced without interrupting the user.
         * aria-label provides the richer description; the visible text is
         * kept short for sighted users.
         */}
        <span
          role="status"
          aria-label={resolvedStatusLabel}
          className={`text-xs px-2 py-1 rounded-full border ${
            statusColor[milestone.status] ?? "bg-gray-800 text-gray-300 border-gray-600"
          }`}
        >
          {milestone.status}
        </span>

        {/* Mark Delivered — freelancer only, Pending milestones */}
        {isFreelancer && milestone.status === "Pending" && (
          <button
            type="button"
            onClick={() => onMarkDelivered?.(milestone.index)}
            aria-label={`Mark milestone ${milestoneNumber} as delivered`}
            className="text-xs bg-blue-600 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
          >
            Mark Delivered
          </button>
        )}

        {/* Approve — client only, Delivered milestones */}
        {isClient && milestone.status === "Delivered" && (
          <button
            type="button"
            onClick={() => onApprove?.(milestone.index)}
            aria-label={`Approve milestone ${milestoneNumber} and release funds`}
            className="text-xs bg-green-700 hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
          >
            Approve
          </button>
        )}

        {/* Dispute — either role, actionable milestones */}
        {(isClient || isFreelancer) &&
          ["Pending", "Delivered"].includes(milestone.status) && (
            <button
              type="button"
              onClick={() => onDispute?.(milestone.index)}
              aria-label={`Dispute milestone ${milestoneNumber}`}
              className="text-xs bg-red-800 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white px-3 py-1 rounded-lg transition"
            >
              Dispute
            </button>
          )}
      </div>
    </article>
  );
}
