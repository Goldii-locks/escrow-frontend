"use client";

/**
 * Global error boundary — Next.js renders this when an unhandled error occurs
 * in the root layout or any segment above the route-group error boundaries.
 *
 * Because it replaces the root layout, it must supply its own <html> and
 * <body>. It is intentionally standalone: no providers, no Navbar, no
 * external context — anything that depends on those might itself be broken.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
 */

import { useEffect } from "react";
import Link from "next/link";
import LandingLogo from "@/app/components/LandingLogo";
import { reportClientError } from "@/app/lib/errorReporter";

export default function GlobalError({
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

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#030712",
          color: "#f9fafb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          boxSizing: "border-box",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            width: "100%",
            maxWidth: "28rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <LandingLogo size={48} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h1
              style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}
              tabIndex={-1}
              id="global-error-heading"
            >
              Something went wrong
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#d1d5db", margin: 0 }}>
              A critical error occurred. You can try to recover below.
            </p>
            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                Reference: {error.digest}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              width: "100%",
              maxWidth: "20rem",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                backgroundColor: "#4f46e5",
                color: "#f9fafb",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#6366f1";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4f46e5";
              }}
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                backgroundColor: "#111827",
                border: "1px solid #374151",
                color: "#d1d5db",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                display: "block",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
