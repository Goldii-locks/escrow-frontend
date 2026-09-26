import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FreelancerClaimPanel from "@/app/components/FreelancerClaimPanel";

describe("freelancer_claim_panel", () => {
  it("renders structured loading skeleton placeholders while loading queries run", () => {
    render(<FreelancerClaimPanel isLoading={true} />);

    const loadingContainer = screen.getByTestId("freelancer-claim-panel-loading");
    expect(loadingContainer).toBeInTheDocument();
    expect(loadingContainer).toHaveAttribute("aria-busy", "true");

    const skeleton = screen.getByTestId("loading-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("renders panel elements when loading is complete", () => {
    render(
      <FreelancerClaimPanel
        isLoading={false}
        jobId="JOB-123"
        claimableAmount="150.00 USDC"
      />
    );

    expect(screen.getByTestId("freelancer-claim-panel")).toBeInTheDocument();
    expect(screen.getByText("Freelancer Payout Claim")).toBeInTheDocument();
    expect(screen.getByText("Job ID: JOB-123")).toBeInTheDocument();
    expect(screen.getByText("150.00 USDC")).toBeInTheDocument();
    expect(screen.getByTestId("freelancer-claim-button")).toBeInTheDocument();
  });
});
