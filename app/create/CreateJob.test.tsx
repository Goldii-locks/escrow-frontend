import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CreateJob from "./page";

describe("CreateJob", () => {
  it("renders the form with all inputs", () => {
    render(<CreateJob />);
    
    expect(screen.getByText("Create New Job")).toBeDefined();
    expect(screen.getByLabelText("Freelancer Address")).toBeDefined();
    expect(screen.getByLabelText("Arbiter Address")).toBeDefined();
    expect(screen.getByLabelText("Token Contract Address")).toBeDefined();
    expect(screen.getByLabelText("Response Deadline (days)")).toBeDefined();
    expect(screen.getByText("Milestones")).toBeDefined();
    expect(screen.getByText("+ Add Milestone")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDefined();
  });

  it("shows wallet connection prompt when not connected", () => {
    render(<CreateJob />);
    expect(screen.getByText("Connect your wallet to create a job")).toBeDefined();
  });

  it("renders initial milestone input", () => {
    render(<CreateJob />);
    expect(screen.getByPlaceholderText("Milestone 1 amount (stroops)")).toBeDefined();
  });
});