import type { Meta, StoryObj } from "@storybook/react";

import WalletBadge from "./WalletBadge";

const meta = {
  title: "Components/WalletBadge",
  component: WalletBadge,
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
    status: {
      control: "select",
      options: ["connected", "disconnected", "loading", "error"],
    },
    address: { control: "text" },
    errorMessage: { control: "text" },
  },
} satisfies Meta<typeof WalletBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Disconnected — no wallet connected
// ---------------------------------------------------------------------------

export const Disconnected: Story = {
  name: "Disconnected — no wallet",
  args: {
    address: null,
    status: "disconnected",
  },
};

// ---------------------------------------------------------------------------
// 2. Connected — short address
// ---------------------------------------------------------------------------

export const ConnectedShort: Story = {
  name: "Connected — short address",
  args: {
    address: "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3",
    status: "connected",
  },
};

// ---------------------------------------------------------------------------
// 3. Connected — with disconnect button
// ---------------------------------------------------------------------------

export const ConnectedWithDisconnect: Story = {
  name: "Connected — with disconnect button",
  args: {
    address: "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3",
    status: "connected",
    onDisconnect: () => console.log("[disconnect] clicked"),
  },
};

// ---------------------------------------------------------------------------
// 4. Connected — different address variation
// ---------------------------------------------------------------------------

export const ConnectedAlternateAddress: Story = {
  name: "Connected — alternate address",
  args: {
    address: "GARY4SMFL5NFQE3TZLQ7YR4XRXK6V5W5Y7YJ6H5K7Q8R9S0T1U2V3W4",
    status: "connected",
  },
};

// ---------------------------------------------------------------------------
// 5. Loading — connecting to wallet
// ---------------------------------------------------------------------------

export const Loading: Story = {
  name: "Loading — connecting",
  args: {
    address: null,
    status: "loading",
  },
};

// ---------------------------------------------------------------------------
// 6. Error — wallet connection failed
// ---------------------------------------------------------------------------

export const ErrorState: Story = {
  name: "Error — wallet connection failed",
  args: {
    address: null,
    status: "error",
    errorMessage: "Failed to connect wallet. Please try again.",
  },
};

// ---------------------------------------------------------------------------
// 7. Error — network mismatch
// ---------------------------------------------------------------------------

export const ErrorNetworkMismatch: Story = {
  name: "Error — network mismatch",
  args: {
    address: null,
    status: "error",
    errorMessage: "Network mismatch: wallet is on Mainnet but app uses Testnet.",
  },
};

// ---------------------------------------------------------------------------
// 8. Disconnected — with custom className
// ---------------------------------------------------------------------------

export const DisconnectedCustomClass: Story = {
  name: "Disconnected — custom className",
  args: {
    address: null,
    status: "disconnected",
    className: "opacity-75",
  },
};

// ---------------------------------------------------------------------------
// 9. Connected — long address (full Stellar G-address)
// ---------------------------------------------------------------------------

export const ConnectedLongAddress: Story = {
  name: "Connected — full Stellar address",
  args: {
    address: "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3T4U5V6W7",
    status: "connected",
    onDisconnect: () => console.log("[disconnect] clicked"),
  },
};

// ---------------------------------------------------------------------------
// 10. Error — no message (fallback text)
// ---------------------------------------------------------------------------

export const ErrorNoMessage: Story = {
  name: "Error — no message (fallback)",
  args: {
    address: null,
    status: "error",
    errorMessage: null,
  },
};
