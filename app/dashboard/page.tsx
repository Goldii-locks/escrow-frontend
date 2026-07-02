"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import MilestoneCard from "@/app/components/MilestoneCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import { useActionStates } from "@/app/hooks/useActionStates";
import {
  BACKEND_URL,
  runContractAction,
  submitContractTransaction,
} from "@/app/lib/transactions";
import { fetchAutoReleaseInfo } from "@/app/lib/autoRelease";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

interface Job {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  admin?: string;
  funded: boolean;
  milestones: Milestone[];
}

export default function Dashboard() {
  const { address, signTransaction } = useWallet();
  const [fetchLoading, setFetchLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getState, isPending, setPhase, setError: setActionError, setTxHash } =
    useActionStates();

  const fetchJob = useCallback(async () => {
    if (!address) {
      setFetchLoading(false);
      return;
    }

    setFetchLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/jobs/by-wallet/${address}`);
      const data = await res.json();

      if (data.success) {
        setJob(data.data);
      } else {
        setError(data.error || "Failed to fetch job data");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
    } finally {
      setFetchLoading(false);
    }
  }, [address]);

  useEffect(() => {
  let active = true;
  
  Promise.resolve().then(() => {
    if (active) {
      fetchJob();
    }
  });

  return () => {
    active = false;
  };
}, [fetchJob]);

  const isClient = !!(job && address === job.client);
  const isFreelancer = !!(job && address === job.freelancer);
  const milestoneList = Array.isArray(job?.milestones) ? job.milestones : [];
  const isArbiter = !!(job && address === job.arbiter)

  const [autoReleaseDeadlines, setAutoReleaseDeadlines] = useState<
    Record<number, number | null>
  >({});

  useEffect(() => {
    const controller = new AbortController();
    const jobId = job?.id;
    const deliveredIndexes = (Array.isArray(job?.milestones) ? job.milestones : [])
      .filter((m) => m.status === "Delivered")
      .map((m) => m.index);

    (async () => {
      if (!jobId || deliveredIndexes.length === 0) {
        // Defer so this is not a synchronous setState within the effect.
        await Promise.resolve();
        if (!controller.signal.aborted) setAutoReleaseDeadlines({});
        return;
      }

      const entries = await Promise.all(
        deliveredIndexes.map(async (index) => {
          const info = await fetchAutoReleaseInfo(jobId, index, {
            signal: controller.signal,
          });
          return [index, info.deadlineMs] as const;
        })
      );
      if (!controller.signal.aborted) {
        setAutoReleaseDeadlines(Object.fromEntries(entries));
      }
    })();

    return () => controller.abort();
  }, [job]);

  const executeTx = useCallback(
    async (actionKey: string, method: string, args: { type: string; value: unknown }[]) => {
      if (!address) return null;

      const txHash = await runContractAction(
        actionKey,
        (onPhase) =>
          submitContractTransaction({
            method,
            args,
            sourceAddress: address,
            signTransaction,
            onPhase,
          }),
        { isPending, setPhase, setError: setActionError, setTxHash }
      );

      if (txHash !== null) {
        await fetchJob();
      }

      return txHash;
    },
    [address, signTransaction, isPending, setPhase, setActionError, setTxHash, fetchJob]
  );

  const handlePartialRelease = async (index: number, amount: string) => {
    if (!address || !amount) return;

    await executeTx(`partial-${index}`, "approve_partial", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
      { type: "i128", value: amount },
    ]);
  };

  const handleClaimAutoRelease = async (index: number) => {
    if (!address) return;

    await executeTx(`claim-${index}`, "claim_auto_release", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
    ]);
  };

  const handleMarkDelivered = async (i: number) => {
    alert(`Mark milestone ${i + 1} delivered (wired to contract soon)`);
  };

  const handleApprove = async (i: number) => {
    alert(`Approve milestone ${i + 1} (wired to contract soon)`);
  };

  const handleDispute = async (i: number) => {
    alert(`Dispute milestone ${i + 1} (wired to contract soon)`);
  };

  const handleResolveDispute = async (index: number, releaseToFreelancer: boolean) => {
  if (!address) return;

  // The arguments must match the contract signature: (arbiter: Address, milestone_index: u32, release_to_freelancer: bool)
  await executeTx(`resolve-${index}`, "resolve_dispute", [
    { type: "address", value: address },
    { type: "u32", value: index.toString() },
    { type: "bool", value: releaseToFreelancer },
  ]);
  };
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">Job Dashboard</h1>
        {!address ? (
          <p className="text-center text-gray-400">Connect your wallet to view your jobs</p>
        ) : fetchLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center text-red-400" role="alert">Error: {error}</div>
        ) : !job ? (
          <p className="text-center text-gray-400">No jobs found</p>
        ) : (
          <div className="space-y-8">
            <div className="border border-gray-800 rounded-xl bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-lg">Job #{job.id.slice(0, 8)}</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    <span aria-hidden="true">{job.funded ? "✅ " : "🔒 "}</span>
                    {job.funded ? "Funded" : "Not funded"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
                <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                  <p className="text-gray-400">Client</p>
                  <p className="font-mono text-xs break-all">{job.client}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                  <p className="text-gray-400">Freelancer</p>
                  <p className="font-mono text-xs break-all">{job.freelancer}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                  <p className="text-gray-400">Arbiter</p>
                  <p className="font-mono text-xs break-all">{job.arbiter}</p>
                </div>
              </div>
              <div className="space-y-4">
                {milestoneList.length > 0 ? (
                  milestoneList.map((m) => (
                    <MilestoneCard
                      key={m.index}
                      milestone={m}
                      isClient={isClient}
                      isFreelancer={isFreelancer}
                      isArbiter={isArbiter}
                      resolveDisputeState={getState(`resolve-${m.index}`)}
                      isResolveDisputePending={isPending(`resolve-${m.index}`)}
                      onResolveDispute={handleResolveDispute}
                      partialReleaseState={getState(`partial-${m.index}`)}
                      claimAutoReleaseState={getState(`claim-${m.index}`)}
                      isPartialReleasePending={isPending(`partial-${m.index}`)}
                      isClaimAutoReleasePending={isPending(`claim-${m.index}`)}
                      autoReleaseDeadline={autoReleaseDeadlines[m.index] ?? null}
                      onPartialRelease={handlePartialRelease}
                      onClaimAutoRelease={handleClaimAutoRelease}
                      onMarkDelivered={handleMarkDelivered}
                      onApprove={handleApprove}
                      onDispute={handleDispute}
                    />
                  ))
                ) : (
                  <MilestoneCard
                    milestone={null}
                    isClient={isClient}
                    isFreelancer={isFreelancer}
                    partialReleaseState={getState("empty")}
                    claimAutoReleaseState={getState("empty")}
                    isPartialReleasePending={false}
                    isClaimAutoReleasePending={false}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
