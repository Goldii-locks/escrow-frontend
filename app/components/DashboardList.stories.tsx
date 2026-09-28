import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import LoadingSkeleton from "./LoadingSkeleton";
import EmptyStateCard from "./EmptyStateCard";
import MilestoneCard from "./MilestoneCard";

// Mock job data for stories
const mockJob = (overrides = {}) => ({
  id: "job-1234567890abcdef",
  client: "GCLIENTADDRESS1234567890123456789012345678901234",
  freelancer: "GFREELANCERADDRESS12345678901234567890123456",
  arbiter: "GARBITERADDRESS12345678901234567890123456789012",
  funded: true,
  milestones: [
    { index: 0, amount: "250000000", status: "Pending" },
    { index: 1, amount: "500000000", status: "Delivered" },
  ],
  tokenSymbol: "USDC",
  tokenDecimals: 7,
  ...overrides,
});

const mockJobs = [
  mockJob({ id: "job-1", funded: true }),
  mockJob({ id: "job-2", funded: false }),
  mockJob({ id: "job-3", funded: true, milestones: [] }),
];

const mockActions = {
  partialReleaseState: { phase: "idle" as const, error: null, txHash: null },
  claimAutoReleaseState: { phase: "idle" as const, error: null, txHash: null },
  isPartialReleasePending: false,
  isClaimAutoReleasePending: false,
  onMarkDelivered: fn(),
  onApprove: fn(),
  onDispute: fn(),
  onPartialRelease: fn(),
  onClaimAutoRelease: fn(),
  onResolveDispute: fn(),
};

