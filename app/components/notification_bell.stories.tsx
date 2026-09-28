import type { Meta, StoryObj } from "@storybook/react";

import NotificationBell from "./notification_bell";

const meta = {
  title: "Components/NotificationBell",
  component: NotificationBell,
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
    label: { control: "text" },
  },
  args: {
    label: "Notifications",
  },
} satisfies Meta<typeof NotificationBell>;
type Story = StoryObj<typeof meta>;

export default meta;

// ---------------------------------------------------------------------------
// 1. Default — no notifications, no validation fields
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — no notifications",
  args: {
    notifications: [],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 2. With notifications
// ---------------------------------------------------------------------------

export const WithNotifications: Story = {
  name: "With notifications",
  args: {
    notifications: [
      { id: "1", type: "success", title: "Payment received", message: "10 USDC sent to your wallet" },
      { id: "2", type: "info", title: "New message", message: "You have a new message from buyer" },
    ],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 3. With error notification
// ---------------------------------------------------------------------------

export const WithError: Story = {
  name: "With error notification",
  args: {
    notifications: [
      { id: "1", type: "error", title: "Payment failed", message: "Insufficient balance" },
    ],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 4. With warning notification
// ---------------------------------------------------------------------------

export const WithWarning: Story = {
  name: "With warning notification",
  args: {
    notifications: [
      { id: "1", type: "warning", title: "Action required", message: "Please verify your email" },
    ],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 5. With success notification
// ---------------------------------------------------------------------------

export const WithSuccess: Story = {
  name: "With success notification",
  args: {
    notifications: [
      { id: "1", type: "success", title: "Deposit completed", message: "Your deposit of 50 USDC was successful" },
    ],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 6. With info notification
// ---------------------------------------------------------------------------

export const WithInfo: Story = {
  name: "With info notification",
  args: {
    notifications: [
      { id: "1", type: "info", title: "System update", message: "Maintenance scheduled for tonight" },
    ],
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// 7. With validation fields having errors
// ---------------------------------------------------------------------------

export const WithValidationErrors: Story = {
  name: "With validation field errors",
  args: {
    notifications: [],
    fields: [
      {
        name: "amount",
        label: "Amount",
        error: "Amount must be greater than 0",
      },
      {
        name: "recipient",
        label: "Recipient",
        error: "Invalid recipient address",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// 8. With both notifications and validation fields
// ---------------------------------------------------------------------------

export const WithNotificationsAndErrors: Story = {
  name: "With notifications and validation errors",
  args: {
    notifications: [
      { id: "1", type: "error", title: "Payment failed", message: "Insufficient balance" },
    ],
    fields: [
      {
        name: "amount",
        label: "Amount",
        error: "Amount must be greater than 0",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// 9. Custom label
// ---------------------------------------------------------------------------

export const CustomLabel: Story = {
  name: "Custom label",
  args: {
    notifications: [],
    fields: [],
    label: "My Notifications",
  },
};

// ---------------------------------------------------------------------------
// 10. Empty state — all caught up
// ---------------------------------------------------------------------------

export const EmptyState: Story = {
  name: "Empty — all caught up",
  args: {
    notifications: [],
    fields: [],
  },
};