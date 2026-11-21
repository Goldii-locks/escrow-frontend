import type { Metadata } from "next";
import Link from "next/link";
import PlatformStatsView from "@/app/components/PlatformStatsView";

export const metadata: Metadata = {
  title: "Platform statistics | Milestone",
  description: "Public activity on Milestone: jobs, escrowed value and disputes.",
};

export default function StatsPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px" }}>
      <h1>Platform statistics</h1>
      <PlatformStatsView />
      <p style={{ marginTop: 32 }}>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
