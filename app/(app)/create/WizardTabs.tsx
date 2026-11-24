"use client";

import type { WizardSection } from "./useCreateJobForm";
import { buttonClassName } from "./ui";

const WIZARD_SECTIONS: { id: WizardSection; label: string; helper: string }[] = [
  { id: "details", label: "1. Details", helper: "Participants and funding" },
  { id: "milestones", label: "2. Scope", helper: "Assets, requirements, milestones" },
  { id: "review", label: "3. Review", helper: "Check before submitting" },
];

/**
 * Wizard navigation implemented as a proper ARIA tablist.
 * - role="tablist" on the container
 * - role="tab" + aria-selected + aria-controls on each button
 * - ArrowLeft/ArrowRight/Home/End move between tabs and focus
 * - Each step's section carries role="tabpanel" + aria-labelledby
 */
export default function WizardTabs({
  active,
  onSelect,
}: {
  active: WizardSection;
  onSelect: (section: WizardSection) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const count = WIZARD_SECTIONS.length;
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % count;
    if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + count) % count;
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = count - 1;
    if (nextIndex !== null) {
      e.preventDefault();
      const next = WIZARD_SECTIONS[nextIndex];
      onSelect(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Form sections"
      className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
      data-testid="wizard-step-list"
    >
      {WIZARD_SECTIONS.map((section, index) => {
        const isActive = active === section.id;
        return (
          <button
            key={section.id}
            id={`tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(section.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`${buttonClassName} flex-col items-start gap-1 border px-4 py-3 text-left ${
              isActive
                ? "border-accent-soft bg-accent/10 text-text-primary shadow-sm"
                : "border-border-subtle bg-surface-card text-text-secondary hover:border-accent-soft hover:bg-surface-card/90"
            }`}
          >
            <span>{section.label}</span>
            <span className="text-xs font-normal text-text-muted">{section.helper}</span>
          </button>
        );
      })}
    </div>
  );
}
