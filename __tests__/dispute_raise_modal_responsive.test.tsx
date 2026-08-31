import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";
import {
  DISPUTE_MODAL_CLASSES,
  DISPUTE_MODAL_DESKTOP_MIN_WIDTH,
  DISPUTE_MODAL_TABLET_MIN_WIDTH,
  classifyDisputeViewport,
  getDisputeModalLayout,
  validateDisputeReason,
} from "@/app/lib/dispute_raise_modal";

const MODAL = "dispute-raise-modal";
const PANEL = "dispute-raise-modal-panel";
const ACTIONS = "dispute-raise-modal-actions";
const SUMMARY = "dispute-raise-modal-summary";

/** Common device widths used across the viewport assertions. */
const WIDTHS = {
  phoneSmall: 320,
  phone: 375,
  phoneLarge: 414,
  tablet: 768,
  tabletLarge: 1000,
  laptop: 1280,
  desktop: 1920,
};

const originalInnerWidth = window.innerWidth;

/** Resizes the jsdom window and flushes the component's resize listener. */
function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
});

const defaultProps = {
  isOpen: true,
  onClose: () => {},
  jobId: "JOB-000000000000000000000000000000000000000000000001",
  milestoneIndex: 1,
  amount: "500 USDC",
  counterparty: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

// ===========================================================================
// classifyDisputeViewport — breakpoint buckets
// ===========================================================================

describe("dispute_raise_modal classifyDisputeViewport (#332)", () => {
  it("classifies a small phone as mobile", () => {
    expect(classifyDisputeViewport(WIDTHS.phoneSmall)).toBe("mobile");
  });

  it("classifies a 375px phone as mobile", () => {
    expect(classifyDisputeViewport(WIDTHS.phone)).toBe("mobile");
  });

  it("classifies a 414px phone as mobile", () => {
    expect(classifyDisputeViewport(WIDTHS.phoneLarge)).toBe("mobile");
  });

  it("classifies one pixel below the tablet breakpoint as mobile", () => {
    expect(classifyDisputeViewport(DISPUTE_MODAL_TABLET_MIN_WIDTH - 1)).toBe(
      "mobile",
    );
  });

  it("classifies the tablet breakpoint itself as tablet", () => {
    expect(classifyDisputeViewport(DISPUTE_MODAL_TABLET_MIN_WIDTH)).toBe(
      "tablet",
    );
  });

  it("classifies a 768px tablet as tablet", () => {
    expect(classifyDisputeViewport(WIDTHS.tablet)).toBe("tablet");
  });

  it("classifies one pixel below the desktop breakpoint as tablet", () => {
    expect(classifyDisputeViewport(DISPUTE_MODAL_DESKTOP_MIN_WIDTH - 1)).toBe(
      "tablet",
    );
  });

  it("classifies the desktop breakpoint itself as desktop", () => {
    expect(classifyDisputeViewport(DISPUTE_MODAL_DESKTOP_MIN_WIDTH)).toBe(
      "desktop",
    );
  });

  it("classifies a 1920px monitor as desktop", () => {
    expect(classifyDisputeViewport(WIDTHS.desktop)).toBe("desktop");
  });

  it("falls back to mobile for a zero width", () => {
    expect(classifyDisputeViewport(0)).toBe("mobile");
  });

  it("falls back to mobile for a negative width", () => {
    expect(classifyDisputeViewport(-100)).toBe("mobile");
  });

  it("falls back to mobile for NaN", () => {
    expect(classifyDisputeViewport(Number.NaN)).toBe("mobile");
  });

  it("uses Tailwind's sm and lg breakpoints", () => {
    expect(DISPUTE_MODAL_TABLET_MIN_WIDTH).toBe(640);
    expect(DISPUTE_MODAL_DESKTOP_MIN_WIDTH).toBe(1024);
  });
});

// ===========================================================================
// getDisputeModalLayout — structural decisions per viewport
// ===========================================================================

describe("dispute_raise_modal getDisputeModalLayout (#332)", () => {
  it("stacks the mobile layout into one full-width column", () => {
    const layout = getDisputeModalLayout("mobile");
    expect(layout.fullWidth).toBe(true);
    expect(layout.stackActions).toBe(true);
    expect(layout.stackSummary).toBe(true);
    expect(layout.summaryColumns).toBe(1);
  });

  it("un-stacks the tablet layout into a centered dialog", () => {
    const layout = getDisputeModalLayout("tablet");
    expect(layout.fullWidth).toBe(false);
    expect(layout.stackActions).toBe(false);
    expect(layout.stackSummary).toBe(false);
    expect(layout.summaryColumns).toBe(2);
    expect(layout.maxWidthClass).toBe("sm:max-w-lg");
  });

  it("widens the desktop layout", () => {
    const layout = getDisputeModalLayout("desktop");
    expect(layout.fullWidth).toBe(false);
    expect(layout.stackActions).toBe(false);
    expect(layout.maxWidthClass).toBe("lg:max-w-2xl");
  });

  it("reports the viewport it was resolved for", () => {
    expect(getDisputeModalLayout("tablet").viewport).toBe("tablet");
    expect(getDisputeModalLayout("desktop").viewport).toBe("desktop");
  });
});

// ===========================================================================
// Responsive Tailwind classes — mobile-first, resize and stack
// ===========================================================================

describe("DisputeRaiseModal responsive classes (#332)", () => {
  it("bottom-aligns the sheet on mobile and centers it from sm:", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const overlay = screen.getByTestId(MODAL);
    expect(overlay).toHaveClass("items-end");
    expect(overlay).toHaveClass("sm:items-center");
  });

  it("allows the overlay to scroll rather than clipping a tall panel", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    expect(screen.getByTestId(MODAL)).toHaveClass("overflow-y-auto");
  });

  it("renders the panel full-width on mobile", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const panel = screen.getByTestId(PANEL);
    expect(panel).toHaveClass("w-full");
    expect(panel).toHaveClass("max-w-full");
  });

  it("caps the panel width at sm: and widens it again at lg:", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const panel = screen.getByTestId(PANEL);
    expect(panel).toHaveClass("sm:max-w-lg");
    expect(panel).toHaveClass("lg:max-w-2xl");
  });

  it("scales panel padding up across the breakpoints", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const panel = screen.getByTestId(PANEL);
    expect(panel).toHaveClass("p-4");
    expect(panel).toHaveClass("sm:p-6");
    expect(panel).toHaveClass("lg:p-8");
  });

  it("bounds the panel height so it never exceeds the viewport", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const panel = screen.getByTestId(PANEL);
    expect(panel).toHaveClass("max-h-[92vh]");
    expect(panel).toHaveClass("overflow-y-auto");
  });

  it("stacks the summary into one column on mobile and two from sm:", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const summary = screen.getByTestId(SUMMARY);
    expect(summary).toHaveClass("grid-cols-1");
    expect(summary).toHaveClass("sm:grid-cols-2");
  });

  it("stacks the footer actions on mobile and rows them from sm:", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const actions = screen.getByTestId(ACTIONS);
    expect(actions).toHaveClass("flex-col-reverse");
    expect(actions).toHaveClass("sm:flex-row");
    expect(actions).toHaveClass("sm:justify-end");
  });

  it("gives the action buttons full-width tap targets on mobile", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const confirm = screen.getByTestId("dispute-raise-modal-confirm");
    expect(confirm).toHaveClass("w-full");
    expect(confirm).toHaveClass("sm:w-auto");
  });

  it("meets the 44px minimum touch target on the action buttons", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    expect(screen.getByTestId("dispute-raise-modal-confirm")).toHaveClass(
      "min-h-[44px]",
    );
    expect(screen.getByTestId("dispute-raise-modal-cancel")).toHaveClass(
      "min-h-[44px]",
    );
  });

  it("meets the 44px minimum touch target on the close button", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const close = screen.getByTestId("dispute-raise-modal-close");
    expect(close).toHaveClass("min-h-[44px]");
    expect(close).toHaveClass("min-w-[44px]");
  });

  it("scales the title up with the panel", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const title = screen.getByTestId("dispute-raise-modal-title");
    expect(title).toHaveClass("text-base");
    expect(title).toHaveClass("sm:text-lg");
    expect(title).toHaveClass("lg:text-xl");
  });

  it("wraps long identifiers instead of forcing horizontal scroll", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    expect(screen.getByTestId("dispute-raise-modal-job")).toHaveClass(
      "break-all",
    );
    expect(screen.getByTestId("dispute-raise-modal-counterparty")).toHaveClass(
      "break-all",
    );
  });

  it("keeps summary cells shrinkable so truncation can engage", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const cell = screen.getByTestId("dispute-raise-modal-job").parentElement;
    expect(cell).toHaveClass("min-w-0");
  });

  it("grows the reason field on larger viewports", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const textarea = screen.getByTestId("dispute-raise-modal-reason");
    expect(textarea).toHaveClass("min-h-[96px]");
    expect(textarea).toHaveClass("sm:min-h-[120px]");
  });

  it("exports mobile-first class strings with no bare desktop-only widths", () => {
    expect(DISPUTE_MODAL_CLASSES.panel).toContain("w-full");
    expect(DISPUTE_MODAL_CLASSES.actions).toContain("flex-col-reverse");
    expect(DISPUTE_MODAL_CLASSES.summary).toContain("grid-cols-1");
  });
});

