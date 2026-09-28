import React from "react";

interface Props {
  className?: string;
  disabled?: boolean;
}

export default function ButtonSpinner({
  className = "h-3.5 w-3.5",
  disabled = false,
}: Props) {
  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : "opacity-100 hover:opacity-90";

  return (
    <svg
      className={`animate-spin transition-opacity duration-200 ease-in-out ${disabledClasses} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-testid="button-spinner"
    >
      <circle
        className="opacity-25 transition-colors duration-200"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75 transition-colors duration-200"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
