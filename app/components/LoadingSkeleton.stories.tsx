import type { Meta, StoryObj } from "@storybook/react";

import LoadingSkeleton from "./LoadingSkeleton";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Components/LoadingSkeleton",
  component: LoadingSkeleton,
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
} satisfies Meta<typeof LoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 1. Default — standard loading skeleton
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — full skeleton layout",
};

// ---------------------------------------------------------------------------
// 2. Light mode — light background
// ---------------------------------------------------------------------------

export const LightMode: Story = {
  name: "Light mode — light background",
  parameters: {
    backgrounds: { default: "light" },
  },
};

// ---------------------------------------------------------------------------
// 3. Single milestone — narrow viewport (mobile)
// ---------------------------------------------------------------------------

export const MobileNarrow: Story = {
  name: "Mobile — narrow viewport (1 stat column)",
  parameters: {
    viewport: { default: "mobile1" },
  },
};

// ---------------------------------------------------------------------------
// 4. Tablet viewport
// ---------------------------------------------------------------------------

export const Tablet: Story = {
  name: "Tablet — medium viewport",
  parameters: {
    viewport: { default: "tablet" },
  },
};

// ---------------------------------------------------------------------------
// 5. Full-width — wide desktop viewport
// ---------------------------------------------------------------------------

export const DesktopWide: Story = {
  name: "Desktop — wide viewport (3 stat columns)",
  parameters: {
    viewport: { default: "desktop" },
  },
};

// ---------------------------------------------------------------------------
// 6. Inside a padded container — simulates card context
// ---------------------------------------------------------------------------

export const InCardContext: Story = {
  name: "In card context — nested inside a container",
  decorators: [
    (Story) => (
      <div className="max-w-2xl mx-auto border border-border-subtle rounded-2xl p-4 bg-surface-card">
        <Story />
      </div>
    ),
  ],
};

// ---------------------------------------------------------------------------
// 7. Full-page overlay — skeleton fills entire viewport
// ---------------------------------------------------------------------------

export const FullPageOverlay: Story = {
  name: "Full-page overlay — skeleton fills viewport",
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen flex items-center justify-center bg-surface-card p-8">
        <div className="w-full max-w-4xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

// ---------------------------------------------------------------------------
// 8. Reduced motion — animation paused
// ---------------------------------------------------------------------------

export const ReducedMotion: Story = {
  name: "Reduced motion — pulse animation disabled",
  parameters: {
    docs: {
      description: {
        story:
          "Users who prefer reduced motion see the skeleton without the pulse animation. " +
          "The `animate-pulse` class is still applied in the DOM but CSS `prefers-reduced-motion` disables it.",
      },
    },
  },
  decorators: [
    (Story) => (
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse { animation: none !important; }
        }
      `}</style>
    ),
  ],
};

// ---------------------------------------------------------------------------
// 9. Accessibility check — all semantic elements present
// ---------------------------------------------------------------------------

export const AccessibilityAttributes: Story = {
  name: "Accessibility — ARIA roles & screen-reader text",
  parameters: {
    docs: {
      description: {
        story:
          "The skeleton wrapper exposes `role=\"status\"` and `aria-live=\"polite\"` " +
          "for assistive technology. A visually hidden `<span>` announces \"Loading job data…\". " +
          "The decorative inner content is marked `aria-hidden=\"true\"`.",
      },
    },
  },
};
