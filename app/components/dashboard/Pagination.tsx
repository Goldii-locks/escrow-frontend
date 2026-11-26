"use client";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Builds the visible page-button window (mirrors the original dashboard math). */
function paginationButtons(page: number, totalPages: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  return pages;
}

const buttonBase =
  "rounded-md text-xs sm:text-sm border whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page";
const buttonActive =
  "bg-accent border-accent-soft text-text-primary focus-visible:ring-accent-soft";
const buttonInactive =
  "bg-surface-card border-border-subtle text-text-secondary hover:bg-surface-field hover:border-border-hover active:bg-surface-raised focus-visible:ring-accent-soft";
const navButton =
  "px-3 py-2 rounded-lg border border-border-subtle bg-surface-card text-xs sm:text-sm transition-all duration-200 hover:bg-surface-field hover:border-border-hover active:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-card disabled:hover:border-border-subtle";

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pages = paginationButtons(page, totalPages);
  return (
    <nav className="flex flex-col xs:flex-row items-center justify-between gap-3 overflow-x-auto" aria-label="Pagination navigation">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label={`Previous page, current page is ${page} of ${totalPages}`}
        className={`${navButton} w-full xs:w-auto`}
      >
        Previous
      </button>

      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto" aria-label="Pagination buttons" role="group">
        {pages.map((value) => {
          const active = value === page;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPageChange(value)}
              aria-current={active ? "page" : undefined}
              aria-label={active ? `Current page, page ${value}` : `Go to page ${value}`}
              className={`h-8 min-w-8 px-1.5 sm:px-2 ${buttonBase} ${active ? buttonActive : buttonInactive}`}
            >
              {value}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label={`Next page, current page is ${page} of ${totalPages}`}
        className={`${navButton} w-full xs:w-auto`}
      >
        Next
      </button>
    </nav>
  );
}
