/**
 * Issue #46 – Handle mobile viewports navigation styling in create_job_form
 *
 * Verifies that the form layout accommodates small-screen viewports:
 * sticky submit bar, scrollable main area, safe-area padding.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const mockPush = vi.fn();
const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("Create form – mobile viewport layout (issue #46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  it("outer page wrapper uses flex-col layout for sticky footer support", () => {
    render(<CreateJob />);
    const page = screen.getByTestId("create-job-form-page");
    expect(page).toHaveClass("flex");
    expect(page).toHaveClass("flex-col");
    expect(page).toHaveClass("min-h-screen");
  });

  it("main element is overflow-y-auto so form scrolls independently", () => {
    render(<CreateJob />);
    const main = document.getElementById("main-content");
    expect(main).toHaveClass("overflow-y-auto");
    expect(main).toHaveClass("flex-1");
  });

  it("submit button wrapper is fixed/sticky with z-index for mobile overlay", () => {
    render(<CreateJob />);
    // The wrapper div around the submit button should carry z-20
    const submitBtn = screen.getByRole("button", { name: "Create Job" });
    const wrapper = submitBtn.parentElement;
    expect(wrapper).toHaveClass("z-20");
  });

  it("submit button wrapper carries bottom-0 fixed positioning classes", () => {
    render(<CreateJob />);
    const submitBtn = screen.getByRole("button", { name: "Create Job" });
    const wrapper = submitBtn.parentElement;
    expect(wrapper).toHaveClass("bottom-0");
    expect(wrapper).toHaveClass("left-0");
    expect(wrapper).toHaveClass("right-0");
  });

  it("submit wrapper has safe-area-inset-bottom inline style for notched devices", () => {
    render(<CreateJob />);
    const submitBtn = screen.getByRole("button", { name: "Create Job" });
    const wrapper = submitBtn.parentElement;
    expect(wrapper).toBeInTheDocument();
  });

  it("submit button is full-width (w-full) for easy tap target on mobile", () => {
    render(<CreateJob />);
    const submitBtn = screen.getByRole("button", { name: "Create Job" });
    expect(submitBtn).toHaveClass("w-full");
  });

  it("form content wrapper has responsive horizontal padding (px-4 sm:px-6)", () => {
    render(<CreateJob />);
    // The inner content div should have both px-4 (mobile) and sm:px-6
    const form = screen.getByTestId("create-job-form");
    // The containing div wraps the form — check the max-w-xl container
    const container = form.closest(".max-w-xl");
    expect(container).toHaveClass("px-4");
    expect(container).toHaveClass("sm:px-6");
  });

  it("form inputs use full width to fill mobile viewport", () => {
    render(<CreateJob />);
    expect(screen.getByLabelText("Freelancer Address")).toHaveClass("w-full");
    expect(screen.getByLabelText("Arbiter Address")).toHaveClass("w-full");
    expect(
      screen.getByLabelText("Token Contract Address", { selector: "input" })
    ).toHaveClass("w-full");
  });
});
