export default function LoadingSkeleton() {
    return (
        <div className="animate-pulse" role="status" aria-live="polite" data-testid="loading-skeleton">
            <span className="sr-only">Loading job data…</span>
            <div className="border border-border-strong rounded-xl bg-surface-card p-6 space-y-6" aria-hidden="true" data-testid="skeleton-container">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="h-6 w-32 bg-surface-field rounded mb-2" data-testid="skeleton-header-title"></div>
                        <div className="h-4 w-24 bg-surface-field rounded" data-testid="skeleton-header-subtitle"></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="skeleton-stats-grid">
                    <div className="bg-surface-field rounded-lg p-3" data-testid="skeleton-stat-card-0">
                        <div className="h-4 w-12 bg-border-subtle rounded mb-2" data-testid="skeleton-stat-label-0"></div>
                        <div className="h-4 w-28 bg-border-subtle rounded" data-testid="skeleton-stat-value-0"></div>
                    </div>
                    <div className="bg-surface-field rounded-lg p-3" data-testid="skeleton-stat-card-1">
                        <div className="h-4 w-12 bg-border-subtle rounded mb-2" data-testid="skeleton-stat-label-1"></div>
                        <div className="h-4 w-28 bg-border-subtle rounded" data-testid="skeleton-stat-value-1"></div>
                    </div>
                    <div className="bg-surface-field rounded-lg p-3" data-testid="skeleton-stat-card-2">
                        <div className="h-4 w-12 bg-border-subtle rounded mb-2" data-testid="skeleton-stat-label-2"></div>
                        <div className="h-4 w-28 bg-border-subtle rounded" data-testid="skeleton-stat-value-2"></div>
                    </div>
                </div>
                <div className="space-y-4" data-testid="skeleton-milestones">
                    <div className="border border-border-strong rounded-lg p-4 bg-surface-card" data-testid="skeleton-milestone-card-0">
                        <div className="h-4 w-24 bg-surface-field rounded mb-2" data-testid="skeleton-milestone-title-0"></div>
                        <div className="h-4 w-32 bg-surface-field rounded" data-testid="skeleton-milestone-amount-0"></div>
                    </div>
                    <div className="border border-border-strong rounded-lg p-4 bg-surface-card" data-testid="skeleton-milestone-card-1">
                        <div className="h-4 w-24 bg-surface-field rounded mb-2" data-testid="skeleton-milestone-title-1"></div>
                        <div className="h-4 w-32 bg-surface-field rounded" data-testid="skeleton-milestone-amount-1"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
