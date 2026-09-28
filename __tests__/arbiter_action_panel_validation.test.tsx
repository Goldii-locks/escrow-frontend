/**
 * Validation suite for ArbiterActionPanel: field error indicators and
 * panel-level alerts toggle as validations trigger and clear.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import {
  ARBITER_CONFIRMATION_REQUIRED_ERROR,
  ARBITER_NO_FUNDS_ERROR,
  ARBITER_NO_HANDLER_ERROR,
  ARBITER_OUTCOME_REQUIRED_ERROR,
} from "@/app/lib/arbiter_action_panel";

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) => {
  const onResolve = vi.fn();
  const utils = render(
    <ArbiterActionPanel milestoneIndex={1} onResolve={onResolve} {...props} />,
  );
  return { onResolve, ...utils };
};

const submit = () => screen.getByTestId("arbiter-submit");
const outcomeError = () => screen.queryByTestId("arbiter-outcome-error");
const confirmError = () => screen.queryByTestId("arbiter-confirm-error");

describe("field error indicators", () => {
  it("shows no errors before the first submit", () => {
    renderPanel();
    expect(outcomeError()).not.toBeInTheDocument();
    expect(confirmError()).not.toBeInTheDocument();
  });

  it("shows both errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    const { onResolve } = renderPanel();
    await user.click(submit());
    expect(outcomeError()).toHaveTextContent(ARBITER_OUTCOME_REQUIRED_ERROR);
    expect(confirmError()).toHaveTextContent(ARBITER_CONFIRMATION_REQUIRED_ERROR);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("outlines both outcome options in the danger colour while invalid", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.getByTestId("arbiter-outcome-release")).not.toHaveClass(
      "!border-danger-soft",
    );
    await user.click(submit());
    expect(screen.getByTestId("arbiter-outcome-release")).toHaveClass("!border-danger-soft");
    expect(screen.getByTestId("arbiter-outcome-refund")).toHaveClass("!border-danger-soft");
  });

  it("clears the outcome error as soon as an outcome is picked", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(submit());
    await user.click(screen.getByRole("radio", { name: /Refund/ }));
    expect(outcomeError()).not.toBeInTheDocument();
    expect(screen.getByTestId("arbiter-outcome-refund")).not.toHaveClass(
      "!border-danger-soft",
    );
    // The other field's error is untouched.
    expect(confirmError()).toBeInTheDocument();
  });

  it("clears the confirmation error once ticked, and does not re-raise it on untick", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(submit());
    await user.click(screen.getByRole("checkbox"));
    expect(confirmError()).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(confirmError()).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toHaveAttribute("aria-invalid");
  });

  it("shows only the outcome error when just the confirmation is given", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("checkbox"));
    await user.click(submit());
    expect(outcomeError()).toBeInTheDocument();
    expect(confirmError()).not.toBeInTheDocument();
  });

  it("shows only the confirmation error when just the outcome is given", async () => {
    const user = userEvent.setup();
    const { onResolve } = renderPanel();
    await user.click(screen.getByRole("radio", { name: /Release/ }));
    await user.click(submit());
    expect(outcomeError()).not.toBeInTheDocument();
    expect(confirmError()).toBeInTheDocument();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("re-raises an error when a later submit is invalid again", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(submit());
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("checkbox"));
    expect(confirmError()).not.toBeInTheDocument();
    await user.click(submit());
    expect(confirmError()).toBeInTheDocument();
  });

  it.each([
    ["Release", true],
    ["Refund", false],
  ] as const)("submits %s once valid", async (label, releaseToFreelancer) => {
    const user = userEvent.setup();
    const { onResolve } = renderPanel();
    await user.click(submit());
    await user.click(screen.getByRole("radio", { name: new RegExp(label) }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(submit());
    expect(outcomeError()).not.toBeInTheDocument();
    expect(confirmError()).not.toBeInTheDocument();
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(1, releaseToFreelancer);
  });
});

describe("panel-level alerts", () => {
  it("shows no alert for a valid configuration", () => {
    renderPanel({ escrowAmount: "500" });
    expect(screen.queryByTestId("arbiter-panel-alert")).not.toBeInTheDocument();
  });

  it("alerts when no resolve handler is configured", () => {
    renderPanel({ onResolve: undefined });
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveTextContent(
      ARBITER_NO_HANDLER_ERROR,
    );
  });

  it.each(["0", "-1"])("alerts when escrow amount is %s", (escrowAmount) => {
    renderPanel({ escrowAmount });
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveTextContent(
      ARBITER_NO_FUNDS_ERROR,
    );
    expect(submit()).toBeDisabled();
  });

  it("toggles the alert as the configuration changes", () => {
    const onResolve = vi.fn();
    const { rerender } = render(
      <ArbiterActionPanel milestoneIndex={0} escrowAmount="0" onResolve={onResolve} />,
    );
    expect(screen.getByTestId("arbiter-panel-alert")).toBeInTheDocument();
    rerender(
      <ArbiterActionPanel milestoneIndex={0} escrowAmount="10" onResolve={onResolve} />,
    );
    expect(screen.queryByTestId("arbiter-panel-alert")).not.toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("shows an external error without disabling the controls", () => {
    renderPanel({ errorMessage: "Wallet rejected the request." });
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveTextContent(
      "Wallet rejected the request.",
    );
    expect(submit()).toBeEnabled();
  });

  it("prefers the configuration error over an external error", () => {
    renderPanel({ onResolve: undefined, errorMessage: "Something else" });
    expect(screen.getByTestId("arbiter-panel-alert")).toHaveTextContent(
      ARBITER_NO_HANDLER_ERROR,
    );
  });
});

describe("transaction status", () => {
  it("hides the status banner while idle", () => {
    renderPanel({ resolveState: { phase: "idle", error: null, txHash: null } });
    expect(screen.queryByTestId("arbiter-panel-status")).not.toBeInTheDocument();
  });

  it("surfaces a failed transaction as an alert", () => {
    renderPanel({
      resolveState: { phase: "error", error: "Contract call failed", txHash: null },
    });
    const status = screen.getByTestId("arbiter-panel-status");
    expect(status).toHaveTextContent("Contract call failed");
    expect(status.querySelector("[role='alert']")).not.toBeNull();
  });

  it("confirms a successful resolution", () => {
    renderPanel({ resolveState: { phase: "success", error: null, txHash: null } });
    expect(screen.getByTestId("arbiter-panel-status")).toHaveTextContent(
      "Dispute resolved successfully",
    );
  });
});
