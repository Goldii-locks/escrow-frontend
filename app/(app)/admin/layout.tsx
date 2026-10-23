import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  description: "Administer the escrow contract: token whitelist, fees and pause controls.",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
