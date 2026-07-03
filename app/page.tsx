"use client";
import Navbar from "@/app/components/Navbar";
import Link from "next/link";
import { useWallet } from "@/app/context/WalletContext";

// Landing page for Milesto Escrow Platform
export default function Home() {
    const { address } = useWallet();

    return (
        <div className="min-h-screen bg-gray-950 text-white">

            <Navbar />
            <main className="flex-1 container mx-auto px-6 py-16">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Trustless Milestone Escrow
                    </h1>
                    <p className="text-lg text-gray-400 mb-10">
                        Secure your payments with milestones. Lock funds in a
                        smart contract and release them only when work is
                        approved.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {address ? (
                            <Link
                                href="/create"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-8 py-3 rounded-lg transition"
                            >
                                Create New Job
                            </Link>
                        ) : (
                            <div className="text-gray-400">
                                Connect your wallet to get started
                            </div>
                        )}
                    </div>

                    <div className="mt-20 grid md:grid-cols-3 gap-8">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-xl font-semibold mb-2 text-indigo-400">
                                1. Create
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Define milestones and total funding
                            </p>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-xl font-semibold mb-2 text-indigo-400">
                                2. Deliver
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Freelancer submits work milestones
                            </p>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-xl font-semibold mb-2 text-indigo-400">
                                3. Approve
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Client approves and releases funds
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
