import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("CreateJob form — layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [{ address: "CTOKEN", symbol: "USDC" }] }),
      }),
    );
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("page shell", () => {
    it("renders the top-level page wrapper", () => {
      render(<CreateJob />);
      expect(screen.getByTestId("create-job-form-page")).toBeInTheDocument();
    });

    it("renders the navbar", () => {
      render(<CreateJob />);
      expect(screen.getByTestId("navbar")).toBeInTheDocument();
    });

    it("renders the page heading", () => {
      render(<CreateJob />);
      expect(
        screen.getByRole("heading", { name: "Create New Job" })
      ).toBeInTheDocument();
    });
  });

  describe("form element", () => {
    it("renders the form node", () => {
      render(<CreateJob />);
      expect(screen.getByTestId("create-job-form")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      render(<CreateJob />);
      expect(
        screen.getByRole("button", { name: "Create Job" })
      ).toBeInTheDocument();
    });
  });

  describe("input fields", () => {
    it("renders the Freelancer Address label and input", () => {
      render(<CreateJob />);
      expect(
        screen.getByLabelText("Freelancer Address")
      ).toBeInTheDocument();
    });

    it("renders the Arbiter Address label and input", () => {
      render(<CreateJob />);
      expect(screen.getByLabelText("Arbiter Address")).toBeInTheDocument();
    });

    it("renders the Token Contract Address label and input", () => {
      render(<CreateJob />);
      expect(
        screen.getByLabelText("Token Contract Address")
      ).toBeInTheDocument();
    });

    it("renders the Response Deadline label and input", () => {
      render(<CreateJob />);
      expect(
        screen.getByLabelText("Response Deadline (days)")
      ).toBeInTheDocument();
    });

    it("defaults Response Deadline to 7", () => {
      render(<CreateJob />);
      const deadline = screen.getByLabelText(
        "Response Deadline (days)"
      ) as HTMLInputElement;
      expect(deadline.value).toBe("7");
    });

    it("renders Freelancer Address input with placeholder 'G...'", () => {
      render(<CreateJob />);
      expect(
        screen.getAllByPlaceholderText("G...", { exact: false })[0]
      ).toBeInTheDocument();
    });

    it("renders the Token Contract Address field as a select (token whitelist dropdown)", () => {
      render(<CreateJob />);
      expect(screen.getByLabelText("Token Contract Address").tagName).toBe("SELECT");
    });
  });

  describe("milestones section — initial state (one milestone pre-populated)", () => {
    it("renders the milestone list container", () => {
      render(<CreateJob />);
      expect(screen.getByTestId("milestone-list")).toBeInTheDocument();
    });

    it("renders the first milestone amount input", () => {
      render(<CreateJob />);
      expect(screen.getByLabelText("Milestone 1 amount")).toBeInTheDocument();
    });

    it("renders the remove button for the first milestone", () => {
      render(<CreateJob />);
      expect(
        screen.getByRole("button", { name: "Remove milestone 1" })
      ).toBeInTheDocument();
    });

    it("renders the '+ Add Milestone' button", () => {
      render(<CreateJob />);
      expect(
        screen.getByRole("button", { name: "+ Add Milestone" })
      ).toBeInTheDocument();
    });
  });

  describe("form validation messaging", () => {
    it("shows partial milestone warning when milestone input is empty", () => {
      render(<CreateJob />);
      expect(
        screen.getByText("Complete each milestone amount to continue.")
      ).toBeInTheDocument();
    });

    it("submit button is disabled while milestone amounts are incomplete", () => {
      render(<CreateJob />);
      expect(
        screen.getByRole("button", { name: "Create Job" })
      ).toBeDisabled();
    });
  });

  describe("wallet disconnected state", () => {
    it("renders 'Connect your wallet' hint when no address is present", () => {
      mockUseWallet.mockReturnValue({ address: null, signTransaction: vi.fn() });
      render(<CreateJob />);
      expect(
        screen.getByText("Connect your wallet to create a job")
      ).toBeInTheDocument();
    });

    it("submit button is disabled when wallet is not connected", () => {
      mockUseWallet.mockReturnValue({ address: null, signTransaction: vi.fn() });
      render(<CreateJob />);
      expect(
        screen.getByRole("button", { name: "Create Job" })
      ).toBeDisabled();
    });
  });

  describe("milestone empty state", () => {
    it("does not render milestone-empty-state on initial load", () => {
      render(<CreateJob />);
      expect(
        screen.queryByTestId("milestone-empty-state")
      ).not.toBeInTheDocument();
    });
  });

  describe("design token classes on structural nodes", () => {
    it("applies bg-surface-page to the page wrapper", () => {
      render(<CreateJob />);
      expect(screen.getByTestId("create-job-form-page")).toHaveClass(
        "bg-surface-page"
      );
    });

    it("applies bg-surface-field to the Freelancer Address input", () => {
      render(<CreateJob />);
      expect(screen.getByLabelText("Freelancer Address")).toHaveClass(
        "bg-surface-field"
      );
    });

    it("applies focus-visible:ring-accent-soft to the Arbiter Address input", () => {
      render(<CreateJob />);
      expect(screen.getByLabelText("Arbiter Address")).toHaveClass(
        "focus-visible:ring-accent-soft"
      );
    });
  });
});
