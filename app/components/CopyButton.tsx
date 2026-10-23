"use client";
import { useToast } from "@/app/context/ToastContext";

interface CopyButtonProps {
  /** Full value to copy, even when the visible text is truncated. */
  value: string;
  /** What is being copied, used in the accessible label ("Copy contract ID"). */
  label: string;
  className?: string;
}

export default function CopyButton({ value, label, className = "" }: CopyButtonProps) {
  const { showToast } = useToast();
  const name = label.charAt(0).toLowerCase() + label.slice(1);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied to clipboard`, "success");
    } catch {
      showToast(`Could not copy ${name}`, "error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${name}`}
      title={`Copy ${name}`}
      className={`shrink-0 text-xs text-text-muted hover:text-text-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft ${className}`}
    >
      Copy
    </button>
  );
}
