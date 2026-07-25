"use client";

import { FormEvent, useMemo, useState } from "react";





export type CreateJobFormValues = {
  title: string;
  description: string;
  budget: string;
  escrowAgent: string;
  escrowDeadlineDays: string;
};

export type CreateJobFormValidationErrors = Partial<Record<keyof CreateJobFormValues, string>>;

export type CreateJobFormProps = {  
  /** Initial wizard step (useful for Storybook) */
  initialStep?: 1 | 2;
  /** Simulate validation errors */
  initialErrors?: CreateJobFormValidationErrors;
  /** Simulate loading/submitting state */
  initialLoading?: boolean;
  /** Called when user advances steps */
  onStepChange?: (step: 1 | 2) => void;
  /** Called when submit is triggered */
  onSubmit?: (values: CreateJobFormValues) => Promise<void> | void;
  /** Called after successful completion */
  onCompleted?: (values: CreateJobFormValues) => void;
};

type WizardStep = 1 | 2;

type WizardState =
  | { mode: "form"; step: WizardStep; values: CreateJobFormValues; errors: CreateJobFormValidationErrors }
  | { mode: "success"; values: CreateJobFormValues };

const defaultValues: CreateJobFormValues = {
  title: "",
  description: "",
  budget: "",
  escrowAgent: "",
  escrowDeadlineDays: "7",
};

function validate(values: CreateJobFormValues): CreateJobFormValidationErrors {
  const errors: CreateJobFormValidationErrors = {};

  if (!values.title.trim()) errors.title = "Title is required";
  if (!values.description.trim()) errors.description = "Description is required";

  if (!values.budget.trim()) errors.budget = "Budget is required";
  else {
    const n = Number(values.budget);
    if (!Number.isFinite(n) || n <= 0) errors.budget = "Budget must be a positive number";
  }

  if (!values.escrowAgent.trim()) errors.escrowAgent = "Escrow agent is required";

  if (!values.escrowDeadlineDays.trim()) errors.escrowDeadlineDays = "Escrow deadline is required";
  else {
    const n = Number(values.escrowDeadlineDays);
    if (!Number.isFinite(n) || n <= 0) errors.escrowDeadlineDays = "Escrow deadline must be a positive number";
  }

  return errors;
}

