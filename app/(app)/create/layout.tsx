import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create job",
  description: "Create a milestone-based escrow job and fund it on Stellar.",
};

export default function CreateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
