import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

// ===========================================================================
// LoadingSkeleton — validation messages & alerts (issue #277)
// ===========================================================================

describe("LoadingSkeleton — single validation error", () => {
  it("renders an accessible alert when an error message is provided", () => {
    render(<LoadingSkeleton error="Job budget is invalid" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Job budget is invalid")).toBeInTheDocument();
  });

  it("renders the alert with a live assertive region", () => {
    render(<LoadingSkeleton error="Job budget is invalid" />);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("renders no alert when no error is provided", () => {
    render(<LoadingSkeleton />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links the skeleton to the alerts via aria-describedby", () => {
    render(<LoadingSkeleton error="Job budget is invalid" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-describedby", "loading-skeleton-errors");
    expect(screen.getByTestId("loading-skeleton-errors")).toHaveAttribute(
      "id",
      "loading-skeleton-errors"
    );
  });

  it("does not set aria-describedby when there are no alerts", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-describedby");
  });
});

describe("LoadingSkeleton — multiple validation errors (object keyed by field)", () => {
  const errors = {
    title: "Title is required",
    budget: "Budget must be a positive number",
  };

  it("renders one alert per validation error", () => {
    render(<LoadingSkeleton validationErrors={errors} />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("prefixes each message with its field name", () => {
    render(<LoadingSkeleton validationErrors={errors} />);
    expect(screen.getByText("title:")).toBeInTheDocument();
    expect(screen.getByText("budget:")).toBeInTheDocument();
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Budget must be a positive number")).toBeInTheDocument();
  });

  it("renders every field message value", () => {
    render(<LoadingSkeleton validationErrors={errors} />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});

describe("LoadingSkeleton — multiple validation errors (array form)", () => {
  const errors = [
    { field: "escrowAgent", message: "Escrow agent is required" },
    { message: "Unexpected failure" },
  ];

  it("renders one alert per array entry", () => {
    render(<LoadingSkeleton validationErrors={errors} />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("renders the field label only when a field is provided", () => {
    render(<LoadingSkeleton validationErrors={errors} />);
    expect(screen.getByText("escrowAgent:")).toBeInTheDocument();
    expect(screen.queryByText("Unexpected failure:")).not.toBeInTheDocument();
    expect(screen.getByText("Unexpected failure")).toBeInTheDocument();
  });

  it("applies high-contrast error styling to alert content", () => {
    render(<LoadingSkeleton error="Job budget is invalid" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("text-red-400");
    expect(alert).toHaveClass("bg-red-950/40");
    expect(alert).toHaveClass("border-red-800");
  });
});

describe("LoadingSkeleton — empty collection of errors", () => {
  it("renders no alerts for an empty object", () => {
    render(<LoadingSkeleton validationErrors={{}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders no alerts for a null error prop", () => {
    render(<LoadingSkeleton error={null} validationErrors={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LoadingSkeleton — alerts remain accessible in interactive mode", () => {
  it("renders alerts alongside the interactive button", () => {
    render(<LoadingSkeleton interactive error="Job budget is invalid" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
