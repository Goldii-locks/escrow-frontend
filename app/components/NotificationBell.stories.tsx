import type { Meta, StoryObj } from "@storybook/react";

import NotificationBell, { NotificationItem } from "./NotificationBell";

const mockNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Milestone Approved",
    message: "Milestone #2 'Frontend Integration' was approved by the client.",
    timestamp: "10 mins ago",
    read: false,
    type: "success",
  },
  {
    id: "notif-2",
    title: "Payout Received",
    message: "Payment of 250.00 XLM has been released to your wallet.",
    timestamp: "2 hours ago",
    read: false,
    type: "info",
  },
  {
    id: "notif-3",
    title: "Dispute Opened",
    message: "Client opened a dispute regarding Milestone #3 deliverables.",
    timestamp: "1 day ago",
    read: false,
    type: "warning",
  },
  {
    id: "notif-4",
    title: "Contract Created",
    message: "Escrow contract #842 was initialized on Testnet.",
    timestamp: "3 days ago",
    read: true,
    type: "info",
  },
];

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
    unreadCount: { control: { type: "number", min: 0 } },
    hasUnread: { control: "boolean" },
    isOpen: { control: "boolean" },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    error: { control: "text" },
  },
  args: {
    onBellClick: () => console.log("[bellClick] clicked"),
    onMarkAllAsRead: () => console.log("[markAllAsRead] clicked"),
    onNotificationClick: (notif) => console.log("[notificationClick]", notif),
    onClearAll: () => console.log("[clearAll] clicked"),
  },
} satisfies Meta<typeof NotificationBell>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Default — zero unread notifications
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — zero unread notifications",
  args: {
    unreadCount: 0,
    hasUnread: false,
    isOpen: false,
    notifications: [],
  },
};

// ---------------------------------------------------------------------------
// 2. Unread Badge — 3 unread notifications
// ---------------------------------------------------------------------------

export const WithUnreadBadge: Story = {
  name: "Unread Badge — 3 unread notifications",
  args: {
    unreadCount: 3,
    hasUnread: true,
    isOpen: false,
    notifications: mockNotifications,
  },
};

// ---------------------------------------------------------------------------
// 3. High Unread Count — 120 unread notifications (99+ badge)
// ---------------------------------------------------------------------------

export const HighUnreadCount: Story = {
  name: "High Unread Count — 99+ badge",
  args: {
    unreadCount: 120,
    hasUnread: true,
    isOpen: false,
    notifications: mockNotifications,
  },
};

// ---------------------------------------------------------------------------
// 4. Open Dropdown — with notification list items
// ---------------------------------------------------------------------------

export const OpenWithNotifications: Story = {
  name: "Open Dropdown — with active notification list",
  args: {
    unreadCount: 3,
    hasUnread: true,
    isOpen: true,
    notifications: mockNotifications,
  },
};

// ---------------------------------------------------------------------------
// 5. Open Dropdown — empty list
// ---------------------------------------------------------------------------

export const OpenEmpty: Story = {
  name: "Open Dropdown — empty list ('No notifications yet')",
  args: {
    unreadCount: 0,
    hasUnread: false,
    isOpen: true,
    notifications: [],
  },
};

// ---------------------------------------------------------------------------
// 6. Loading State — fetching notifications
// ---------------------------------------------------------------------------

export const LoadingState: Story = {
  name: "Loading State — fetching notifications spinner",
  args: {
    unreadCount: 0,
    isOpen: true,
    isLoading: true,
    notifications: [],
  },
};

// ---------------------------------------------------------------------------
// 7. Error State — failed to fetch notifications
// ---------------------------------------------------------------------------

export const ErrorState: Story = {
  name: "Error State — failed to load notifications alert",
  args: {
    unreadCount: 0,
    isOpen: true,
    error: "Failed to connect to notification service. Please try again.",
    notifications: [],
  },
};

// ---------------------------------------------------------------------------
// 8. Disabled State
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  name: "Disabled State",
  args: {
    unreadCount: 2,
    disabled: true,
    isOpen: false,
    notifications: mockNotifications,
  },
};

// ---------------------------------------------------------------------------
// 9. All Read — dropdown open with all notifications marked as read
// ---------------------------------------------------------------------------

export const AllRead: Story = {
  name: "All Read — dropdown open with all read notifications",
  args: {
    unreadCount: 0,
    hasUnread: false,
    isOpen: true,
    notifications: mockNotifications.map((item) => ({ ...item, read: true })),
  },
};
