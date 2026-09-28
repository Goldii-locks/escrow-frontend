import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LoadingSkeleton from "../app/components/LoadingSkeleton";
import ButtonSpinner from "../app/components/ButtonSpinner";

describe("LoadingSkeleton Component", () => {
  it("renders with default status role and polite aria-live", () => {
    render(<LoadingSkeleton />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading job data…")).toBeInTheDocument();
  });

  it("applies interactive hover, transition, and focus-visible classes when interactive is true", () => {
    render(<LoadingSkeleton interactive />);
    const buttonElement = screen.getByRole("button");
    expect(buttonElement).toBeInTheDocument();
    expect(buttonElement).toHaveClass("cursor-pointer");
    expect(buttonElement).toHaveClass("hover:border-gray-700");
    expect(buttonElement).toHaveClass("focus-visible:ring-2");
    expect(buttonElement).toHaveClass("focus-visible:ring-blue-500");
  });

  it("handles click and keyboard events when interactive", () => {
    const handleClick = vi.fn();
    render(<LoadingSkeleton interactive onClick={handleClick} />);
    const buttonElement = screen.getByRole("button");

    fireEvent.click(buttonElement);
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(buttonElement, { key: "Enter", code: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(buttonElement, { key: " ", code: "Space" });
    expect(handleClick).toHaveBeenCalledTimes(3);
  });

  it("applies disabled classes and disables interactions when disabled is true", () => {
    const handleClick = vi.fn();
    render(<LoadingSkeleton interactive disabled onClick={handleClick} />);
    const buttonElement = screen.getByRole("button", { hidden: true });

    expect(buttonElement).toHaveClass("opacity-50");
    expect(buttonElement).toHaveClass("cursor-not-allowed");
    expect(buttonElement).toHaveAttribute("aria-disabled", "true");
    expect(buttonElement).toHaveAttribute("tabIndex", "-1");

    fireEvent.click(buttonElement);
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe("ButtonSpinner Component", () => {
  it("renders spinner SVG with default classes", () => {
    render(<ButtonSpinner />);
    const spinner = screen.getByTestId("button-spinner");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveClass("h-3.5");
    expect(spinner).toHaveClass("w-3.5");
  });

  it("applies disabled classes when disabled prop is provided", () => {
    render(<ButtonSpinner disabled />);
    const spinner = screen.getByTestId("button-spinner");
    expect(spinner).toHaveClass("opacity-50");
    expect(spinner).toHaveClass("cursor-not-allowed");
  });
});