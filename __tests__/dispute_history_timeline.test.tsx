import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DisputeHistoryTimeline from "@/app/components/DisputeHistoryTimeline";

describe("DisputeHistoryTimeline", () => {
  const mockEvents = [
    {
      id: "1",
      timestamp: Date.parse("2024-01-15T10:30:00"),
      title: "Dispute Raised",
      description: "Client raised a dispute for milestone 2",
      type: "raised" as const,
    },
    {
      id: "2",
      timestamp: Date.parse("2024-01-15T14:00:00"),
      title: "Evidence Submitted",
      description: "Freelancer submitted work evidence",
      type: "evidence" as const,
    },
    {
      id: "3",
      timestamp: Date.parse("2024-01-16T09:15:00"),
      title: "Dispute Resolved",
      description: "Arbiter approved the freelancer's claim",
      type: "resolved" as const,
    },
  ];

  describe("Rendering with events", () => {
    it("renders all events in the timeline", () => {
      render(<DisputeHistoryTimeline events={mockEvents} />);
      expect(screen.getByText("Dispute Raised")).toBeInTheDocument();
      expect(screen.getByText("Evidence Submitted")).toBeInTheDocument();
      expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
    });

    it("renders event descriptions", () => {
      render(<DisputeHistoryTimeline events={mockEvents} />);
      expect(screen.getByText("Client raised a dispute for milestone 2")).toBeInTheDocument();
      expect(screen.getByText("Freelancer submitted work evidence")).toBeInTheDocument();
    });

    it("renders event count in footer", () => {
      render(<DisputeHistoryTimeline events={mockEvents} />);
      expect(screen.getByText(/showing 3 events/i)).toBeInTheDocument();
    });

    it("renders singular event text when only one event", () => {
      const singleEvent = [mockEvents[0]];
      render(<DisputeHistoryTimeline events={singleEvent} />);
      expect(screen.getByText(/showing 1 event/i)).toBeBeInTheDocument();
    });

    it("applies correct type styling classes to event cards", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const eventCards = container.querySelectorAll("[class*='bg-danger-soft'], [class*='bg-info-soft'], [class*='bg-success-soft']");
      expect(eventCards.length).toBe(3);
    });
  });

  describe("Grid layout constraints", () => {
    it("renders grid with responsive column classes", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("grid-cols-1");
      expect(gridContainer).toHaveClass("lg:grid-cols-2");
      expect(gridContainer).toHaveClass("xl:grid-cols-3");
    });

    it("applies appropriate gap spacing for responsive design", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("gap-4");
      expect(gridContainer).toHaveClass("lg:gap-6");
    });

    it("renders items without wrapping constraints on single column", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const gridItems = container.querySelectorAll(".grid > div[class*='border']");
      expect(gridItems.length).toBe(mockEvents.length);
    });

    it("maintains consistent card sizing across layout changes", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const cards = container.querySelectorAll(".border.rounded-lg");
      const firstCardRect = cards[0]?.getBoundingClientRect();

      cards.forEach((card) => {
        // Verify all cards have padding classes
        expect(card).toHaveClass("p-4");
      });
    });
  });

  describe("Empty state", () => {
    it("renders empty state message when events array is empty", () => {
      render(<DisputeHistoryTimeline events={[]} />);
      expect(screen.getByText("No dispute history yet")).toBeInTheDocument();
    });

    it("renders empty state message when events is null", () => {
      render(<DisputeHistoryTimeline events={null as any} />);
      expect(screen.getByText("No dispute history yet")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("renders skeleton loaders when isLoading is true", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} isLoading={true} />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });

    it("does not render events when loading", () => {
      render(<DisputeHistoryTimeline events={mockEvents} isLoading={true} />);
      expect(screen.queryByText("Dispute Raised")).not.toBeInTheDocument();
    });

    it("shows loading state even with empty events", () => {
      const { container } = render(<DisputeHistoryTimeline events={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });
  });

  describe("Timestamp formatting", () => {
    it("formats timestamps correctly in event cards", () => {
      render(<DisputeHistoryTimeline events={mockEvents} />);
      // Check that timestamps are formatted (looking for date/time patterns)
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}\s(AM|PM)/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it("displays latest date in footer", () => {
      render(<DisputeHistoryTimeline events={mockEvents} />);
      // The footer should show the latest timestamp
      expect(screen.getByText(/Jan 16, 2024/)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("renders with semantic HTML structure", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const headings = container.querySelectorAll("h4");
      expect(headings.length).toBe(mockEvents.length);
    });

    it("renders event titles as headings for proper hierarchy", () => {
      const { container } = render(<DisputeHistoryTimeline events={mockEvents} />);
      const titleHeadings = container.querySelectorAll("h4");
      expect(screen.getByText("Dispute Raised")).closest("h4")).toBeTruthy();
    });
  });
});
