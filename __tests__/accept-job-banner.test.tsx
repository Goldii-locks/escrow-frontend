import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AcceptJobBanner from "@/app/components/AcceptJobBanner";
import type { ActionState } from "@/app/hooks/useActionStates";

const idleState: ActionState = { phase: "idle" };

describe("AcceptJobBanner", () => {
  it("renders nothing when both accepted (true)", () => {
    const { container } = render(
      <AcceptJobBanner
        freelancerAccepted={true}
        arbiterAccepted={true}
        isFreelancer={false}
        isArbiter={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when both undefined (graceful degradation)", () => {
    const { container } = render(
      <AcceptJobBanner
        isFreelancer={false}
        isArbiter={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when freelancerAccepted is undefined and arbiterAccepted is undefined", () => {
    const { container } = render(
      <AcceptJobBanner isFreelancer={true} isArbiter={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the banner when freelancerAccepted=false", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
      />
    );
    expect(screen.getByTestId("accept-job-banner")).toBeTruthy();
  });

  it("shows the banner when arbiterAccepted=false", () => {
    render(
      <AcceptJobBanner
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={true}
      />
    );
    expect(screen.getByTestId("accept-job-banner")).toBeTruthy();
  });

  it("shows accept-job-button when freelancerAccepted=false and isFreelancer=true", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
      />
    );
    expect(screen.getByTestId("accept-job-button")).toBeTruthy();
  });

  it("shows 'Waiting for freelancer' when freelancerAccepted=false and isFreelancer=false", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={false}
        isArbiter={false}
      />
    );
    expect(screen.getByText("Waiting for freelancer")).toBeTruthy();
    expect(screen.queryByTestId("accept-job-button")).toBeNull();
  });

  it("shows accept-arbiter-button when arbiterAccepted=false and isArbiter=true", () => {
    render(
      <AcceptJobBanner
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={true}
      />
    );
    expect(screen.getByTestId("accept-arbiter-button")).toBeTruthy();
  });

  it("shows 'Waiting for arbiter' when arbiterAccepted=false and isArbiter=false", () => {
    render(
      <AcceptJobBanner
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={false}
      />
    );
    expect(screen.getByText("Waiting for arbiter")).toBeTruthy();
    expect(screen.queryByTestId("accept-arbiter-button")).toBeNull();
  });

  it("shows banner with both rows when both false", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={false}
      />
    );
    expect(screen.getByTestId("accept-job-banner")).toBeTruthy();
    expect(screen.getByText("Waiting for freelancer")).toBeTruthy();
    expect(screen.getByText("Waiting for arbiter")).toBeTruthy();
  });

  it("calls onAcceptJob when accept job button is clicked", () => {
    const onAcceptJob = vi.fn();
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
        onAcceptJob={onAcceptJob}
      />
    );
    fireEvent.click(screen.getByTestId("accept-job-button"));
    expect(onAcceptJob).toHaveBeenCalledOnce();
  });

  it("calls onAcceptArbiter when accept arbiter button is clicked", () => {
    const onAcceptArbiter = vi.fn();
    render(
      <AcceptJobBanner
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={true}
        onAcceptArbiter={onAcceptArbiter}
      />
    );
    fireEvent.click(screen.getByTestId("accept-arbiter-button"));
    expect(onAcceptArbiter).toHaveBeenCalledOnce();
  });

  it("disables accept-job-button when escrowLocked=true", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
        escrowLocked={true}
        lockTooltip="Escrow is locked"
      />
    );
    const btn = screen.getByTestId("accept-job-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe("Escrow is locked");
  });

  it("disables accept-arbiter-button when escrowLocked=true", () => {
    render(
      <AcceptJobBanner
        arbiterAccepted={false}
        isFreelancer={false}
        isArbiter={true}
        escrowLocked={true}
        lockTooltip="Escrow is locked"
      />
    );
    const btn = screen.getByTestId("accept-arbiter-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("disables accept-job-button when isAcceptJobPending=true", () => {
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
        isAcceptJobPending={true}
      />
    );
    const btn = screen.getByTestId("accept-job-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText("Accepting…")).toBeTruthy();
  });

  it("renders TxStatusBanner for acceptJobState when provided", () => {
    const errorState: ActionState = { phase: "error", error: "Something failed" };
    render(
      <AcceptJobBanner
        freelancerAccepted={false}
        isFreelancer={true}
        isArbiter={false}
        acceptJobState={errorState}
      />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Something failed")).toBeTruthy();
  });
});
