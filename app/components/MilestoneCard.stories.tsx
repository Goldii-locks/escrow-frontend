import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import MilestoneCard from "./MilestoneCard";
import type { MilestoneCardErrors } from "./MilestoneCard";
import type { ActionState } from "@/app/hooks/useActionStates";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const idleAction: ActionState = { phase: "idle", error: null, txHash: null };
const pendingAction: ActionState = { phase: "building", error: null, txHash: null };

const defaultActions = {
  partialReleaseState: idleAction,
  claimAutoReleaseState: idleAction,
  isPartialReleasePending: false,
  isClaimAutoReleasePending: false,
  onMarkDelivered: fn(),
  onApprove: fn(),
  onDispute: fn(),
  onPartialRelease: fn(),
  onClaimAutoRelease: fn(),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
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
    autoReleaseDeadline: { control: "number" },
  },
} satisfies Meta<typeof MilestoneCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Empty / no milestone data
// ---------------------------------------------------------------------------

export const EmptyState: Story = {
  name: "Empty — no milestone data",
  args: {
    milestone: null,
    isClient: false,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 2. Pending — freelancer view (can mark delivered / dispute)
// ---------------------------------------------------------------------------

export const PendingFreelancer: Story = {
  name: "Pending — freelancer view",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: false,
    isFreelancer: true,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 3. Pending — client view (can only dispute)
// ---------------------------------------------------------------------------

export const PendingClient: Story = {
  name: "Pending — client view",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 4. Pending — observer view (no actions)
// ---------------------------------------------------------------------------

export const PendingObserver: Story = {
  name: "Pending — observer view (no actions)",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: false,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 5. Delivered — client view (can approve / dispute)
// ---------------------------------------------------------------------------

export const DeliveredClient: Story = {
  name: "Delivered — client view",
  args: {
    milestone: { index: 1, amount: "500000000", status: "Delivered" },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 6. Delivered — with auto-release countdown (deadline 30 min from now)
// ---------------------------------------------------------------------------

export const DeliveredWithCountdown: Story = {
  name: "Delivered — auto-release countdown active",
  args: {
    milestone: { index: 1, amount: "500000000", status: "Delivered" },
    isClient: true,
    isFreelancer: false,
    autoReleaseDeadline: Date.now() + 30 * 60 * 1000, // 30 minutes
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 7. Delivered — countdown expired (deadline in the past)
// ---------------------------------------------------------------------------

export const DeliveredCountdownExpired: Story = {
  name: "Delivered — auto-release countdown expired",
  args: {
    milestone: { index: 1, amount: "500000000", status: "Delivered" },
    isClient: true,
    isFreelancer: false,
    autoReleaseDeadline: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 8. Released — funds fully released
// ---------------------------------------------------------------------------

export const Released: Story = {
  name: "Released — funds fully released",
  args: {
    milestone: { index: 2, amount: "750000000", status: "Released" },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 9. PartiallyReleased — 60 % released
// ---------------------------------------------------------------------------

export const PartiallyReleased60: Story = {
  name: "Partially Released — 60 %",
  args: {
    milestone: {
      index: 3,
      amount: "1000000000",
      status: "PartiallyReleased",
      releasedAmount: "600000000",
    },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 10. PartiallyReleased — edge case: 1 % released
// ---------------------------------------------------------------------------

export const PartiallyReleasedEdge: Story = {
  name: "Partially Released — 1 % (edge case)",
  args: {
    milestone: {
      index: 3,
      amount: "1000000000",
      status: "PartiallyReleased",
      releasedAmount: "10000000",
    },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 11. Disputed — both roles
// ---------------------------------------------------------------------------

export const Disputed: Story = {
  name: "Disputed",
  args: {
    milestone: { index: 4, amount: "300000000", status: "Disputed" },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 12. Refunded
// ---------------------------------------------------------------------------

export const Refunded: Story = {
  name: "Refunded",
  args: {
    milestone: { index: 5, amount: "200000000", status: "Refunded" },
    isClient: false,
    isFreelancer: true,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 13. Unknown status (falls back to default badge styles)
// ---------------------------------------------------------------------------

export const UnknownStatus: Story = {
  name: "Unknown status — graceful fallback",
  args: {
    milestone: { index: 6, amount: "100000000", status: "InReview" },
    isClient: false,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 14. Error states — field-level errors
// ---------------------------------------------------------------------------

const fieldErrors: MilestoneCardErrors = {
  amount: "Amount must be greater than 0",
  status: "Unknown status value",
};

export const FieldErrors: Story = {
  name: "Error — field-level (amount + status)",
  args: {
    milestone: { index: 0, amount: "0", status: "Pending" },
    isClient: true,
    isFreelancer: false,
    errors: fieldErrors,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 15. Error states — general alert banner
// ---------------------------------------------------------------------------

const generalError: MilestoneCardErrors = {
  general: "Transaction failed. Please try again or contact support.",
};

export const GeneralError: Story = {
  name: "Error — general alert banner",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: true,
    isFreelancer: false,
    errors: generalError,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 16. All errors simultaneously
// ---------------------------------------------------------------------------

export const AllErrors: Story = {
  name: "Error — all error types combined",
  args: {
    milestone: { index: 0, amount: "0", status: "Pending" },
    isClient: true,
    isFreelancer: false,
    errors: {
      general: "Something went wrong while processing this milestone.",
      amount: "Amount must be greater than 0",
      status: "Unknown status value",
    },
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 17. Action pending — buttons disabled while TX is in-flight
// ---------------------------------------------------------------------------

export const ActionPending: Story = {
  name: "Action in-flight — buttons disabled",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: false,
    isFreelancer: true,
    partialReleaseState: pendingAction,
    claimAutoReleaseState: idleAction,
    isPartialReleasePending: true,
    isClaimAutoReleasePending: false,
    onMarkDelivered: fn(),
    onApprove: fn(),
    onDispute: fn(),
    onPartialRelease: fn(),
    onClaimAutoRelease: fn(),
  },
};

// ---------------------------------------------------------------------------
// 18. Handlers omitted — all action buttons aria-disabled
// ---------------------------------------------------------------------------

export const NoHandlers: Story = {
  name: "No handlers — all buttons aria-disabled",
  args: {
    milestone: { index: 0, amount: "250000000", status: "Pending" },
    isClient: true,
    isFreelancer: true,
    partialReleaseState: idleAction,
    claimAutoReleaseState: idleAction,
    isPartialReleasePending: false,
    isClaimAutoReleasePending: false,
    // Intentionally omitting all callbacks
  },
};

// ---------------------------------------------------------------------------
// 19. Large amount — layout stress test
// ---------------------------------------------------------------------------

export const LargeAmount: Story = {
  name: "Large amount — layout stress test",
  args: {
    milestone: {
      index: 9,
      amount: "99999999999999",
      status: "PartiallyReleased",
      releasedAmount: "49999999999999",
    },
    isClient: true,
    isFreelancer: false,
    ...defaultActions,
  },
};

// ---------------------------------------------------------------------------
// 20. Last milestone — index 99 (high index number display)
// ---------------------------------------------------------------------------

export const HighIndex: Story = {
  name: "High milestone index — display label",
  args: {
    milestone: { index: 99, amount: "500000000", status: "Released" },
    isClient: false,
    isFreelancer: false,
    ...defaultActions,
  },
};
