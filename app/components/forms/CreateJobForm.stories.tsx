import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import React from "react";

import CreateJobForm, { type CreateJobFormProps } from "./CreateJobForm";

const meta: Meta<typeof CreateJobForm> = {
  title: "Forms/CreateJobForm",
  component: CreateJobForm,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof CreateJobForm>;

const baseProps: CreateJobFormProps = {
  onStepChange: action("stepChange"),
  onSubmit: action("submit"),
  onCompleted: action("completed"),
};

export const DefaultEmpty: Story = {
  name: "Default / Empty",
  args: {
    ...baseProps,
    initialStep: 1,
    initialErrors: {},
    initialLoading: false,
  },
};

export const ValidationErrors: Story = {
  name: "Validation Errors",
  args: {
    ...baseProps,
    // Force to step 2 with multiple validation errors visible.
    initialStep: 2,
    initialLoading: false,
    initialErrors: {
      title: "Title is required",
      description: "Description is required",
      budget: "Budget is required",
      escrowAgent: "Escrow agent is required",
      escrowDeadlineDays: "Escrow deadline is required",
    },
  },
};

export const LoadingSubmitting: Story = {
  name: "Loading / Submitting",
  args: {
    ...baseProps,
    initialStep: 2,
    initialErrors: {},
    initialLoading: true,
  },
};

export const SuccessCompletion: Story = {
  name: "Success / Completion",
  render: (args) => {
    // Success happens after successful submit.
    // Provide valid default values by starting at step 2 and using a submit handler that resolves.
    const onSubmit = async () => {
      // Let the component transition to its internal success state.
      await new Promise((r) => setTimeout(r, 300));
    };

    return (
      <CreateJobForm
        {...args}
        onSubmit={onSubmit}
        onStepChange={action("stepChange")}
        onCompleted={action("completed")}
        initialStep={2}
        initialErrors={{}}
        initialLoading={false}
      />
    );
  },
};


