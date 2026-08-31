import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import ButtonSpinner from "@/app/components/ButtonSpinner";

// ===========================================================================
// 1. LoadingSkeleton — root node rendering
// ===========================================================================

describe("LoadingSkeleton — root node rendering", () => {
  it("renders the skeleton container in the document", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with aria-live='polite' for screen-reader announcements", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("renders a screen-reader-only loading message", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByText("Loading job data…")).toBeInTheDocument();
  });

  it("screen-reader text has 'sr-only' class", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByText("Loading job data…")).toHaveClass("sr-only");
  });

  it("root container has 'animate-pulse' animation class", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).toHaveClass("animate-pulse");
  });
});

// ===========================================================================
// 2. LoadingSkeleton — outer card structure
// ===========================================================================

describe("LoadingSkeleton — outer card structure", () => {
  it("renders the outer card wrapper with aria-hidden='true'", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toBeInTheDocument();
  });

  it("outer card has 'border' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("border");
  });

  it("outer card has 'rounded-xl' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("rounded-xl");
  });

  it("outer card has 'bg-surface-card' background class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("bg-surface-card");
  });

  it("outer card has 'sm:p-6' padding class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("sm:p-6");
  });

  it("outer card has 'sm:space-y-6' spacing class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    expect(card).toHaveClass("sm:space-y-6");
  });
});

// ===========================================================================
// 3. LoadingSkeleton — header placeholder nodes
// ===========================================================================

describe("LoadingSkeleton — header placeholder nodes", () => {
  it("renders the header title placeholder bar", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const headerBar = card?.querySelector(".h-6.w-32");
    expect(headerBar).toBeInTheDocument();
  });

  it("header title placeholder has 'bg-surface-field' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const headerBar = card?.querySelector(".h-6.w-32");
    expect(headerBar).toHaveClass("bg-surface-field");
  });

  it("header title placeholder has 'rounded' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const headerBar = card?.querySelector(".h-6.w-32");
    expect(headerBar).toHaveClass("rounded");
  });

  it("renders the header subtitle placeholder bar", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const subtitleBar = card?.querySelector(".h-4.w-24");
    expect(subtitleBar).toBeInTheDocument();
  });

  it("header subtitle placeholder has 'bg-surface-field' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const subtitleBar = card?.querySelector(".h-4.w-24");
    expect(subtitleBar).toHaveClass("bg-surface-field");
  });

  it("header subtitle placeholder has 'rounded' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const subtitleBar = card?.querySelector(".h-4.w-24");
    expect(subtitleBar).toHaveClass("rounded");
  });
});

// ===========================================================================
// 4. LoadingSkeleton — stat card placeholder nodes (3-column grid)
// ===========================================================================

describe("LoadingSkeleton — stat card placeholder nodes", () => {
  it("renders exactly 3 stat card placeholders", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    expect(statCards).toHaveLength(3);
  });

  it("each stat card contains a label placeholder", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    statCards?.forEach((statCard) => {
      const label = statCard.querySelector(".h-4.w-12");
      expect(label).toBeInTheDocument();
    });
  });

  it("each stat card contains a value placeholder", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    statCards?.forEach((statCard) => {
      const value = statCard.querySelector(".h-4.w-28");
      expect(value).toBeInTheDocument();
    });
  });

  it("stat card label placeholders have 'bg-border-subtle' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    statCards?.forEach((statCard) => {
      const label = statCard.querySelector(".h-4.w-12");
      expect(label).toHaveClass("bg-border-subtle");
    });
  });

  it("stat card value placeholders have 'bg-border-subtle' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    statCards?.forEach((statCard) => {
      const value = statCard.querySelector(".h-4.w-28");
      expect(value).toHaveClass("bg-border-subtle");
    });
  });

  it("stat card label placeholders have 'rounded' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const statCards = card?.querySelectorAll(".bg-surface-field.rounded-lg.p-3");
    statCards?.forEach((statCard) => {
      const label = statCard.querySelector(".h-4.w-12");
      expect(label).toHaveClass("rounded");
    });
  });
});

// ===========================================================================
// 5. LoadingSkeleton — milestone card placeholder nodes
// ===========================================================================

describe("LoadingSkeleton — milestone card placeholder nodes", () => {
  it("renders exactly 2 milestone card placeholders", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const milestoneCards = card?.querySelectorAll(
      '[data-testid^="skeleton-milestone-card-"]'
    );
    expect(milestoneCards).toHaveLength(2);
  });

  it("each milestone card placeholder contains a label bar", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const milestoneCards = card?.querySelectorAll(
      '[data-testid^="skeleton-milestone-card-"]'
    );
    milestoneCards?.forEach((mc) => {
      const label = mc.querySelector(".h-4.w-24");
      expect(label).toBeInTheDocument();
    });
  });

  it("each milestone card placeholder contains a value bar", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const milestoneCards = card?.querySelectorAll(
      '[data-testid^="skeleton-milestone-card-"]'
    );
    milestoneCards?.forEach((mc) => {
      const value = mc.querySelector(".h-4.w-32");
      expect(value).toBeInTheDocument();
    });
  });

  it("milestone card label bars have 'bg-surface-field' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const milestoneCards = card?.querySelectorAll(
      '[data-testid^="skeleton-milestone-card-"]'
    );
    milestoneCards?.forEach((mc) => {
      const label = mc.querySelector(".h-4.w-24");
      expect(label).toHaveClass("bg-surface-field");
    });
  });

  it("milestone card value bars have 'bg-surface-field' class", () => {
    const { container } = render(<LoadingSkeleton />);
    const card = container.querySelector('[aria-hidden="true"]');
    const milestoneCards = card?.querySelectorAll(
      '[data-testid^="skeleton-milestone-card-"]'
    );
    milestoneCards?.forEach((mc) => {
      const value = mc.querySelector(".h-4.w-32");
      expect(value).toHaveClass("bg-surface-field");
    });
  });
});

