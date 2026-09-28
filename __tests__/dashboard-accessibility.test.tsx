import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/dashboard/page";

const mockUseWallet = vi.fn();
const mockUseToast = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));

vi.mock("@/app/components/MilestoneCard", () => ({
  default: () => <div data-testid="milestone-card" />,
}));

describe("Dashboard — accessibility compliance (ARIA, keyboard, semantic HTML)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: "GCLIENT",
      signTransaction: vi.fn(),
    });
    mockUseToast.mockReturnValue({
      showToast: vi.fn(),
      toasts: [],
      hideToast: vi.fn(),
    });
  });

  describe("ARIA attributes — search form", () => {
    it("search input has accessible label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).toHaveAttribute("id", "search-input");
        expect(screen.getByText("Search by contract or job ID")).toHaveClass("sr-only");
      });
    });

    it("search input has aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).toHaveAttribute("aria-label", "Search by contract ID");
      });
    });

    it("search input has aria-describedby linking to help text", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).toHaveAttribute("aria-describedby", "search-help");
        const helpText = document.getElementById("search-help");
        expect(helpText).toHaveClass("sr-only");
      });
    });

    it("search button has aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Submit search query" });
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe("ARIA attributes — filter tabs", () => {
    it("filter buttons container has role=tablist", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const tablist = screen.getByRole("tablist", { name: "Filter jobs by role" });
        expect(tablist).toBeInTheDocument();
      });
    });

    it("filter buttons have role=tab", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const allTab = screen.getByRole("tab", { name: /Filter jobs: All/i });
        const clientTab = screen.getByRole("tab", { name: /Filter jobs: As Client/i });
        expect(allTab).toBeInTheDocument();
        expect(clientTab).toBeInTheDocument();
      });
    });

    it("active filter tab has aria-selected=true", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const allTab = screen.getByRole("tab", { name: /Filter jobs: All/i });
        expect(allTab).toHaveAttribute("aria-selected", "true");
      });
    });

    it("inactive filter tabs have aria-selected=false", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const clientTab = screen.getByRole("tab", { name: /Filter jobs: As Client/i });
        expect(clientTab).toHaveAttribute("aria-selected", "false");
      });
    });
  });

  describe("ARIA attributes — job list", () => {
    it("jobs list container has role=region with aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const region = screen.getByRole("region", { name: "Jobs list" });
        expect(region).toBeInTheDocument();
      });
    });

    it("job expand button has aria-expanded attribute", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const expandButton = screen.getByRole("button", { name: /Job #job-1/i });
        expect(expandButton).toHaveAttribute("aria-expanded");
      });
    });

    it("job expand button has aria-controls referencing job details", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const expandButton = screen.getByRole("button", { name: /Job #job-1/i });
        expect(expandButton).toHaveAttribute("aria-controls", "job-details-job-1");
      });
    });

    it("expanded job details section has matching id from aria-controls", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const detailsSection = document.getElementById("job-details-job-1");
        expect(detailsSection).toBeInTheDocument();
      });
    });

    it("job details section has role=region with aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      const expandButton = await screen.findByRole("button", {
        name: /Job #job-1/i,
      });
      if (expandButton.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(expandButton);
      }

      const region = await screen.findByRole("region", {
        name: /Details for job #job-1/i,
      });
      expect(region).toBeInTheDocument();
    });

    it("role badges have aria-label describing role", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const clientBadge = screen.getByRole("status", { name: "Your role: Client" });
        expect(clientBadge).toBeInTheDocument();
      });
    });
  });

  describe("ARIA attributes — error states", () => {
    it("error message has role=alert", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            error: "Failed to fetch jobs",
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
      });
    });

    it("error message displays error text", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            error: "Connection timeout",
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Connection timeout");
      });
    });
  });

  describe("ARIA attributes — wallet connection", () => {
    it("wallet connection message has role=status and aria-live=polite", () => {
      mockUseWallet.mockReturnValue({
        address: null,
        signTransaction: vi.fn(),
      });

      render(<Dashboard />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent("Connect your wallet");
    });
  });

  describe("ARIA attributes — pagination", () => {
    it("pagination nav has aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const nav = screen.getByRole("navigation", { name: "Pagination navigation" });
        expect(nav).toBeInTheDocument();
      });
    });

    it("pagination page buttons group has role=group", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const group = screen.getByRole("group", { name: "Pagination buttons" });
        expect(group).toBeInTheDocument();
      });
    });

    it("current pagination button has aria-current=page", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const currentPageButton = screen.getByRole("button", { name: /Current page, page 1/i });
        expect(currentPageButton).toHaveAttribute("aria-current", "page");
      });
    });

    it("previous button has descriptive aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const prevButton = screen.getByRole("button", { name: /Previous page/i });
        expect(prevButton).toHaveAttribute("aria-label", expect.stringContaining("Previous page"));
      });
    });

    it("next button has descriptive aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: /Next page/i });
        expect(nextButton).toHaveAttribute("aria-label", expect.stringContaining("Next page"));
      });
    });
  });

  describe("Semantic HTML structure", () => {
    it("uses main landmark for page content", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const main = screen.getByRole("main");
        expect(main).toBeInTheDocument();
      });
    });

    it("uses h1 for page title", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const heading = screen.getByRole("heading", { level: 1, name: "Job Dashboard" });
        expect(heading).toBeInTheDocument();
      });
    });

    it("uses form for search", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const form = screen.getByRole("textbox").closest("form");
        expect(form).toBeInTheDocument();
      });
    });

    it("uses nav for pagination", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const nav = document.querySelector("nav");
        expect(nav).toBeInTheDocument();
      });
    });

    it("search input has associated label element", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const label = screen.getByLabelText("Search by contract or job ID");
        expect(label).toHaveAttribute("id", "search-input");
      });
    });

    it("milestons section has role=region with aria-label", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [
                  {
                    index: 0,
                    amount: "100",
                    status: "Pending",
                  },
                ],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      const expandButton = await screen.findByRole("button", {
        name: /Job #job-1/i,
      });
      if (expandButton.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(expandButton);
      }

      const milestonesRegion = await screen.findByRole("region", {
        name: "Milestones",
      });
      expect(milestonesRegion).toBeInTheDocument();
    });
  });

  describe("Keyboard navigation", () => {
    it("search input is keyboard focusable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("search button is keyboard focusable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Submit search query" });
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("filter tabs are keyboard focusable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const tabs = screen.getAllByRole("tab");
        tabs.forEach((tab) => {
          expect(tab).not.toHaveAttribute("tabindex", "-1");
        });
      });
    });

    it("job expand buttons are keyboard focusable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const expandButton = screen.getByRole("button", { name: /Job #job-1/i });
        expect(expandButton).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("pagination buttons are keyboard focusable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const prevButton = screen.getByRole("button", { name: /Previous page/i });
        const nextButton = screen.getByRole("button", { name: /Next page/i });
        expect(prevButton).not.toHaveAttribute("tabindex", "-1");
        expect(nextButton).not.toHaveAttribute("tabindex", "-1");
      });
    });
  });

  describe("Color contrast and visual clarity", () => {
    it("error message has distinct red styling for contrast", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            error: "Failed to fetch jobs",
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveClass("bg-red-950/20", "border-red-800", "text-red-400");
      });
    });

    it("search input has visible border for contrast", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).toHaveClass("border", "border-gray-700");
      });
    });

    it("active tab has sufficient contrast with background", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const activeTab = screen.getByRole("tab", { name: /Filter jobs: All/i });
        expect(activeTab).toHaveClass("bg-indigo-600", "text-white");
      });
    });

    it("inactive tabs have visible text color for contrast", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const inactiveTab = screen.getByRole("tab", { name: /Filter jobs: As Client/i });
        expect(inactiveTab).toHaveClass("text-gray-300");
      });
    });

    it("disabled pagination buttons have opacity reduced for visual distinction", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const prevButton = screen.getByRole("button", { name: /Previous page/i });
        expect(prevButton).toHaveClass("disabled:opacity-50");
      });
    });
  });

  describe("Screen reader announcements", () => {
    it("sr-only class hides label text visually but exposes to screen readers", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const label = screen.getByText("Search by contract or job ID");
        expect(label).toHaveClass("sr-only");
      });
    });

    it("aria-hidden hides decorative elements from screen readers", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      const expandButton = await screen.findByRole("button", {
        name: /Job #job-1/i,
      });
      if (expandButton.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        const decorativeText = screen.queryByText("Collapse", {
          selector: "[aria-hidden='true']",
        });
        expect(decorativeText).toBeInTheDocument();
      });
    });

    it("role=status exposes dynamic wallet connection info to screen readers", () => {
      mockUseWallet.mockReturnValue({
        address: null,
        signTransaction: vi.fn(),
      });

      render(<Dashboard />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("role=alert exposes error messages to screen readers immediately", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            error: "Connection failed",
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveAttribute("aria-live", "assertive");
      });
    });
  });
});
