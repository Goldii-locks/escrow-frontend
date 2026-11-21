"use client";

import Link from "next/link";
import { useArbiterQueue } from "@/app/hooks/useArbiterQueue";

/** Navbar link to the arbiter queue, with a badge counting disputes awaiting a decision (#881). */
export default function ArbitrationNavLink({ address }: { address: string }) {
  const { items } = useArbiterQueue(address);
  const count = items?.length ?? 0;
  // Only wallets that are an arbiter on some disputed milestone see the link.
  if (count === 0) return null;
  return (
    <Link
      href="/arbitrate"
      className="text-sm text-text-secondary hover:text-text-primary transition"
    >
      Arbitration
      <span
        className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white"
        aria-label={`${count} disputes awaiting a decision`}
      >
        {count}
      </span>
    </Link>
  );
}