// ===========================================================================
// Rendering at varying viewport sizes
// ===========================================================================

describe("DisputeRaiseModal at varying viewport sizes (#332)", () => {
  it("reports the mobile layout at 375px", async () => {
    setViewportWidth(WIDTHS.phone);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "mobile",
      );
    });
    expect(screen.getByTestId(PANEL)).toHaveAttribute("data-full-width", "true");
    expect(screen.getByTestId(ACTIONS)).toHaveAttribute("data-stacked", "true");
    expect(screen.getByTestId(SUMMARY)).toHaveAttribute("data-columns", "1");
  });

  it("reports the mobile layout at 414px", async () => {
    setViewportWidth(WIDTHS.phoneLarge);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "mobile",
      );
    });
  });

  it("reports the tablet layout at 768px", async () => {
    setViewportWidth(WIDTHS.tablet);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "tablet",
      );
    });
    expect(screen.getByTestId(PANEL)).toHaveAttribute(
      "data-full-width",
      "false",
    );
    expect(screen.getByTestId(ACTIONS)).toHaveAttribute("data-stacked", "false");
    expect(screen.getByTestId(SUMMARY)).toHaveAttribute("data-columns", "2");
  });

  it("reports the desktop layout at 1280px", async () => {
    setViewportWidth(WIDTHS.laptop);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "desktop",
      );
    });
    expect(screen.getByTestId(PANEL)).toHaveAttribute(
      "data-max-width",
      "lg:max-w-2xl",
    );
  });

  it("restacks when the viewport shrinks from desktop to mobile", async () => {
    setViewportWidth(WIDTHS.desktop);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "desktop",
      );
    });

    setViewportWidth(WIDTHS.phone);
    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toHaveAttribute(
        "data-viewport",
        "mobile",
      );
    });
    expect(screen.getByTestId(ACTIONS)).toHaveAttribute("data-stacked", "true");
  });

  it("un-stacks when the viewport grows from mobile to tablet", async () => {
    setViewportWidth(WIDTHS.phone);
    render(<DisputeRaiseModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId(SUMMARY)).toHaveAttribute("data-columns", "1");
    });

    setViewportWidth(WIDTHS.tabletLarge);
    await waitFor(() => {
      expect(screen.getByTestId(SUMMARY)).toHaveAttribute("data-columns", "2");
    });
  });

  it("renders every content region at each viewport size", async () => {
    for (const width of [WIDTHS.phone, WIDTHS.tablet, WIDTHS.laptop]) {
      setViewportWidth(width);
      const { unmount } = render(<DisputeRaiseModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId(PANEL)).toBeInTheDocument();
      });
      expect(screen.getByTestId("dispute-raise-modal-title")).toBeInTheDocument();
      expect(screen.getByTestId(SUMMARY)).toBeInTheDocument();
      expect(screen.getByTestId("dispute-raise-modal-reason")).toBeInTheDocument();
      expect(screen.getByTestId("dispute-raise-modal-confirm")).toBeInTheDocument();
      expect(screen.getByTestId("dispute-raise-modal-cancel")).toBeInTheDocument();

      unmount();
    }
  });

  it("stops tracking resizes after unmount", async () => {
    setViewportWidth(WIDTHS.phone);
    const { unmount } = render(<DisputeRaiseModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId(MODAL)).toBeInTheDocument();
    });

    unmount();
    expect(() => setViewportWidth(WIDTHS.desktop)).not.toThrow();
  });
});

