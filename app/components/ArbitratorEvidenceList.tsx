"use client";

import { useEffect, useState, useTransition } from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import {
  type EvidenceItem,
  UNAUTHORIZED_ARBITRATOR_WARNING,
  isArbitratorAuthorized,
  sanitizeEvidenceInput,
  fetchArbitratorEvidence,
} from "@/app/lib/arbitrator_evidence_list";

export interface ArbitratorEvidenceListProps {
  /** Identifier of the dispute */
  disputeId: string;
  /** Currently connected wallet address */
  currentWalletAddress?: string | null;
  /** Whitelist of authorized arbiter wallet addresses */
  authorizedArbitrators?: string[];
  /** Optional initial evidence override */
  initialEvidence?: EvidenceItem[];
  /** Optional external loading flag */
  isLoading?: boolean;
  /** Optional backend API endpoint */
  apiEndpoint?: string;
  /** Callback when arbiter approves or notes an evidence item */
  onEvidenceVerified?: (evidenceId: string) => void;
  className?: string;
}

export default function ArbitratorEvidenceList({
  disputeId,
  currentWalletAddress,
  authorizedArbitrators,
  initialEvidence,
  isLoading: externalLoading = false,
  apiEndpoint,
  onEvidenceVerified,
  className = "",
}: ArbitratorEvidenceListProps) {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(initialEvidence || []);
  const [loading, setLoading] = useState<boolean>(!initialEvidence);
  const [filterRole, setFilterRole] = useState<"all" | "client" | "freelancer">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 1. Access Restriction Check (Issue #420)
  const isAuthorized = isArbitratorAuthorized(currentWalletAddress, authorizedArbitrators);

  // 2. Dynamic Data Fetching (Issue #423)
  useEffect(() => {
    if (!isAuthorized) return;
    if (initialEvidence && initialEvidence.length > 0) {
      // Both pieces of state already start from this prop, so this only fires
      // when the prop changes. Deferred through startTransition -- the same
      // treatment the fetch path below gets -- so mounting does not trigger a
      // synchronous cascading re-render.
      startTransition(() => {
        setEvidenceList(initialEvidence);
        setLoading(false);
      });
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    // Deferred for the same reason as above: on mount `loading` already starts
    // true, so this only matters when the deps change and a refetch begins.
    startTransition(() => setLoading(true));

    fetchArbitratorEvidence(disputeId, { apiUrl: apiEndpoint, signal: controller.signal })
      .then((data) => {
        if (isMounted) {
          startTransition(() => {
            setEvidenceList(data);
            setLoading(false);
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [disputeId, isAuthorized, initialEvidence, apiEndpoint]);

  // If unauthorized, display fallback warning screen (Issue #420)
  if (!isAuthorized) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center text-red-200 ${className}`}
        data-testid="arbitrator-unauthorized-warning"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 text-red-400">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Access Denied</h3>
        <p className="mt-2 text-sm text-red-300">{UNAUTHORIZED_ARBITRATOR_WARNING}</p>
        <p className="mt-1 text-xs text-gray-400">
          Current Wallet: {currentWalletAddress || "Not connected"}
        </p>
      </div>
    );
  }

  // 3. Loading skeleton state (Issue #421)
  const isCurrentlyLoading = externalLoading || loading;
  if (isCurrentlyLoading) {
    return (
      <div
        className={`space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 ${className}`}
        aria-busy="true"
        aria-label="Loading arbitrator evidence"
        data-testid="arbitrator-evidence-loading-skeletons"
      >
        <div className="flex justify-between items-center pb-4 border-b border-gray-800">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-700/60" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-700/40" />
        </div>
        <LoadingSkeleton className="h-24 w-full" aria-label="Evidence placeholder frame" />
        <LoadingSkeleton className="h-24 w-full" aria-label="Evidence placeholder frame" />
        <LoadingSkeleton className="h-24 w-full" aria-label="Evidence placeholder frame" />
      </div>
    );
  }

  // 4. Form input handler with sanitization (Issue #422)
  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Sanitize user inputs, stripping script and code tags
    const cleanTitle = sanitizeEvidenceInput(newTitle);
    const cleanDescription = sanitizeEvidenceInput(newDescription);

    if (!cleanTitle) {
      setFormError("Evidence title is required and cannot contain code tags.");
      return;
    }

    const newItem: EvidenceItem = {
      id: `evi-${Date.now()}`,
      disputeId,
      submittedBy: currentWalletAddress || "ARBITER",
      submitterRole: "client",
      title: cleanTitle,
      description: cleanDescription,
      fileUrl: "#",
      fileType: "text/plain",
      fileSize: 1024,
      uploadedAt: new Date().toISOString(),
      hash: "0x" + Math.random().toString(16).substring(2, 10),
      verified: false,
    };

    setEvidenceList((prev) => [newItem, ...prev]);
    setNewTitle("");
    setNewDescription("");
  };

  // Filter and search
  const filteredEvidence = evidenceList.filter((item) => {
    if (filterRole !== "all" && item.submitterRole !== filterRole) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.submittedBy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-gray-200 ${className}`}
      data-testid="arbitrator-evidence-list-container"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Arbitrator Evidence Files</h2>
          <p className="text-xs text-gray-400">
            Dispute #{disputeId} — Review submitted materials from parties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-900/40 px-3 py-1 text-xs font-medium text-indigo-300 border border-indigo-700/50">
            {filteredEvidence.length} items
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-800/80 p-1 w-full sm:w-auto">
          {(["all", "client", "freelancer"] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setFilterRole(role)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterRole === role
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {role === "all" ? "All Evidence" : `${role} Submissions`}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search evidence..."
          className="w-full sm:w-64 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Evidence Table / Cards */}
      <div className="mt-5 space-y-3">
        {filteredEvidence.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No evidence records found for this filter.
          </div>
        ) : (
          filteredEvidence.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 transition-colors hover:border-gray-700"
              data-testid={`evidence-item-${item.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      item.submitterRole === "client"
                        ? "bg-blue-900/50 text-blue-300 border border-blue-800"
                        : "bg-emerald-900/50 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {item.submitterRole}
                  </span>
                  <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {new Date(item.uploadedAt).toLocaleDateString()}
                </div>
              </div>

              <p className="mt-2 text-xs text-gray-300 leading-relaxed">{item.description}</p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-800/60 text-xs text-gray-400">
                <div className="flex items-center gap-3">
                  <span>Type: {item.fileType}</span>
                  <span>Size: {(item.fileSize / 1024).toFixed(1)} KB</span>
                  <span className="font-mono text-[11px] text-gray-500">Hash: {item.hash}</span>
                </div>
                <div className="flex items-center gap-2">
                  {onEvidenceVerified && (
                    <button
                      type="button"
                      onClick={() => onEvidenceVerified(item.id)}
                      className="rounded bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      {item.verified ? "Verified ✓" : "Mark Verified"}
                    </button>
                  )}
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    View File
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Evidence Note Form with sanitization (Issue #422) */}
      <form onSubmit={handleAddEvidence} className="mt-6 border-t border-gray-800 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Add Arbiter Note / Material
        </h4>

        {formError && (
          <div
            role="alert"
            className="mt-2 rounded bg-red-900/30 p-2 text-xs text-red-300 border border-red-800/40"
          >
            {formError}
          </div>
        )}

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Evidence title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Description or notes"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 focus:outline-none"
        >
          Attach Note
        </button>
      </form>
    </div>
  );
}