export default function CreateJobForm({
  initialStep = 1,
  initialErrors = {},
  initialLoading = false,
  onStepChange,
  onSubmit,
  onCompleted,
}: CreateJobFormProps) {
  const [loading, setLoading] = useState<boolean>(initialLoading);

  const [state, setState] = useState<WizardState>(() => ({
    mode: "form",
    step: initialStep,
    values: defaultValues,
    errors: initialErrors,
  }));

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const currentStep = state.mode === "form" ? state.step : 2;

  const isStepValid = useMemo(() => {
    if (state.mode !== "form") return true;
    const errors = validate(state.values);
    if (state.step === 1) {
      return !errors.title && !errors.description;
    }
    return !errors.budget && !errors.escrowAgent && !errors.escrowDeadlineDays;
  }, [state]);

  const handleChange = (key: keyof CreateJobFormValues, value: string) => {
    if (state.mode !== "form") return;
    setState((prev) => {
      if (prev.mode !== "form") return prev;
      return {
        ...prev,
        values: { ...prev.values, [key]: value },
        errors: prev.errors,
      };
    });
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const handleNext = async () => {
    if (state.mode !== "form") return;
    const errors = validate(state.values);
    const stepErrors: CreateJobFormValidationErrors =
      state.step === 1 ? { title: errors.title, description: errors.description } : { budget: errors.budget, escrowAgent: errors.escrowAgent, escrowDeadlineDays: errors.escrowDeadlineDays };

    const hasErrors = Object.values(stepErrors).some(Boolean);
    if (hasErrors) {
      setState((prev) => (prev.mode === "form" ? { ...prev, errors: { ...prev.errors, ...stepErrors } } : prev));
      setTouched({
        title: true,
        description: true,
        budget: true,
        escrowAgent: true,
        escrowDeadlineDays: true,
      });
      return;
    }

    const nextStep: WizardStep = state.step === 1 ? 2 : 2;
    setState((prev) => (prev.mode === "form" ? { ...prev, step: nextStep, errors: {} } : prev));
    onStepChange?.(nextStep);
  };

  const handleBack = () => {
    if (state.mode !== "form") return;
    if (state.step === 1) return;
    const prevStep: WizardStep = 1;
    setState((s) => (s.mode === "form" ? { ...s, step: prevStep, errors: {} } : s));
    onStepChange?.(prevStep);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {

    e.preventDefault();
    if (state.mode !== "form") return;

    const errors = validate(state.values);
    setTouched({
      title: true,
      description: true,
      budget: true,
      escrowAgent: true,
      escrowDeadlineDays: true,
    });

    if (errors.title || errors.description || errors.budget || errors.escrowAgent || errors.escrowDeadlineDays) {
      setState((prev) => (prev.mode === "form" ? { ...prev, errors } : prev));
      return;
    }

    setLoading(true);
    try {
      await onSubmit?.(state.values);
      setState({ mode: "success", values: state.values });
      onCompleted?.(state.values);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      {state.mode === "form" ? (
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-400">Step {state.step} of 2</div>
            <div className="text-xs text-gray-500">Create a job wizard</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {state.step === 1 && (
              <>
                <div>
                  <label className="block text-sm text-gray-300">Job Title</label>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm"
                    value={state.values.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="e.g. Website redesign"
                    disabled={loading}
                    aria-invalid={"false"}

                  />
                  {touched.title && state.errors.title && (
                    <p className="mt-1 text-xs text-red-400">{state.errors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300">Description</label>
                  <textarea
                    className="mt-1 h-28 w-full resize-none rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm"
                    value={state.values.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Describe the scope..."
                    disabled={loading}
                    aria-invalid={false}
                  />
                  {touched.description && state.errors.description && (
                    <p className="mt-1 text-xs text-red-400">{state.errors.description}</p>
                  )}
                </div>
              </>
            )}

            {state.step === 2 && (
              <>
                <div>
                  <label className="block text-sm text-gray-300">Budget</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm"
                    value={state.values.budget}
                    onChange={(e) => handleChange("budget", e.target.value)}
                    placeholder="1000"
                    disabled={loading}
                    aria-invalid={Boolean(state.errors.budget)}
                  />
                  {touched.budget && state.errors.budget && (
                    <p className="mt-1 text-xs text-red-400">{state.errors.budget}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300">Escrow Agent Address</label>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm"
                    value={state.values.escrowAgent}
                    onChange={(e) => handleChange("escrowAgent", e.target.value)}
                    placeholder="G..."
                    disabled={loading}
                    aria-invalid={Boolean(state.errors.escrowAgent)}
                  />
                  {touched.escrowAgent && state.errors.escrowAgent && (
                    <p className="mt-1 text-xs text-red-400">{state.errors.escrowAgent}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300">Escrow Deadline (days)</label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm"
                    value={state.values.escrowDeadlineDays}
                    onChange={(e) => handleChange("escrowDeadlineDays", e.target.value)}
                    placeholder="7"
                    disabled={loading}
                    aria-invalid={Boolean(state.errors.escrowDeadlineDays)}
                  />
                  {touched.escrowDeadlineDays && state.errors.escrowDeadlineDays && (
                    <p className="mt-1 text-xs text-red-400">{state.errors.escrowDeadlineDays}</p>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={loading || currentStep === 1}
                className="rounded-md border border-gray-800 bg-transparent px-4 py-2 text-sm text-gray-200 disabled:opacity-40"
              >
                Back
              </button>

              {state.step === 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading || !isStepValid}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {loading ? "Submitting..." : "Create Job"}
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-emerald-50">
          <div className="text-sm text-emerald-200">Job created successfully</div>
          <div className="mt-2 text-xs text-emerald-300">
            Title: <span className="font-medium">{state.values.title || "(untitled)"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