// ===========================================================================
// Modal behaviour
// ===========================================================================

describe("DisputeRaiseModal behaviour (#332)", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DisputeRaiseModal {...defaultProps} isOpen={false} />,
    );
    expect(screen.queryByTestId(MODAL)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes the panel as a labelled modal dialog", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    const modal = screen.getByTestId(MODAL);
    expect(modal).toHaveAttribute("role", "dialog");
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(modal).toHaveAttribute("aria-label", "Raise a dispute");
  });

  it("renders the dispute summary values", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    expect(screen.getByTestId("dispute-raise-modal-amount")).toHaveTextContent(
      "500 USDC",
    );
    expect(
      screen.getByTestId("dispute-raise-modal-milestone"),
    ).toHaveTextContent("#2");
  });

  it("labels a job-wide dispute when no milestone is given", () => {
    render(<DisputeRaiseModal {...defaultProps} milestoneIndex={null} />);
    expect(
      screen.getByTestId("dispute-raise-modal-milestone"),
    ).toHaveTextContent("Whole job");
  });

  it("calls onClose from the cancel button", () => {
    const onClose = vi.fn();
    render(<DisputeRaiseModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("dispute-raise-modal-cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<DisputeRaiseModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("dispute-raise-modal-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks confirmation until a reason is supplied", () => {
    const onConfirm = vi.fn();
    render(<DisputeRaiseModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId("dispute-raise-modal-confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("dispute-raise-modal-validation-error"),
    ).toBeInTheDocument();
  });

  it("confirms with the trimmed reason once it is long enough", () => {
    const onConfirm = vi.fn();
    render(<DisputeRaiseModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByTestId("dispute-raise-modal-reason"), {
      target: { value: "  Work was never delivered.  " },
    });
    fireEvent.click(screen.getByTestId("dispute-raise-modal-confirm"));

    expect(onConfirm).toHaveBeenCalledWith("Work was never delivered.");
  });

  it("disables the actions while submitting", () => {
    render(<DisputeRaiseModal {...defaultProps} isSubmitting />);
    expect(screen.getByTestId("dispute-raise-modal-confirm")).toBeDisabled();
    expect(screen.getByTestId("dispute-raise-modal-cancel")).toBeDisabled();
  });

  it("shows a spinner in the confirm button while submitting", () => {
    render(<DisputeRaiseModal {...defaultProps} isSubmitting />);
    const confirm = screen.getByTestId("dispute-raise-modal-confirm");
    expect(confirm.querySelector("svg")).not.toBeNull();
    expect(confirm).toHaveTextContent(/raising dispute/i);
  });

  it("renders a provider error message", () => {
    render(
      <DisputeRaiseModal {...defaultProps} errorMessage="Contract reverted" />,
    );
    const error = screen.getByTestId("dispute-raise-modal-error");
    expect(error).toHaveTextContent("Contract reverted");
    expect(error).toHaveAttribute("role", "alert");
  });
});

// ===========================================================================
// validateDisputeReason
// ===========================================================================

describe("dispute_raise_modal validateDisputeReason (#332)", () => {
  it("rejects an empty reason", () => {
    const result = validateDisputeReason("");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/describe why/i);
  });

  it("rejects a whitespace-only reason", () => {
    expect(validateDisputeReason("     ").valid).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(validateDisputeReason(null).valid).toBe(false);
    expect(validateDisputeReason(undefined).valid).toBe(false);
  });

  it("rejects a reason under the minimum length", () => {
    const result = validateDisputeReason("too short");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/more detail/i);
  });

  it("accepts a reason at the minimum length", () => {
    expect(validateDisputeReason("0123456789").valid).toBe(true);
  });

  it("rejects a reason over the maximum length", () => {
    const result = validateDisputeReason("x".repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too long/i);
  });

  it("accepts a reason at the maximum length", () => {
    expect(validateDisputeReason("x".repeat(500)).valid).toBe(true);
  });

  it("returns no error for a valid reason", () => {
    expect(validateDisputeReason("The freelancer stopped responding.")).toEqual({
      valid: true,
      error: null,
    });
  });
});
