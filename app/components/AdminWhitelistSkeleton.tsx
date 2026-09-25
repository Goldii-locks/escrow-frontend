interface AdminWhitelistSkeletonProps {
  /** `panel` mirrors the whole admin view; `list` only the token list rows. */
  variant?: "panel" | "list";
  /** Number of placeholder token rows. */
  rows?: number;
  /** Accessible / screen-reader label announced while loading. */
  label?: string;
}

function TokenRowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-2" data-testid="admin-whitelist-skeleton-rows">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          data-testid="admin-whitelist-skeleton-row"
          className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-4 py-3"
        >
          <div className="h-4 w-2/3 min-w-0 rounded bg-gray-700/60" />
          <div className="h-11 w-20 shrink-0 rounded-lg bg-gray-700/40" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Placeholder wireframe for the admin whitelist panel while data loads.
 * Mirrors the real layout (add-token form + token list) so nothing shifts
 * when content arrives.
 */
export default function AdminWhitelistSkeleton({
  variant = "panel",
  rows = 3,
  label = "Loading whitelist",
}: AdminWhitelistSkeletonProps) {
  if (variant === "list") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        data-testid="admin-whitelist-skeleton"
        className="animate-pulse motion-reduce:animate-none"
      >
        <span className="sr-only">{label}…</span>
        <TokenRowsSkeleton rows={rows} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="admin-whitelist-skeleton"
      className="animate-pulse space-y-8 motion-reduce:animate-none"
    >
      <span className="sr-only">{label}…</span>
      <div
        data-testid="admin-whitelist-skeleton-form"
        className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6"
      >
        <div className="h-5 w-24 rounded bg-gray-700/60" />
        <div className="h-4 w-40 rounded bg-gray-700/40" />
        <div className="h-10 w-full rounded-lg bg-gray-800" />
        <div className="h-12 w-full rounded-lg bg-gray-700/50" />
      </div>
      <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="h-5 w-40 rounded bg-gray-700/60" />
        <TokenRowsSkeleton rows={rows} />
      </div>
    </div>
  );
}