// Mock components for story isolation
const MockDashboardList = ({ jobs = mockJobs, loading = false, error = null, expandedJobId = null, onExpand = fn() }) => {
  const mockAddress = "GCLIENTADDRESS1234567890123456789012345678901234";

  if (loading) return <LoadingSkeleton data-testid="loading-skeleton" />;

  if (error) {
    return (
      <div className="text-center text-red-400 bg-red-950/20 border border-red-800 rounded-lg p-4" role="alert" aria-live="assertive">
        <p className="font-semibold mb-1">Error loading jobs</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <EmptyStateCard
        testId="dashboard-empty-state"
        ariaLabel="No jobs"
        title="No jobs found"
        description="You don't have any jobs yet. Connect your wallet to see jobs you're involved in as a client, freelancer, or arbiter. Create one to get started."
        icon="briefcase"
        badges={["Client", "Freelancer", "Arbiter"]}
      />
    );
  }

  return (
    <div className="space-y-3" role="region" aria-label="Jobs list">
      <div className="border border-gray-800 rounded-lg bg-gray-900 overflow-hidden overflow-x-auto">
        {jobs.map((job, index) => {
          const isExpanded = expandedJobId === job.id;
          const roleBadges = [
            mockAddress === job.client ? "Client" : null,
            mockAddress === job.freelancer ? "Freelancer" : null,
            mockAddress === job.arbiter ? "Arbiter" : null,
          ].filter(Boolean) as string[];

          return (
            <div key={job.id} data-testid="dashboard-list-item" className="border-b border-gray-800 last:border-b-0">
              <button
                type="button"
                onClick={() => onExpand(job.id)}
                className="w-full text-left px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-800/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                aria-expanded={isExpanded}
                aria-label={`Job #${job.id.slice(0, 8)}, ${job.funded ? "Funded" : "Not funded"}, ${isExpanded ? "collapse details" : "expand details"}`}
                aria-controls={`job-details-${job.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base truncate">Job #{job.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">{job.funded ? "Funded" : "Not funded"}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                    {roleBadges.map((badge) => (
                      <span key={`${job.id}-${badge}`} className="text-xs px-2 py-0.5 sm:py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-200 whitespace-nowrap" role="status" aria-label={`Your role: ${badge}`}>
                        {badge}
                      </span>
                    ))}
                    <span className="text-xs text-indigo-300 whitespace-nowrap" aria-hidden="true">
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div data-testid="dashboard-expanded-panel" id={`job-details-${job.id}`} className="px-3 sm:px-5 pb-3 sm:pb-5 space-y-3 sm:space-y-4 border-t border-gray-800/50" role="region" aria-label={`Details for job #${job.id.slice(0, 8)}`}>
                  {job.milestones?.length ? (
                    job.milestones.map((m) => (
                      <MilestoneCard
                        key={`${job.id}-${m.index}`}
                        milestone={m}
                        isClient={mockAddress === job.client}
                        isFreelancer={mockAddress === job.freelancer}
                        isArbiter={mockAddress === job.arbiter}
                        amountDecimals={job.tokenDecimals ?? 7}
                        amountSymbol={job.tokenSymbol ?? "XLM"}
                        {...mockActions}
                      />
                    ))
                  ) : (
                    <MilestoneCard milestone={null} isClient={false} isFreelancer={false} {...mockActions} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const meta = {
  title: "Components/DashboardList",
  component: MockDashboardList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#030712" },
        { name: "light", value: "#ffffff" },
      ],
    },
  },
  argTypes: {
    loading: { control: "boolean", description: "Show loading skeleton" },
    error: { control: "text", description: "Error message to display" },
    expandedJobId: { control: "text", description: "ID of expanded job" },
    onExpand: { action: "expanded" },
  },
} satisfies Meta<typeof MockDashboardList>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Loading state - skeleton shown
// ---------------------------------------------------------------------------
export const Loading: Story = {
  name: "Loading — skeleton",
  args: {
    loading: true,
    jobs: [],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 2. Error state
// ---------------------------------------------------------------------------
export const Error: Story = {
  name: "Error — backend failure",
  args: {
    loading: false,
    jobs: [],
    error: "Failed to fetch jobs. Please try again later.",
  },
};

// ---------------------------------------------------------------------------
// 3. Empty state - no jobs
// ---------------------------------------------------------------------------
export const Empty: Story = {
  name: "Empty — no jobs found",
  args: {
    loading: false,
    jobs: [],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 4. Single job - funded
// ---------------------------------------------------------------------------
export const SingleJobFunded: Story = {
  name: "Single Job — funded",
  args: {
    loading: false,
    jobs: [mockJob({ id: "job-funded-1", funded: true })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 5. Single job - not funded
// ---------------------------------------------------------------------------
export const SingleJobNotFunded: Story = {
  name: "Single Job — not funded",
  args: {
    loading: false,
    jobs: [mockJob({ id: "job-unfunded-1", funded: false })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 6. Multiple jobs - mixed states
// ---------------------------------------------------------------------------
export const MultipleJobs: Story = {
  name: "Multiple Jobs — mixed funded/unfunded",
  args: {
    loading: false,
    jobs: [
      mockJob({ id: "job-1-funded", funded: true }),
      mockJob({ id: "job-2-unfunded", funded: false }),
      mockJob({ id: "job-3-funded", funded: true }),
    ],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 7. Job with milestones - expanded
// ---------------------------------------------------------------------------
export const ExpandedWithMilestones: Story = {
  name: "Expanded — job with milestones",
  args: {
    loading: false,
    jobs: [
      mockJob({ id: "job-with-milestones", funded: true, milestones: [
        { index: 0, amount: "250000000", status: "Pending" },
        { index: 1, amount: "500000000", status: "Delivered" },
        { index: 2, amount: "750000000", status: "Released" },
      ]}),
    ],
    error: null,
    expandedJobId: "job-with-milestones",
  },
};

// ---------------------------------------------------------------------------
// 8. Job with no milestones - expanded
// ---------------------------------------------------------------------------
export const ExpandedNoMilestones: Story = {
  name: "Expanded — job with no milestones",
  args: {
    loading: false,
    jobs: [mockJob({ id: "job-no-milestones", funded: true, milestones: [] })],
    error: null,
    expandedJobId: "job-no-milestones",
  },
};

// ---------------------------------------------------------------------------
// 9. Role badges - client view
// ---------------------------------------------------------------------------
export const ClientView: Story = {
  name: "Role — client view",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-client-view", 
      funded: true,
      client: "GCURRENTUSER1234567890123456789012345678901234",
      freelancer: "GFREELANCERADDRESS12345678901234567890123456",
    })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 10. Role badges - freelancer view
// ---------------------------------------------------------------------------
export const FreelancerView: Story = {
  name: "Role — freelancer view",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-freelancer-view", 
      funded: true,
      client: "GCLIENTADDRESS1234567890123456789012345678901234",
      freelancer: "GCURRENTUSER1234567890123456789012345678901234",
    })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 11. Role badges - arbiter view
// ---------------------------------------------------------------------------
export const ArbiterView: Story = {
  name: "Role — arbiter view",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-arbiter-view", 
      funded: true,
      client: "GCLIENTADDRESS1234567890123456789012345678901234",
      freelancer: "GFREELANCERADDRESS12345678901234567890123456",
      arbiter: "GCURRENTUSER1234567890123456789012345678901234",
    })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 12. Role badges - multiple roles (client + freelancer)
// ---------------------------------------------------------------------------
export const MultiRoleView: Story = {
  name: "Role — multiple roles (client + freelancer)",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-multi-role", 
      funded: true,
      client: "GCURRENTUSER1234567890123456789012345678901234",
      freelancer: "GCURRENTUSER1234567890123456789012345678901234",
      arbiter: "GARBITERADDRESS12345678901234567890123456789012",
    })],
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 13. Multiple jobs expanded - first expanded
// ---------------------------------------------------------------------------
export const FirstJobExpanded: Story = {
  name: "Multiple — first job expanded",
  args: {
    loading: false,
    jobs: [
      mockJob({ id: "job-1-expanded", funded: true }),
      mockJob({ id: "job-2-collapsed", funded: false }),
      mockJob({ id: "job-3-collapsed", funded: true }),
    ],
    error: null,
    expandedJobId: "job-1-expanded",
  },
};

// ---------------------------------------------------------------------------
// 14. Pagination - many jobs
// ---------------------------------------------------------------------------
export const ManyJobs: Story = {
  name: "Many Jobs — pagination scenario",
  args: {
    loading: false,
    jobs: Array.from({ length: 12 }, (_, i) => 
      mockJob({ id: `job-${i + 1}`, funded: i % 2 === 0 })
    ),
    error: null,
  },
};

// ---------------------------------------------------------------------------
// 15. Large milestone count - layout stress
// ---------------------------------------------------------------------------
export const LargeMilestoneCount: Story = {
  name: "Stress — many milestones",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-many-milestones", 
      funded: true,
      milestones: Array.from({ length: 10 }, (_, i) => ({
        index: i,
        amount: String(100000000 * (i + 1)),
        status: i % 3 === 0 ? "Pending" : i % 3 === 1 ? "Delivered" : "Released",
      })),
    })],
    error: null,
    expandedJobId: "job-many-milestones",
  },
};

// ---------------------------------------------------------------------------
// 16. All states overview
// ---------------------------------------------------------------------------
export const AllStates: Story = {
  name: "All States — overview",
  render: () => (
    <div className="space-y-8 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Loading</h3>
        <MockDashboardList loading jobs={[]} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Error</h3>
        <MockDashboardList loading={false} jobs={[]} error="Failed to connect to backend" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Empty</h3>
        <MockDashboardList loading={false} jobs={[]} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Single Funded</h3>
        <MockDashboardList loading={false} jobs={[mockJob({ funded: true })]} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Multiple Mixed</h3>
        <MockDashboardList loading={false} jobs={mockJobs} />
      </div>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// 17. Interactive - expanded job
// ---------------------------------------------------------------------------
export const InteractiveExpanded: Story = {
  name: "Interactive — expand/collapse",
  args: {
    loading: false,
    jobs: [
      mockJob({ id: "interactive-1", funded: true }),
      mockJob({ id: "interactive-2", funded: false }),
    ],
    expandedJobId: "interactive-1",
  },
  parameters: {
    pseudo: { hover: true },
  },
};

// ---------------------------------------------------------------------------
// 18. Job with auto-release countdown (delivered milestone)
// ---------------------------------------------------------------------------
export const WithAutoReleaseCountdown: Story = {
  name: "Delivered — auto-release countdown",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-auto-release", 
      funded: true,
      milestones: [
        { index: 0, amount: "250000000", status: "Pending" },
        { index: 1, amount: "500000000", status: "Delivered" },
      ],
    })],
    error: null,
    expandedJobId: "job-auto-release",
  },
};

// ---------------------------------------------------------------------------
// 19. Disputed milestone
// ---------------------------------------------------------------------------
export const DisputedMilestone: Story = {
  name: "Disputed — milestone in dispute",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-disputed", 
      funded: true,
      milestones: [
        { index: 0, amount: "250000000", status: "Pending" },
        { index: 1, amount: "500000000", status: "Disputed" },
      ],
    })],
    error: null,
    expandedJobId: "job-disputed",
  },
};

// ---------------------------------------------------------------------------
// 20. Partially released milestone
// ---------------------------------------------------------------------------
export const PartiallyReleased: Story = {
  name: "Partially Released — 60% released",
  args: {
    loading: false,
    jobs: [mockJob({ 
      id: "job-partial", 
      funded: true,
      milestones: [
        { index: 0, amount: "1000000000", status: "PartiallyReleased", releasedAmount: "600000000" },
      ],
    })],
    error: null,
    expandedJobId: "job-partial",
  },
};