import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import MilestoneCard from "./MilestoneCard";
import type { ActionState } from "@/app/hooks/useActionStates";

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const idleState: ActionState = { phase: "idle", error: null, txHash: null };
const submittingState: ActionState = {
  phase: "submitting",
  error: null,
  txHash: null,
};
const successState: ActionState = {
  phase: "success",
  error: null,
  txHash: "abc123txhash",
};
const errorState: ActionState = {
  phase: "error",
  error: "Transaction failed: insufficient funds.",
  txHash: null,
};

const defaultActions = {
  onMarkDelivered: fn(),
  onApprove: fn(),
  onDispute: fn(),
  onPartialRelease: fn(),
  onClaimAutoRelease: fn(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof MilestoneCard> = {
  title: "Components/MilestoneCard",
  component: MilestoneCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0f1117" },
        { name: "light", value: "#ffffff" },
      ],
    },
  },
  argTypes: {
    isClient: { control: "boolean" },
    isFreelancer: { control: "boolean" },
    isPartialReleasePending: { control: "boolean" },
    isClaimAutoReleasePending: { control: "boolean" },
  },
  args: {
    ...defaultActions,
    partialReleaseState: idleState,
    claimAutoReleaseState: idleState,
    isPartialReleasePending: false,
    isClaimAutoReleasePending: false,
  },
};

export default meta;
type Story = StoryObj<typeof MilestoneCard>;

// ---------------------------------------------------------------------------
// 1. Empty / null milestone
// ---------------------------------------------------------------------------

export const EmptyState: Story = {
  name: "Empty State",
  args: {
    milestone: null,
    isClient: false,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 2. Pending — freelancer view (can mark delivered or dispute)
// ---------------------------------------------------------------------------

export const PendingAsFreelancer: Story = {
  name: "Pending · Freelancer",
  args: {
    milestone: {
      index: 0,
      amount: "5000000",
      status: "Pending",
    },
    isClient: false,
    isFreelancer: true,
  },
};

// ---------------------------------------------------------------------------
// 3. Pending — client view (can only dispute)
// ---------------------------------------------------------------------------

export const PendingAsClient: Story = {
  name: "Pending · Client",
  args: {
    milestone: {
      index: 0,
      amount: "5000000",
      status: "Pending",
    },
    isClient: true,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 4. Pending — observer / third-party (no action buttons)
// ---------------------------------------------------------------------------

export const PendingObserver: Story = {
  name: "Pending · Observer",
  args: {
    milestone: {
      index: 0,
      amount: "5000000",
      status: "Pending",
    },
    isClient: false,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 5. Delivered — client view (can approve or dispute)
// ---------------------------------------------------------------------------

export const DeliveredAsClient: Story = {
  name: "Delivered · Client",
  args: {
    milestone: {
      index: 1,
      amount: "12500000",
      status: "Delivered",
    },
    isClient: true,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 6. Delivered — freelancer view (can dispute)
// ---------------------------------------------------------------------------

export const DeliveredAsFreelancer: Story = {
  name: "Delivered · Freelancer",
  args: {
    milestone: {
      index: 1,
      amount: "12500000",
      status: "Delivered",
    },
    isClient: false,
    isFreelancer: true,
  },
};

// ---------------------------------------------------------------------------
// 7. Released (fully approved)
// ---------------------------------------------------------------------------

export const Released: Story = {
  name: "Released",
  args: {
    milestone: {
      index: 2,
      amount: "8000000",
      status: "Released",
    },
    isClient: true,
    isFreelancer: false,
    claimAutoReleaseState: successState,
  },
};

// ---------------------------------------------------------------------------
// 8. Partially Released — 40 % released
// ---------------------------------------------------------------------------

export const PartiallyReleased40: Story = {
  name: "Partially Released · 40%",
  args: {
    milestone: {
      index: 3,
      amount: "10000000",
      status: "PartiallyReleased",
      releasedAmount: "4000000",
    },
    isClient: true,
    isFreelancer: false,
    partialReleaseState: successState,
  },
};

// ---------------------------------------------------------------------------
// 9. Partially Released — 75 % released
// ---------------------------------------------------------------------------

export const PartiallyReleased75: Story = {
  name: "Partially Released · 75%",
  args: {
    milestone: {
      index: 3,
      amount: "20000000",
      status: "PartiallyReleased",
      releasedAmount: "15000000",
    },
    isClient: false,
    isFreelancer: true,
  },
};

// ---------------------------------------------------------------------------
// 10. Disputed
// ---------------------------------------------------------------------------

export const Disputed: Story = {
  name: "Disputed",
  args: {
    milestone: {
      index: 4,
      amount: "7500000",
      status: "Disputed",
    },
    isClient: true,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 11. Refunded
// ---------------------------------------------------------------------------

export const Refunded: Story = {
  name: "Refunded",
  args: {
    milestone: {
      index: 5,
      amount: "3000000",
      status: "Refunded",
    },
    isClient: true,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 12. Unknown / unrecognised status (fallback badge style)
// ---------------------------------------------------------------------------

export const UnknownStatus: Story = {
  name: "Unknown Status",
  args: {
    milestone: {
      index: 6,
      amount: "1000000",
      status: "Escalated",
    },
    isClient: false,
    isFreelancer: false,
  },
};

// ---------------------------------------------------------------------------
// 13. Field-level errors (amount + status)
// ---------------------------------------------------------------------------

export const FieldErrors: Story = {
  name: "With Field Errors",
  args: {
    milestone: {
      index: 0,
      amount: "0",
      status: "Pending",
    },
    isClient: false,
    isFreelancer: true,
    errors: {
      amount: "Amount must be greater than 0.",
      status: "Status value is not recognised.",
    },
  },
};

// ---------------------------------------------------------------------------
// 14. General / banner error
// ---------------------------------------------------------------------------

export const GeneralError: Story = {
  name: "With General Error Banner",
  args: {
    milestone: {
      index: 0,
      amount: "5000000",
      status: "Pending",
    },
    isClient: false,
    isFreelancer: true,
    errors: {
      general:
        "Unable to connect to the Stellar network. Please check your connection and try again.",
    },
    partialReleaseState: errorState,
  },
};

// ---------------------------------------------------------------------------
// 15. Transaction in flight — submitting state
// ---------------------------------------------------------------------------

export const TransactionSubmitting: Story = {
  name: "Transaction · Submitting",
  args: {
    milestone: {
      index: 0,
      amount: "5000000",
      status: "Pending",
    },
    isClient: false,
    isFreelancer: true,
    isPartialReleasePending: true,
    partialReleaseState: submittingState,
  },
};

// ---------------------------------------------------------------------------
// 16. High milestone index (multiple milestones in a list)
// ---------------------------------------------------------------------------

export const HighIndex: Story = {
  name: "High Index · Milestone 10",
  args: {
    milestone: {
      index: 9,
      amount: "50000000",
      status: "Delivered",
    },
    isClient: true,
    isFreelancer: false,
  },
};
