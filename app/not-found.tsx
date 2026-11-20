/**
 * Root-level 404 page.
 *
 * Next.js renders this for any URL that matches no route. It runs under the
 * root layout (app/layout.tsx) but outside any route group, so WalletProvider
 * is NOT available. Navbar calls useWallet() and would throw here, so we use
 * LandingNav instead — it is a pure client component with no wallet context
 * dependency.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */

import Link from "next/link";
import LandingNav from "@/app/components/LandingNav";
import LandingLogo from "@/app/components/LandingLogo";

export const metadata = {
  title: "Page not found · Milestone Escrow",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary flex flex-col">
      <LandingNav />

      <main
        className="flex-1 flex flex-col items-center justify-center px-4 text-center"
        aria-labelledby="not-found-heading"
      >
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <LandingLogo size={56} />
          </div>

          <div className="space-y-3">
            <p className="text-6xl font-bold text-accent-soft tabular-nums" aria-hidden="true">
              404
            </p>
            <h1 id="not-found-heading" className="text-2xl font-bold text-text-primary">
              Page not found
            </h1>
            <p className="text-text-secondary text-sm max-w-sm mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-lg bg-accent text-text-primary text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-lg bg-surface-card border border-border-subtle text-text-secondary text-sm font-medium transition-colors hover:text-text-primary hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              Go to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
