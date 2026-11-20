"use client";

/**
 * Error boundary for all routes inside app/(marketing)/ — the landing page.
 *
 * Next.js calls this when an unhandled error surfaces in a segment nested
 * beneath the (marketing) layout. It inherits the root layout's <html> and
 * <body> so it does NOT define those itself.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/error
 */

import { useEffect } from "react";
import ErrorBoundaryUI from "@/app/components/ErrorBoundaryUI";
import { reportClientError } from "@/app/lib/errorReporter";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      source: "render",
      message: error.message || error.name || "Unknown render error",
    });
  }, [error]);

  return <ErrorBoundaryUI error={error} reset={reset} />;
}
