"use client";

import { useEffect, useState } from "react";
import { describeJobTerms, fetchJobTerms, type JobTerms } from "@/app/lib/job_terms";

/** "Terms" section for the job view: the four rules fixed at creation (#857). */
export default function JobTermsSection({ contractId }: { contractId: string }) {
  const [terms, setTerms] = useState<JobTerms | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchJobTerms(contractId, { signal: controller.signal }).then((t) => {
      if (controller.signal.aborted) return;
      setTerms(t);
      setFailed(t === null);
    });
    return () => controller.abort();
  }, [contractId]);

  return (
    <section aria-label="Job terms" className="mb-4" data-testid="job-terms">
      <h4 className="text-text-muted text-xs font-semibold mb-2">Terms</h4>
      {failed ? (
        <p className="text-xs text-text-muted">Terms are unavailable right now.</p>
      ) : !terms ? (
        <p className="text-xs text-text-muted">Loading terms…</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
          {describeJobTerms(terms).map((line) => (
            <div key={line.label} className="bg-surface-field rounded-lg p-2 sm:p-3 min-w-0">
              <dt className="text-text-muted text-xs font-semibold">{line.label}</dt>
              <dd className="font-semibold">{line.value}</dd>
              <dd className="text-text-muted text-xs">{line.description}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
