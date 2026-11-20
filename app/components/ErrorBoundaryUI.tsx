"use client";

/**
 * Shared presentational component for all route-group error boundaries.
 *
 * Keeps the visual treatment (heading, message, buttons) consistent between
 * app/(app)/error.tsx and app/(marketing)/error.tsx without duplicating
 * markup. Each error.tsx file is still required at its own route-group root
 * by Next.js; they just delegate rendering here.
 */

import Link from "next/link";
import LandingLogo from "@/app/components/LandingLogo";

export interface ErrorBoundaryUIProps {
  /** The error that was caught. */
  error: Error & { digest?: string };
  /** Next.js-provided callback to attempt re-rendering the segment. */
  reset: () => void;
}

export default function ErrorBoundaryUI({ error, reset }: ErrorBoundaryUIProps) {
  return (
    <div
      className="min-h-screen bg-surface-page text-text-primary flex flex-col items-center justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <LandingLogo size={48} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
          <p className="text-text-secondary text-sm">
            An unexpected error occurred. You can try again or return to the dashboard.
          </p>
          {error.digest && (
            <p className="text-text-muted text-xs font-mono">Reference: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-accent text-text-primary text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-surface-card border border-border-subtle text-text-secondary text-sm font-medium transition-colors hover:text-text-primary hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
