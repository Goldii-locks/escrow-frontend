"use client";
import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useRouter } from "next/navigation";
import {
  getPhaseLabel,
  submitContractTransaction,
  TxPhase,
} from "@/app/lib/transactions";
import { formatTxError } from "@/app/lib/errors";

export default function CreateJob() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const loading = phase === "building" || phase === "signing" || phase === "submitting";

  const addMilestone = () => setMilestones([...milestones, { amount: "" }]);
  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, val: string) => {
    const updated = [...milestones];
    updated[i].amount = val;
    setMilestones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    if (loading) return;

    setPhase("building");
    setError(null);
    setTxHash(null);

    try {
      const milestoneAmounts = milestones.map((m) => BigInt(m.amount));
      const autoReleaseSeconds =
        BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60);

      const hash = await submitContractTransaction({
        method: "initialize",
        args: [
          { type: "address", value: address },
          { type: "address", value: address },
          { type: "address", value: freelancer },
          { type: "address", value: arbiter },
          { type: "address", value: token },
          { type: "u64", value: autoReleaseSeconds.toString() },
          {
            type: "vec",
            value: milestoneAmounts.map((a) => ({
              type: "i128",
              value: a.toString(),
            })),
          },
        ],
        sourceAddress: address,
        signTransaction,
        onPhase: setPhase,
      });

      setTxHash(hash || null);
      setPhase("success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: unknown) {
      setPhase("error");
      setError(formatTxError(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">Create New Job</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Freelancer Address</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder="G..."
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Arbiter Address</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              placeholder="G..."
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Token Contract Address</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="C..."
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Response Deadline (days)</label>
            <input
              type="number"
              min="1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              value={autoReleaseDays}
              onChange={(e) => setAutoReleaseDays(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Milestones</label>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, e.target.value)}
                    placeholder={`Milestone ${i + 1} amount (stroops)`}
                    required
                    disabled={loading}
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      disabled={loading}
                      className="text-red-400 hover:text-red-300 text-sm px-2 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addMilestone}
              disabled={loading}
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              + Add Milestone
            </button>
          </div>

          <TxStatusBanner
            state={{ phase, error, txHash }}
            successMessage="Job created successfully! Redirecting to dashboard..."
          />

          <button
            type="submit"
            disabled={loading || !address}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
          >
            {loading && <ButtonSpinner className="h-4 w-4" />}
            {loading ? getPhaseLabel(phase) || "Creating..." : "Create Job"}
          </button>
          {!address && (
            <p className="text-center text-sm text-gray-500">Connect your wallet to create a job</p>
          )}
        </form>
      </main>
    </div>
  );
}
