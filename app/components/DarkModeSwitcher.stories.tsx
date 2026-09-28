import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import DarkModeSwitcher, { DarkModeSwitcherEmptyState } from "./DarkModeSwitcher";

const meta = {
  title: "Components/DarkModeSwitcher",
  component: DarkModeSwitcher,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#030712" },
        { name: "light", value: "#ffffff" },
      ],
    },
  },
  argTypes: {
    isDarkMode: {
      control: "select",
      options: [true, false, null],
      description: "Theme state: true=dark, false=light, null=empty",
    },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
    onToggle: { action: "toggled" },
  },
} satisfies Meta<typeof DarkModeSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Light - default light theme
// ---------------------------------------------------------------------------
export const Light: Story = {
  name: "Light - default",
  args: {
    isDarkMode: false,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 2. Dark - dark theme active
// ---------------------------------------------------------------------------
export const Dark: Story = {
  name: "Dark - active",
  args: {
    isDarkMode: true,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 3. Disabled - light
// ---------------------------------------------------------------------------
export const DisabledLight: Story = {
  name: "Disabled - light",
  args: {
    isDarkMode: false,
    disabled: true,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 4. Disabled - dark
// ---------------------------------------------------------------------------
export const DisabledDark: Story = {
  name: "Disabled - dark",
  args: {
    isDarkMode: true,
    disabled: true,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 5. Loading - spinner state
// ---------------------------------------------------------------------------
export const Loading: Story = {
  name: "Loading",
  args: {
    isDarkMode: false,
    loading: true,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 6. Empty - null theme data
// ---------------------------------------------------------------------------
export const Empty: Story = {
  name: "Empty - no theme data",
  args: {
    isDarkMode: null,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 7. Empty - undefined
// ---------------------------------------------------------------------------
export const EmptyUndefined: Story = {
  name: "Empty - undefined",
  args: {
    isDarkMode: undefined,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 8. Dark with custom ariaLabel
// ---------------------------------------------------------------------------
export const CustomAriaLabel: Story = {
  name: "Custom ariaLabel",
  args: {
    isDarkMode: false,
    ariaLabel: "Toggle application theme",
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 9. Interactive - hover/focus preview (dark)
// ---------------------------------------------------------------------------
export const InteractiveDark: Story = {
  name: "Interactive - dark hover/focus",
  args: {
    isDarkMode: true,
    onToggle: fn(),
  },
  parameters: {
    pseudo: { hover: true, focus: true },
  },
};

// ---------------------------------------------------------------------------
// 10. Interactive - light hover
// ---------------------------------------------------------------------------
export const InteractiveLight: Story = {
  name: "Interactive - light hover",
  args: {
    isDarkMode: false,
    onToggle: fn(),
  },
};

// ---------------------------------------------------------------------------
// 11. Empty state component standalone
// ---------------------------------------------------------------------------
export const EmptyStateStandalone: StoryObj<typeof DarkModeSwitcherEmptyState> = {
  name: "EmptyState - standalone",
  render: () => <DarkModeSwitcherEmptyState />,
};

// ---------------------------------------------------------------------------
// 12. All states overview
// ---------------------------------------------------------------------------
export const AllStates: Story = {
  name: "All states - overview",
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted w-24">Light</span>
        <DarkModeSwitcher isDarkMode={false} onToggle={fn()} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted w-24">Dark</span>
        <DarkModeSwitcher isDarkMode={true} onToggle={fn()} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted w-24">Disabled</span>
        <DarkModeSwitcher isDarkMode={false} disabled onToggle={fn()} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted w-24">Loading</span>
        <DarkModeSwitcher loading isDarkMode={false} onToggle={fn()} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted w-24">Empty</span>
        <DarkModeSwitcher isDarkMode={null} onToggle={fn()} />
      </div>
    </div>
  ),
};
