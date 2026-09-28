interface EmptyStateCardProps {
  /** Test id for the card wrapper. Callers scope it to their surface. */
  testId?: string;
  /** Screen-reader label for the region. */
  ariaLabel?: string;
  title: string;
  description: string;
  /** Named illustration. Only "briefcase" is drawn today. */
  icon?: "briefcase";
  /** Optional role/context chips rendered beneath the description. */
  badges?: string[];
  className?: string;
}

function BriefcaseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-10 w-10 text-gray-500"
    >
      <rect x="2.75" y="7.25" width="18.5" height="12" rx="2" />
      <path d="M8.75 7.25V5.75a2 2 0 0 1 2-2h2.5a2 2 0 0 1 2 2v1.5" />
      <path d="M2.75 12.5h18.5" />
    </svg>
  );
}

/**
 * Descriptive empty state for a list surface.
 *
 * Carries the shared `empty-state*` test ids as well as the caller's own
 * `testId`, so surface-specific assertions and the generic empty-state
 * assertions can both address this card.
 */
export default function EmptyStateCard({
  testId = "empty-state-card",
  ariaLabel,
  title,
  description,
  icon = "briefcase",
  badges,
  className = "",
}: EmptyStateCardProps) {
  return (
    <div
      data-testid={testId}
      role="region"
      aria-label={ariaLabel}
      className={`flex flex-col items-center justify-center text-center gap-4 border border-gray-800 rounded-lg bg-surface-card p-10 animate-fade-in ${className}`}
    >
      <span data-testid="empty-state" aria-hidden="true">
        {icon === "briefcase" ? <BriefcaseIcon /> : null}
      </span>

      <p data-testid="empty-state-title" className="text-white font-semibold">
        {title}
      </p>

      <p
        data-testid="empty-state-description"
        className="text-gray-400 text-sm max-w-sm"
      >
        {description}
      </p>

      {badges && badges.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
