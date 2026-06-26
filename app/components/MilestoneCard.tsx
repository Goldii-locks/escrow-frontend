"use client";

import { useEffect, useState } from "react";

interface Milestone {
    index: number;
    amount: string;
    status: string;
}

interface Props {
    milestone: Milestone;
    isClient: boolean;
    isFreelancer: boolean;
    onMarkDelivered?: (i: number) => void;
    onApprove?: (i: number) => void;
    onDispute?: (i: number) => void;
}

const statusColor: Record<string, string> = {
    Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Released: "bg-green-500/10 text-green-400 border-green-500/20",
    Disputed: "bg-red-500/10 text-red-400 border-red-500/20",
    Refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const statusMotion: Record<string, string> = {
    Pending: "motion-safe:animate-[milestonePulse_2.8s_ease-in-out_infinite]",
    Delivered: "motion-safe:animate-[milestoneCelebrate_420ms_ease-out_1]",
    Released: "motion-safe:animate-[milestoneSoftPop_360ms_ease-out_1]",
    Disputed: "motion-safe:animate-[milestoneShake_320ms_ease-in-out_1]",
    Refunded: "motion-safe:animate-[milestoneFade_280ms_ease-out_1]",
};

export default function MilestoneCard({
    milestone,
    isClient,
    isFreelancer,
    onMarkDelivered,
    onApprove,
    onDispute,
}: Props) {
    const [isPressed, setIsPressed] = useState(false);

    const motion =
        statusMotion[milestone.status] ??
        "motion-safe:animate-[milestoneFade_280ms_ease-out_1]";

    useEffect(() => {
        if (!isPressed) return;
        const id = window.setTimeout(() => setIsPressed(false), 180);
        return () => window.clearTimeout(id);
    }, [isPressed]);

    const handlePress = () => setIsPressed(true);

    return (
        <div
            data-testid="milestone-card"
            onAnimationEnd={() => setIsPressed(false)}
            className={[
                "group border border-gray-800 rounded-lg p-4 bg-gray-900",
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                "transition-all duration-300 ease-out will-change-transform",
                "hover:-translate-y-1 hover:border-gray-700 hover:bg-gray-900/95 hover:shadow-lg hover:shadow-black/20",
                "active:scale-[0.99] focus-within:ring-2 focus-within:ring-blue-500/30",
                isPressed
                    ? "motion-safe:animate-[milestoneClick_180ms_ease-out_1]"
                    : "",
            ].join(" ")}
        >
            <style jsx global>{`
                @keyframes milestonePulse {
                    0%,
                    100% {
                        transform: translateY(0);
                        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
                    }
                    50% {
                        transform: translateY(-1px);
                        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.06);
                    }
                }
                @keyframes milestoneCelebrate {
                    0% {
                        transform: scale(0.97);
                        opacity: 0.75;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                @keyframes milestoneSoftPop {
                    0% {
                        transform: scale(0.985);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                @keyframes milestoneShake {
                    0%,
                    100% {
                        transform: translateX(0);
                    }
                    25% {
                        transform: translateX(-2px);
                    }
                    75% {
                        transform: translateX(2px);
                    }
                }
                @keyframes milestoneFade {
                    0% {
                        opacity: 0.75;
                        transform: translateY(2px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes milestoneClick {
                    0% {
                        transform: scale(1);
                    }
                    45% {
                        transform: scale(1.012);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
            `}</style>

            <div className="min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                <p className="text-sm text-gray-400">
                    Milestone {milestone.index + 1}
                </p>
                <p className="font-mono text-white text-sm mt-1 truncate">
                    {milestone.amount} stroops
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                <span
                    data-testid="milestone-status"
                    className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-all duration-300 ease-out ${statusColor[milestone.status] ?? "bg-gray-800 text-gray-400"} ${motion}`}
                >
                    {milestone.status}
                </span>

                {isFreelancer && milestone.status === "Pending" && (
                    <button
                        onClick={() => {
                            handlePress();
                            onMarkDelivered?.(milestone.index);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                    >
                        Mark Delivered
                    </button>
                )}

                {isClient && milestone.status === "Delivered" && (
                    <button
                        onClick={() => {
                            handlePress();
                            onApprove?.(milestone.index);
                        }}
                        className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-green-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 whitespace-nowrap"
                    >
                        Approve
                    </button>
                )}

                {(isClient || isFreelancer) &&
                    ["Pending", "Delivered"].includes(milestone.status) && (
                        <button
                            onClick={() => {
                                handlePress();
                                onDispute?.(milestone.index);
                            }}
                            className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-red-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 whitespace-nowrap"
                        >
                            Dispute
                        </button>
                    )}
            </div>
        </div>
    );
}
