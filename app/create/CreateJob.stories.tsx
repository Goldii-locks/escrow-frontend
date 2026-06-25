import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CreateJob from "./page";

const meta = {
  title: "Create/CreateJob",
  component: CreateJob,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CreateJob>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMultipleMilestones: Story = {};

export const Loading: Story = {};

export const DisabledNoWallet: Story = {};
