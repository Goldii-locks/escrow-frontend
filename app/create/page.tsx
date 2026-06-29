"use client";
import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import { useRouter } from "next/navigation";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function CreateJob() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [loading, setLoading] = useState(false);

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
    if (!address) return alert("Connect your wallet first");
    setLoading(true);
    try {
      const milestoneAmounts = milestones.map(m => BigInt(m.amount));

      // Build transaction
      const autoReleaseSeconds = BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60); // Convert days to seconds
      const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: CONTRACT_ID,
          method: "initialize",
          args: [
            { type: "address", value: address }, // Admin (same as client for now)
            { type: "address", value: address }, // Client
            { type: "address", value: freelancer }, // Freelancer
            { type: "address", value: arbiter }, // Arbiter
            { type: "address", value: token }, // Token
            { type: "u64", value: autoReleaseSeconds.toString() }, // Auto-release seconds
            { type: "vec", value: milestoneAmounts.map(a => ({ type: "i128", value: a.toString() })) } // Milestone amounts
          ],
          sourceAddress: address
        })
      });

      if (!buildTxRes.ok) throw new Error("Failed to build transaction");
      const { xdr } = await buildTxRes.json();

      // Sign with Freighter
      const signedXdr = await signTransaction(xdr);

      // Submit to backend
      const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr })
      });

      if (!submitRes.ok) throw new Error("Failed to submit transaction");

      alert("Job created successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred");
      }
    } finally {
      setLoading(false);
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder="G..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Arbiter Address</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              placeholder="G..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Token Contract Address</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="C..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Response Deadline (days)</label>
            <input
              type="number"
              min="1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={autoReleaseDays}
              onChange={(e) => setAutoReleaseDays(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Milestones</label>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, e.target.value)}
                    placeholder={`Milestone ${i + 1} amount (stroops)`}
                    required
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="text-red-400 hover:text-red-300 text-sm px-2"
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
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
            >
              + Add Milestone
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !address}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? "Creating..." : "Create Job"}
          </button>
          {!address && (
            <p className="text-center text-sm text-gray-500">Connect your wallet to create a job</p>
          )}
        </form>
      </main>
    </div>
  );
}
