import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import TransactionProgressBar, {
  DEFAULT_TRANSACTION_STEPS,
  type TransactionProgressBarProps,
} from "./TransactionProgressBar";

const meta = {
  title: "Components/TransactionProgressBar",
  component: TransactionProgressBar,
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
    currentStepIndex: {
      control: { type: "number", min: 0, max: 3 },
      description: "Active 0-indexed step",
    },
    status: {
      control: "select",
      options: ["active", "completed", "failed"],
      description: "Status of the current active step",
    },
    disabled: {
      control: "boolean",
      description: "Whether the progress bar is disabled",
    },
    mobileOverlay: {
      control: "boolean",
      description: "Render inside mobile height-constrained overlay wrapper",
    },
  },
  args: {
    onStepClick: fn(),
    onCloseOverlay: fn(),
  },
} satisfies Meta<typeof TransactionProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Initial State — Step 0 (Prepare)
// ---------------------------------------------------------------------------
export const InitialPrepare: Story = {
  name: "1. Initial State — Step 0 (Prepare)",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 0,
    status: "active",
  },
};

// ---------------------------------------------------------------------------
// 2. In Progress — Step 1 (Sign)
// ---------------------------------------------------------------------------
export const SignInProgress: Story = {
  name: "2. In Progress — Step 1 (Sign with Wallet)",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 1,
    status: "active",
  },
};

// ---------------------------------------------------------------------------
// 3. Broadcasting — Step 2 (Submit to Ledger)
// ---------------------------------------------------------------------------
export const SubmitBroadcast: Story = {
  name: "3. Broadcasting — Step 2 (Submit to Ledger)",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 2,
    status: "active",
  },
};

// ---------------------------------------------------------------------------
// 4. All Completed — Confirmed State
// ---------------------------------------------------------------------------
export const TransactionConfirmed: Story = {
  name: "4. All Completed — Ledger Confirmed",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 3,
    status: "completed",
  },
};

// ---------------------------------------------------------------------------
// 5. Failed State — Error at Submit
// ---------------------------------------------------------------------------
export const TransactionFailed: Story = {
  name: "5. Failed State — Submission Failure",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 2,
    status: "failed",
    errorMessage: "Horizon transaction submission rejected: tx_insufficient_balance.",
  },
};

// ---------------------------------------------------------------------------
// 6. Disabled State
// ---------------------------------------------------------------------------
export const DisabledState: Story = {
  name: "6. Disabled State",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 1,
    status: "active",
    disabled: true,
  },
};

// ---------------------------------------------------------------------------
// 7. Validation Alert
// ---------------------------------------------------------------------------
export const ValidationAlert: Story = {
  name: "7. Validation Alert — Invalid Configuration",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 99,
  },
};

// ---------------------------------------------------------------------------
// 8. Mobile Viewport Overlay Wrapper (Issue #416)
// ---------------------------------------------------------------------------
export const MobileOverlayState: Story = {
  name: "8. Mobile Viewport Overlay Wrapper",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 1,
    status: "active",
    mobileOverlay: true,
  },
};

// ---------------------------------------------------------------------------
// 9. Interactive Steps (Clickable navigation)
// ---------------------------------------------------------------------------
export const InteractiveSteps: Story = {
  name: "9. Interactive Steps (Click to navigate)",
  args: {
    steps: DEFAULT_TRANSACTION_STEPS,
    currentStepIndex: 2,
    status: "active",
    onStepClick: fn(),
  },
};

// ---------------------------------------------------------------------------
// 10. Custom Escrow Milestones
// ---------------------------------------------------------------------------
export const CustomEscrowMilestones: Story = {
  name: "10. Custom Escrow Milestones Flow",
  args: {
    steps: [
      { id: "deposit", title: "Escrow Deposit", description: "Lock funds into Soroban contract" },
      { id: "review", title: "Deliverable Review", description: "Client inspects submitted milestone" },
      { id: "release", title: "Release Funds", description: "Arbiter or Client triggers payout" },
    ],
    currentStepIndex: 1,
    status: "active",
  },
};

// ---------------------------------------------------------------------------
// 11. All-States Gallery Overview
// ---------------------------------------------------------------------------
export const AllStatesGallery: Story = {
  name: "11. All-States Gallery Overview",
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase text-gray-400">Step 0: Prepare</h4>
        <TransactionProgressBar steps={DEFAULT_TRANSACTION_STEPS} currentStepIndex={0} status="active" />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase text-gray-400">Step 1: Sign in Progress</h4>
        <TransactionProgressBar steps={DEFAULT_TRANSACTION_STEPS} currentStepIndex={1} status="active" />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase text-gray-400">Step 3: Confirmed (All Completed)</h4>
        <TransactionProgressBar steps={DEFAULT_TRANSACTION_STEPS} currentStepIndex={3} status="completed" />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase text-gray-400">Failed with Alert</h4>
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={2}
          status="failed"
          errorMessage="Ledger timeout: Sequence number out of date."
        />
      </div>
    </div>
  ),
};
