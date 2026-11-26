// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JobAcceptancePanel from "@/app/components/JobAcceptancePanel";

/** Renders the panel with the viewer's role; acceptance state is per test. */
function renderPanel(
  acceptance: { freelancerAccepted: boolean; arbiterAccepted: boolean } | null,
  {
    isFreelancer = false,
    isArbiter = false,
    loading = false,
    ...handlers
  }: {
    isFreelancer?: boolean;
    isArbiter?: boolean;
    loading?: boolean;
    onAcceptJob?: () => void;
    onAcceptArbiter?: () => void;
    isAcceptJobPending?: boolean;
    isAcceptArbiterPending?: boolean;
    acceptJobError?: string | null;
    acceptArbiterError?: string | null;
  } = {}
) {
  return render(
    <JobAcceptancePanel
      acceptance={acceptance}
      loading={loading}
      isFreelancer={isFreelancer}
      isArbiter={isArbiter}
      {...handlers}
    />
  );
}

describe("JobAcceptancePanel (#802)", () => {
  it("offers the freelancer Accept job while neither party has accepted", () => {
    const onAcceptJob = vi.fn();
    renderPanel(
      { freelancerAccepted: false, arbiterAccepted: false },
      { isFreelancer: true, onAcceptJob }
    );

    expect(screen.getByTestId("job-acceptance-freelancer")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("job-acceptance-arbiter")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("job-acceptance-waiting")).toHaveTextContent(
      "Waiting for the freelancer and the arbiter to accept"
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
    expect(onAcceptJob).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Accept as arbiter" })).not.toBeInTheDocument();
  });

  it("hides Accept job once the freelancer has accepted", () => {
    renderPanel(
      { freelancerAccepted: true, arbiterAccepted: false },
      { isFreelancer: true, onAcceptJob: vi.fn() }
    );

    expect(screen.getByTestId("job-acceptance-freelancer")).toHaveTextContent("Accepted");
    expect(screen.getByTestId("job-acceptance-arbiter")).toHaveTextContent("Waiting");
    expect(screen.queryByRole("button", { name: "Accept job" })).not.toBeInTheDocument();
    expect(screen.getByTestId("job-acceptance-waiting")).toHaveTextContent(
      "Waiting for the arbiter to accept"
    );
  });

  it("offers the arbiter Accept as arbiter until they accept", () => {
    const onAcceptArbiter = vi.fn();
    renderPanel(
      { freelancerAccepted: true, arbiterAccepted: false },
      { isArbiter: true, onAcceptArbiter }
    );

    expect(screen.queryByRole("button", { name: "Accept job" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept as arbiter" }));
    expect(onAcceptArbiter).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("job-acceptance-waiting")).toHaveTextContent(
      "Waiting for the arbiter to accept"
    );
  });

  it("shows the completed state with no buttons once both accepted", () => {
    renderPanel(
      { freelancerAccepted: true, arbiterAccepted: true },
      { isFreelancer: true, isArbiter: true, onAcceptJob: vi.fn(), onAcceptArbiter: vi.fn() }
    );

    expect(screen.getByTestId("job-acceptance-complete")).toHaveTextContent(
      "Both parties accepted"
    );
    expect(screen.queryByTestId("job-acceptance-waiting")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });

  it("still offers acceptance when the state could not be read", () => {
    renderPanel(null, { isFreelancer: true, onAcceptJob: vi.fn() });

    expect(screen.getByTestId("job-acceptance-unknown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept job" })).toBeInTheDocument();
  });

  it("shows a checking state while the first read is in flight", () => {
    renderPanel(null, { isFreelancer: true, loading: true, onAcceptJob: vi.fn() });

    expect(screen.getByText("Checking acceptance…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept job" })).not.toBeInTheDocument();
  });

  it("renders accept errors and disables the button while pending", () => {
    renderPanel(
      { freelancerAccepted: false, arbiterAccepted: false },
      {
        isFreelancer: true,
        onAcceptJob: vi.fn(),
        isAcceptJobPending: true,
        acceptJobError: "The contract rejected this transaction.",
      }
    );

    expect(screen.getByTestId("accept-job-error")).toHaveTextContent(
      "The contract rejected this transaction."
    );
    expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
  });
});
