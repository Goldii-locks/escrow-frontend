import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Dashboard — interactive states (hover, focus, disabled)", () => {
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

  describe("Search input focus states", () => {
    it("displays focus-visible ring on search input", async () => {
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
        const input = screen.getByPlaceholderText("Search by contract/job ID");
        expect(input).toHaveClass("focus-visible:ring-2");
        expect(input).toHaveClass("focus-visible:ring-indigo-500");
      });
    });

    it("shows hover state on search input", async () => {
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
        expect(input).toHaveClass("hover:border-gray-600");
      });
    });

    it("has transition animation on search input focus", async () => {
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
        expect(input).toHaveClass("transition-all", "duration-200");
      });
    });
  });

  describe("Search button states", () => {
    it("displays focus-visible ring on search button", async () => {
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
        expect(button).toHaveClass("focus-visible:ring-2");
        expect(button).toHaveClass("focus-visible:ring-indigo-500");
      });
    });

    it("shows hover state on search button", async () => {
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
        expect(button).toHaveClass("hover:bg-indigo-500");
      });
    });

    it("shows active state on search button", async () => {
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
        expect(button).toHaveClass("active:bg-indigo-700");
      });
    });
  });

  describe("Role filter button states", () => {
    it("applies active state styling to selected filter", async () => {
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
        const buttons = screen.getAllByRole("tab");
        const allButton = buttons.find((btn) => btn.textContent === "All");
        expect(allButton).toHaveClass("bg-indigo-600");
        expect(allButton).toHaveClass("border-indigo-500");
      });
    });

    it("shows hover state on inactive filter button", async () => {
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
        const buttons = screen.getAllByRole("tab");
        const clientButton = buttons.find((btn) => btn.textContent === "As Client");
        expect(clientButton).toHaveClass("hover:text-white");
        expect(clientButton).toHaveClass("hover:border-gray-600");
        expect(clientButton).toHaveClass("hover:bg-gray-800");
      });
    });

    it("shows active state on filter button click", async () => {
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
        const buttons = screen.getAllByRole("tab");
        const filterButton = buttons.find((btn) => btn.textContent === "As Client");
        expect(filterButton).toHaveClass("active:bg-gray-700");
      });
    });

    it("displays focus-visible ring on filter buttons", async () => {
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
        const buttons = screen.getAllByRole("tab");
        const filterButton = buttons.find((btn) => btn.textContent === "As Freelancer");
        expect(filterButton).toHaveClass("focus-visible:ring-2");
        expect(filterButton).toHaveClass("focus-visible:ring-indigo-500");
      });
    });

    it("has transition animation on filter button interactions", async () => {
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
        const buttons = screen.getAllByRole("tab");
        const filterButton = buttons.find((btn) => btn.textContent === "As Arbiter");
        expect(filterButton).toHaveClass("transition-all", "duration-200");
      });
    });
  });

  describe("Job expand button states", () => {
    it("shows hover state on job expand button", async () => {
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
        expect(jobButton).toHaveClass("hover:bg-gray-800/50");
      });
    });

    it("shows active state on job expand button", async () => {
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
        expect(jobButton).toHaveClass("active:bg-gray-800/75");
      });
    });

    it("displays focus-visible ring on job expand button", async () => {
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
        expect(jobButton).toHaveClass("focus-visible:ring-2");
        expect(jobButton).toHaveClass("focus-visible:ring-indigo-500");
      });
    });

    it("has inset focus ring on job expand button", async () => {
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
        expect(jobButton).toHaveClass("focus-visible:ring-inset");
      });
    });
  });

  describe("Pagination button states", () => {
    it("displays focus-visible ring on pagination buttons", async () => {
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
        expect(prevButton).toHaveClass("focus-visible:ring-2");
        expect(prevButton).toHaveClass("focus-visible:ring-indigo-500");
      });
    });

    it("shows disabled state styling on disabled Previous button", async () => {
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
        expect(prevButton).toHaveClass("disabled:cursor-not-allowed");
      });
    });

    it("prevents hover state on disabled pagination button", async () => {
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
        expect(prevButton).toHaveClass("disabled:hover:bg-gray-900");
        expect(prevButton).toHaveClass("disabled:hover:border-gray-700");
      });
    });

    it("shows hover state on inactive pagination button", async () => {
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
        expect(nextButton).toHaveClass("hover:bg-gray-800");
        expect(nextButton).toHaveClass("hover:border-gray-600");
      });
    });

    it("shows active state on pagination button", async () => {
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
        expect(nextButton).toHaveClass("active:bg-gray-700");
      });
    });

    it("has smooth transition on pagination button state changes", async () => {
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
        expect(nextButton).toHaveClass("transition-all", "duration-200");
      });
    });

    it("applies ring offset to focus state", async () => {
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
        expect(prevButton).toHaveClass("focus-visible:ring-offset-2");
        expect(prevButton).toHaveClass("focus-visible:ring-offset-gray-950");
      });
    });
  });

  describe("Accessibility compliance", () => {
    it("all buttons have visible focus indicators", async () => {
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
        const buttons = screen.getAllByRole("button");
        buttons.forEach((button) => {
          expect(button).toHaveClass("focus-visible:ring-2");
        });
      });
    });

    it("disabled buttons have proper cursor styling", async () => {
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
        expect(prevButton).toHaveClass("disabled:cursor-not-allowed");
      });
    });

    it("interactive elements have smooth transitions", async () => {
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
        const buttons = screen.getAllByRole("button");
        buttons.forEach((button) => {
          expect(button.className).toMatch(/transition-all|transition/);
        });
      });
    });
  });
});
