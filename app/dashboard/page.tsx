"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import MilestoneCard from "@/app/components/MilestoneCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

interface Milestone {
  index: number;
  amount: string;
  status: string;
}

interface Job {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  funded: boolean;
  milestones: Milestone[];
}

export default function Dashboard() {
  const { address } = useWallet();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
        const res = await fetch(`${backendUrl}/api/jobs/by-wallet/${address}`);
        const data = await res.json();

        if (data.success) {
          setJob(data.data);
        } else {
          setError(data.error || "Failed to fetch job data");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [address]);

  const isClient = !!(job && address === job.client);
  const isFreelancer = !!(job && address === job.freelancer);
  const milestoneList = Array.isArray(job?.milestones) ? job.milestones : [];

  const handleMarkDelivered = async (i: number) => {
    setLoading(true);
    try {
      alert(`Mark milestone ${i + 1} delivered (wired to contract soon)`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (i: number) => {
    setLoading(true);
    try {
      alert(`Approve milestone ${i + 1} (wired to contract soon)`);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async (i: number) => {
    setLoading(true);
    try {
      alert(`Dispute milestone ${i + 1} (wired to contract soon)`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">Job Dashboard</h1>
        {!address ? (
          <p className="text-center text-gray-500">Connect your wallet to view your jobs</p>
        ) : loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center text-red-400">
            Error: {error}
          </div>
        ) : !job ? (
          <p className="text-center text-gray-500">No jobs found</p>
        ) : (
          <div className="space-y-8">
            <div className="border border-gray-800 rounded-xl bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-lg">Job #{job?.id.slice(0, 8)}</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {job?.funded ? "✅ Funded" : "🔒 Not funded"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400">Client</p>
                  <p className="font-mono">{job?.client}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400">Freelancer</p>
                  <p className="font-mono">{job?.freelancer}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400">Arbiter</p>
                  <p className="font-mono">{job?.arbiter}</p>
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
                      onMarkDelivered={handleMarkDelivered}
                      onApprove={handleApprove}
                      onDispute={handleDispute}
                    />
                  ))
                ) : (
                  <MilestoneCard milestone={null} isClient={isClient} isFreelancer={isFreelancer} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
