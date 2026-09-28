import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

const DESIGN_TOKEN_CLASSES = {
  surfaceCard: "bg-surface-card",
  surfaceField: "bg-surface-field",
  borderSubtle: "bg-border-subtle",
  borderStrong: "border-border-strong",
} as const;

const DEPRECATED_GRAY_PATTERN = /(bg|border)-gray-\d+/;

describe("LoadingSkeleton — design tokens mapping", () => {
  beforeEach(() => {
    render(<LoadingSkeleton />);
  });

  it("does NOT use any hardcoded gray-* utility classes anywhere", () => {
    const root = screen.getByTestId("loading-skeleton");
    const allElements = root.querySelectorAll<HTMLElement>("*");

    const offenders: { tag: string; classes: string }[] = [];
    const checkElement = (el: HTMLElement) => {
      const cls = el.getAttribute("class") || "";
      if (DEPRECATED_GRAY_PATTERN.test(cls)) {
        offenders.push({ tag: el.tagName, classes: cls });
      }
    };

    checkElement(root);
    allElements.forEach(checkElement);

    expect(offenders).toEqual([]);
  });

  it("uses border-strong design token on outer container border", () => {
    const container = screen.getByTestId("skeleton-container");
    expect(container.className).toContain(DESIGN_TOKEN_CLASSES.borderStrong);
  });

  it("uses surface-card design token on outer container background", () => {
    const container = screen.getByTestId("skeleton-container");
    expect(container.className).toContain(DESIGN_TOKEN_CLASSES.surfaceCard);
  });

  it("uses surface-field design token on header placeholder bars", () => {
    const title = screen.getByTestId("skeleton-header-title");
    const subtitle = screen.getByTestId("skeleton-header-subtitle");
    expect(title.className).toContain(DESIGN_TOKEN_CLASSES.surfaceField);
    expect(subtitle.className).toContain(DESIGN_TOKEN_CLASSES.surfaceField);
  });

  it("uses surface-field design token for stat cards background", () => {
    for (let i = 0; i < 3; i++) {
      const card = screen.getByTestId(`skeleton-stat-card-${i}`);
      expect(card.className).toContain(DESIGN_TOKEN_CLASSES.surfaceField);
    }
  });

  it("uses border-subtle design token for stat label and value placeholders", () => {
    for (let i = 0; i < 3; i++) {
      const label = screen.getByTestId(`skeleton-stat-label-${i}`);
      const value = screen.getByTestId(`skeleton-stat-value-${i}`);
      expect(label.className).toContain(DESIGN_TOKEN_CLASSES.borderSubtle);
      expect(value.className).toContain(DESIGN_TOKEN_CLASSES.borderSubtle);
    }
  });

  it("uses surface-card for milestone card backgrounds", () => {
    for (let i = 0; i < 2; i++) {
      const card = screen.getByTestId(`skeleton-milestone-card-${i}`);
      expect(card.className).toContain(DESIGN_TOKEN_CLASSES.surfaceCard);
    }
  });

  it("uses border-strong for milestone card borders", () => {
    for (let i = 0; i < 2; i++) {
      const card = screen.getByTestId(`skeleton-milestone-card-${i}`);
      expect(card.className).toContain(DESIGN_TOKEN_CLASSES.borderStrong);
    }
  });

  it("uses surface-field for milestone placeholder bars", () => {
    for (let i = 0; i < 2; i++) {
      const title = screen.getByTestId(`skeleton-milestone-title-${i}`);
      const amount = screen.getByTestId(`skeleton-milestone-amount-${i}`);
      expect(title.className).toContain(DESIGN_TOKEN_CLASSES.surfaceField);
      expect(amount.className).toContain(DESIGN_TOKEN_CLASSES.surfaceField);
    }
  });
});

describe("LoadingSkeleton — component layout & structure", () => {
  beforeEach(() => {
    render(<LoadingSkeleton />);
  });

  it("renders the root skeleton wrapper", () => {
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("renders the outer skeleton container with padding and rounded corners", () => {
    const container = screen.getByTestId("skeleton-container");
    expect(container.className).toContain("rounded-xl");
    expect(container.className).toContain("p-6");
  });

  it("renders the stats grid with 3 columns on md+ breakpoint", () => {
    const grid = screen.getByTestId("skeleton-stats-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-3");
    expect(grid.className).toContain("gap-4");
  });

  it("renders exactly 3 stat cards in the stats grid", () => {
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`skeleton-stat-card-${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("skeleton-stat-card-3")).not.toBeInTheDocument();
  });

  it("renders exactly 2 milestone cards in the milestones section", () => {
    for (let i = 0; i < 2; i++) {
      expect(screen.getByTestId(`skeleton-milestone-card-${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("skeleton-milestone-card-2")).not.toBeInTheDocument();
  });

  it("has pulse animation on the wrapper", () => {
    const root = screen.getByTestId("loading-skeleton");
    expect(root.className).toContain("animate-pulse");
  });
});

describe("LoadingSkeleton — accessibility attributes", () => {
  beforeEach(() => {
    render(<LoadingSkeleton />);
  });

  it("exposes role=status on the wrapper for assistive tech", () => {
    const root = screen.getByTestId("loading-skeleton");
    expect(root).toHaveAttribute("role", "status");
  });

  it("exposes aria-live=polite on the wrapper for live region announcements", () => {
    const root = screen.getByTestId("loading-skeleton");
    expect(root).toHaveAttribute("aria-live", "polite");
  });

  it("includes a screen-reader-only loading label", () => {
    expect(screen.getByText(/Loading job data/i)).toBeInTheDocument();
    const srLabel = screen.getByText(/Loading job data/i);
    expect(srLabel.className).toContain("sr-only");
  });

  it("marks the decorative skeleton content as aria-hidden", () => {
    const container = screen.getByTestId("skeleton-container");
    expect(container).toHaveAttribute("aria-hidden", "true");
  });
});
