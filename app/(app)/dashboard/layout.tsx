import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Track your escrow jobs and manage milestones: deliver, approve, dispute or claim.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