// ===========================================================================
// 6. LoadingSkeleton — accessibility and structural invariants
// ===========================================================================

describe("LoadingSkeleton — accessibility and structural invariants", () => {
  it("contains no interactive elements", () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelectorAll("button, input, a, select")).toHaveLength(
      0
    );
  });

  it("contains exactly one role='status' element", () => {
    render(<LoadingSkeleton />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("the single aria-hidden container wraps all skeleton content", () => {
    const { container } = render(<LoadingSkeleton />);
    const statusEl = screen.getByRole("status");
    const hiddenCard = statusEl.querySelector('[aria-hidden="true"]');
    expect(hiddenCard).toBeInTheDocument();
    // All visual content should be inside the aria-hidden card
    const allDivs = statusEl.querySelectorAll("div");
    expect(allDivs.length).toBeGreaterThan(1);
  });
});

// ===========================================================================
// 7. ButtonSpinner — default rendering
// ===========================================================================

describe("ButtonSpinner — default rendering", () => {
  it("renders an SVG element", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("SVG has aria-hidden='true' for accessibility", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("SVG has 'animate-spin' animation class", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("animate-spin");
  });

  it("SVG has default size classes 'h-3.5 w-3.5'", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-3.5", "w-3.5");
  });

  it("SVG has xmlns attribute", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute(
      "xmlns",
      "http://www.w3.org/2000/svg"
    );
  });

  it("SVG has fill='none'", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("SVG has viewBox='0 0 24 24'", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});

// ===========================================================================
// 8. ButtonSpinner — circle element
// ===========================================================================

describe("ButtonSpinner — circle element", () => {
  it("renders a circle element inside the SVG", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("circle has cx='12' cy='12' r='10'", () => {
    const { container } = render(<ButtonSpinner />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("cx", "12");
    expect(circle).toHaveAttribute("cy", "12");
    expect(circle).toHaveAttribute("r", "10");
  });

  it("circle has stroke='currentColor'", () => {
    const { container } = render(<ButtonSpinner />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("stroke", "currentColor");
  });

  it("circle has stroke-width='4'", () => {
    const { container } = render(<ButtonSpinner />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("stroke-width", "4");
  });

  it("circle has 'opacity-25' class", () => {
    const { container } = render(<ButtonSpinner />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveClass("opacity-25");
  });
});

// ===========================================================================
// 9. ButtonSpinner — path element
// ===========================================================================

describe("ButtonSpinner — path element", () => {
  it("renders a path element inside the SVG", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("path has fill='currentColor'", () => {
    const { container } = render(<ButtonSpinner />);
    const path = container.querySelector("path");
    expect(path).toHaveAttribute("fill", "currentColor");
  });

  it("path has 'opacity-75' class", () => {
    const { container } = render(<ButtonSpinner />);
    const path = container.querySelector("path");
    expect(path).toHaveClass("opacity-75");
  });

  it("path has a d attribute with spinner arc data", () => {
    const { container } = render(<ButtonSpinner />);
    const path = container.querySelector("path");
    const d = path?.getAttribute("d");
    expect(d).toBeTruthy();
    expect(d).toContain("M4 12a8 8 0 018-8V0");
  });
});

// ===========================================================================
// 10. ButtonSpinner — custom className prop
// ===========================================================================

describe("ButtonSpinner — custom className prop", () => {
  it("merges custom className with the default animate-spin class", () => {
    const { container } = render(<ButtonSpinner className="h-6 w-6" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-6", "w-6");
    expect(svg).toHaveClass("animate-spin");
  });

  it("does not include default size classes when custom className is provided", () => {
    const { container } = render(<ButtonSpinner className="h-8 w-8" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-8", "w-8");
    // The default h-3.5 w-3.5 should not be present
    expect(svg).not.toHaveClass("h-3.5", "w-3.5");
  });

  it("custom className can include arbitrary Tailwind classes", () => {
    const { container } = render(
      <ButtonSpinner className="text-red-500 my-2" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-red-500", "my-2");
    expect(svg).toHaveClass("animate-spin");
  });

  it("preserves aria-hidden='true' with custom className", () => {
    const { container } = render(
      <ButtonSpinner className="h-5 w-5" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

// ===========================================================================
// 11. ButtonSpinner — contains no interactive elements
// ===========================================================================

describe("ButtonSpinner — structural invariants", () => {
  it("contains no interactive elements", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelectorAll("button, input, a, select")).toHaveLength(
      0
    );
  });

  it("contains exactly one SVG element", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("SVG contains exactly one circle and one path", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });
});
