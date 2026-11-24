import type { ResolutionDisputeData } from "@/app/lib/resolution_vote_form";

export const MOCK_RESOLUTION_DISPUTES: Record<string, ResolutionDisputeData> = {
  "disp-101": {
    disputeId: "disp-101",
    jobId: "job-7",
    amount: "1,500 XLM",
    currentSplit: { clientBps: 5_000, freelancerBps: 5_000 },
    arbitratorStatus: "eligible",
    deadline: "2026-10-05T12:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "full-refund", label: "Full refund to client", clientBps: 10_000, freelancerBps: 0 },
      { id: "even-split", label: "Even split", clientBps: 5_000, freelancerBps: 5_000 },
      {
        id: "full-release",
        label: "Full release to freelancer",
        clientBps: 0,
        freelancerBps: 10_000,
      },
    ],
  },
  "disp-102": {
    disputeId: "disp-102",
    jobId: "job-9",
    amount: "800 XLM",
    currentSplit: { clientBps: 3_000, freelancerBps: 7_000 },
    arbitratorStatus: "voted",
    deadline: "2026-10-01T12:00:00Z",
    resolved: false,
    voteOptions: [
      { id: "favor-client", label: "Favor client (70/30)", clientBps: 7_000, freelancerBps: 3_000 },
      {
        id: "favor-freelancer",
        label: "Favor freelancer (30/70)",
        clientBps: 3_000,
        freelancerBps: 7_000,
      },
    ],
  },
};
