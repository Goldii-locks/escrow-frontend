import { render, screen, waitFor } from "@testing-library/react";
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

describe("Dashboard — responsive design", () => {
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

  describe("Mobile viewport (< 640px)", () => {
    it("renders with proper mobile padding and spacing", async () => {
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
        const main = screen.getByRole("main");
        expect(main).toHaveClass("px-3", "py-6");
      });
    });

    it("displays mobile-optimized heading size", async () => {
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
        const heading = screen.getByRole("heading", { name: "Job Dashboard" });
        expect(heading).toHaveClass("text-xl");
      });
    });

    it("stacks search form vertically on mobile", async () => {
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
        const form = screen.getByRole("main").querySelector("form");
        expect(form).toHaveClass("flex-col");
      });
    });

    it("makes search button full-width on mobile", async () => {
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
        const button = screen.getByRole("button", { name: "Submit search query" });
        expect(button).toHaveClass("w-full", "sm:w-auto");
      });
    });

    it("displays filter buttons with reduced padding on mobile", async () => {
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
        const filterButtons = screen.getAllByRole("tab");
        const roleButton = filterButtons.find((btn) => btn.textContent === "All");
        expect(roleButton).toHaveClass("px-2.5", "sm:px-3");
      });
    });

    it("stacks job header and badges vertically on mobile", async () => {
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
        const main = screen.getByRole("main");
        const jobButtons = main.querySelectorAll("button[aria-expanded]");
        expect(jobButtons.length).toBeGreaterThan(0);
        const jobButton = jobButtons[0];
        const childDiv = jobButton.querySelector("div");
        expect(childDiv).toHaveClass("flex-col");
      });
    });

    it("uses responsive font sizes for mobile", async () => {
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
        const main = screen.getByRole("main");
        const jobTitle = main.querySelector("p.font-semibold");
        expect(jobTitle).toHaveClass("text-sm", "sm:text-base");
      });
    });
  });

  describe("Tablet viewport (640px - 1024px)", () => {
    it("displays medium padding on tablet", async () => {
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
        expect(main).toHaveClass("px-3", "sm:px-6");
      });
    });

    it("shows tablet-optimized heading size", async () => {
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
        const heading = screen.getByRole("heading", { name: "Job Dashboard" });
        expect(heading).toHaveClass("sm:text-2xl");
      });
    });

    it("arranges search form horizontally on tablet", async () => {
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
        const form = screen.getByRole("main").querySelector("form");
        expect(form).toHaveClass("sm:gap-3");
      });
    });

    it("displays expanded content with 2-column grid on tablet", async () => {
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
        const main = screen.getByRole("main");
        const gridDiv = main.querySelector(".grid");
        expect(gridDiv).toHaveClass("grid-cols-1");
        expect(gridDiv).toHaveClass("sm:grid-cols-2");
      });
    });
  });

  describe("Desktop viewport (> 1024px)", () => {
    it("displays desktop heading size", async () => {
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
        const heading = screen.getByRole("heading", { name: "Job Dashboard" });
        expect(heading).toHaveClass("md:text-3xl");
      });
    });

    it("shows full 3-column grid for expanded job details on desktop", async () => {
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
        const main = screen.getByRole("main");
        const gridDiv = main.querySelector(".grid");
        expect(gridDiv).toHaveClass("grid-cols-1");
        expect(gridDiv).toHaveClass("lg:grid-cols-3");
      });
    });

    it("displays max-width container properly on desktop", async () => {
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
        expect(main).toHaveClass("max-w-5xl");
      });
    });
  });

  describe("Typography responsiveness", () => {
    it("uses responsive font sizes for job title", async () => {
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
        const main = screen.getByRole("main");
        const title = main.querySelector("p.font-semibold");
        expect(title).toHaveClass("text-sm", "sm:text-base");
      });
    });

    it("scales pagination buttons responsively", async () => {
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
              {
                id: "job-2",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 1,
            total: 2,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const paginationButton = buttons.find((btn) => btn.textContent === "1");
        expect(paginationButton).toHaveClass("text-xs", "sm:text-sm");
      });
    });
  });

  describe("Spacing and gaps responsive", () => {
    it("applies responsive gaps to main container", async () => {
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
        const main = screen.getByRole("main");
        const contentDiv = main.querySelector(".space-y-4");
        expect(contentDiv).toHaveClass("sm:space-y-6");
      });
    });

    it("uses responsive padding for job buttons", async () => {
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
        const main = screen.getByRole("main");
        const jobButton = main.querySelector("button[aria-expanded]");
        expect(jobButton).toHaveClass("px-3", "sm:px-5");
      });
    });
  });

  describe("Container overflow handling", () => {
    it("handles overflow properly for long job IDs on mobile", async () => {
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
        const main = screen.getByRole("main");
        const title = main.querySelector("p.font-semibold");
        expect(title).toHaveClass("truncate");
      });
    });

    it("prevents pagination overflow on mobile", async () => {
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
        const main = screen.getByRole("main");
        const paginationContainer = main.querySelector(".overflow-x-auto");
        expect(paginationContainer).toBeInTheDocument();
      });
    });
  });
});
