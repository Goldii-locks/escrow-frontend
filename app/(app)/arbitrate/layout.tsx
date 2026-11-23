import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arbitration",
  description:
    "Disputed milestones awaiting your decision as arbiter, sorted by escalation deadline.",
};

export default function ArbitrateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}