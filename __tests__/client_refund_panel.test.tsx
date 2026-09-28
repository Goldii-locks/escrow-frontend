import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClientRefundPanel from "@/app/components/ClientRefundPanel";

describe("ClientRefundPanel component (#503, #502)", () => {
  it("renders structured loading skeleton while loading", () => {
    render(<ClientRefundPanel isLoading={true} />);

    const loader = screen.getByTestId("client-refund-panel-loading");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("aria-busy", "true");
  });

  it("renders mock dataset refund entries and panel elements", () => {
    render(<ClientRefundPanel escrowId="ESC-999" />);

    expect(screen.getByTestId("client-refund-panel")).toBeInTheDocument();
    expect(screen.getByText("Client Refund Panel")).toBeInTheDocument();
    expect(screen.getByText("Escrow ID: ESC-999")).toBeInTheDocument();
    expect(screen.getByText("Fullstack web application")).toBeInTheDocument();
    expect(screen.getByText("Smart contract audit")).toBeInTheDocument();
  });

  it("ignores input containing code tags in form fields (#502)", () => {
    render(<ClientRefundPanel />);

    const reasonInput = screen.getByTestId("client-refund-reason-input");
    const amountInput = screen.getByTestId("client-refund-amount-input");

    // Input code tag into reason
    fireEvent.change(reasonInput, {
      target: { value: "<script>alert('xss')</script>" },
    });
    expect(reasonInput).toHaveValue("");
    expect(screen.getByTestId("client-refund-error")).toBeInTheDocument();

    // Input code tag into amount
    fireEvent.change(amountInput, {
      target: { value: "100<img src=x onerror=alert(1)>" },
    });
    expect(amountInput).toHaveValue("");
  });

  it("submits sanitized valid inputs", async () => {
    const handleSubmit = vi.fn();
    render(<ClientRefundPanel onSubmitRefund={handleSubmit} />);

    const reasonInput = screen.getByTestId("client-refund-reason-input");
    const amountInput = screen.getByTestId("client-refund-amount-input");
    const submitBtn = screen.getByTestId("client-refund-submit-button");

    fireEvent.change(amountInput, { target: { value: "250.00" } });
    fireEvent.change(reasonInput, {
      target: { value: "Delayed deliverables without update." },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        amount: "250.00",
        reason: "Delayed deliverables without update.",
      });
    });
  });
});
