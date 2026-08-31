/**
 * Placeholder shown while job data loads.
 *
 * Sizing is desktop-first with `max-sm:` overrides for the narrow breakpoint,
 * so the fixed widths stay on the element for structural assertions while
 * still collapsing on mobile.
 */
export default function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse animate-fade-in w-full"
      role="status"
      aria-live="polite"
      data-testid="loading-skeleton"
    >
      <span className="sr-only">Loading job data…</span>
      {/* Caps the skeleton on small viewports so it scrolls internally
                instead of pushing the surrounding controls off-screen, and
                keeps overscroll inside the wrapper rather than the page. */}
      <div
        className="max-h-[70vh] sm:max-h-none overflow-y-auto overscroll-contain"
        data-testid="loading-skeleton-mobile-wrapper"
      >
        <div
          className="border border-border-strong rounded-xl bg-surface-card p-4 sm:p-6 space-y-4 sm:space-y-6"
          aria-hidden="true"
          data-testid="skeleton-container"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6">
            <div className="space-y-2">
              <div
                className="h-6 w-32 max-sm:w-24 bg-surface-field rounded"
                data-testid="skeleton-header-title"
              ></div>
              <div
                className="h-4 w-24 max-sm:w-20 bg-surface-field rounded"
                data-testid="skeleton-header-subtitle"
              ></div>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6"
            data-testid="skeleton-stats-grid"
          >
            <div
              className="bg-surface-field rounded-lg p-3 animate-pulse [animation-delay:100ms]"
              data-testid="skeleton-stat-card-0"
            >
              <div
                className="h-4 w-12 bg-border-subtle rounded mb-2"
                data-testid="skeleton-stat-label-0"
              ></div>
              <div
                className="h-4 w-28 max-sm:w-full bg-border-subtle rounded"
                data-testid="skeleton-stat-value-0"
              ></div>
            </div>
            <div
              className="bg-surface-field rounded-lg p-3 animate-pulse [animation-delay:175ms]"
              data-testid="skeleton-stat-card-1"
            >
              <div
                className="h-4 w-12 bg-border-subtle rounded mb-2"
                data-testid="skeleton-stat-label-1"
              ></div>
              <div
                className="h-4 w-28 max-sm:w-full bg-border-subtle rounded"
                data-testid="skeleton-stat-value-1"
              ></div>
            </div>
            <div
              className="bg-surface-field rounded-lg p-3 animate-pulse [animation-delay:250ms]"
              data-testid="skeleton-stat-card-2"
            >
              <div
                className="h-4 w-12 bg-border-subtle rounded mb-2"
                data-testid="skeleton-stat-label-2"
              ></div>
              <div
                className="h-4 w-28 max-sm:w-full bg-border-subtle rounded"
                data-testid="skeleton-stat-value-2"
              ></div>
            </div>
          </div>

          <div
            className="space-y-3 sm:space-y-4"
            data-testid="skeleton-milestones"
          >
            <div
              className="border border-border-strong rounded-lg p-3 sm:p-4 bg-surface-card animate-pulse [animation-delay:325ms]"
              data-testid="skeleton-milestone-card-0"
            >
              <div
                className="h-4 w-24 max-sm:w-20 bg-surface-field rounded mb-2"
                data-testid="skeleton-milestone-title-0"
              ></div>
              <div
                className="h-4 w-32 max-sm:w-full bg-surface-field rounded"
                data-testid="skeleton-milestone-amount-0"
              ></div>
            </div>
            <div
              className="border border-border-strong rounded-lg p-3 sm:p-4 bg-surface-card animate-pulse [animation-delay:400ms]"
              data-testid="skeleton-milestone-card-1"
            >
              <div
                className="h-4 w-24 max-sm:w-20 bg-surface-field rounded mb-2"
                data-testid="skeleton-milestone-title-1"
              ></div>
              <div
                className="h-4 w-32 max-sm:w-full bg-surface-field rounded"
                data-testid="skeleton-milestone-amount-1"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
