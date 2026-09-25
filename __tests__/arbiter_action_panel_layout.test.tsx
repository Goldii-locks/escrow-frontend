/**
 * Client-side layout coverage for ArbiterActionPanel: asserts the exact node
 * tree the panel renders — element types, order, nesting, and which nodes
 * appear or disappear in each state — so structural regressions surface as
 * precise test failures.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import MilestoneCard from "@/app/components/MilestoneCard";

const renderPanel = (
  props: Partial<Parameters<typeof ArbiterActionPanel>[0]> = {},
) =>
  render(
    <ArbiterActionPanel
      milestoneIndex={1}
      displayAmount="30 XLM"
      onResolve={vi.fn()}
      {...props}
    />,
  );

/** Tag names of an element's direct children, lower-cased. */
const childTags = (el: Element) => Array.from(el.children).map((c) => c.tagName.toLowerCase());

/** `data-testid`s of an element's direct children (empty string when absent). */
const childIds = (el: Element) =>
  Array.from(el.children).map((c) => c.getAttribute("data-testid") ?? "");

describe("root", () => {
  it("renders a single <section> root with two children: body and footer", () => {
    const { container } = renderPanel();
    expect(container.children).toHaveLength(1);
    const root = container.firstElementChild!;
    expect(root.tagName).toBe("SECTION");
    expect(root).toHaveAttribute("data-testid", "arbiter-action-panel");
    expect(childIds(root)).toEqual(["arbiter-panel-scroll", "arbiter-panel-actions"]);
    expect(childTags(root)).toEqual(["div", "div"]);
  });

  it("exposes its layout and state as data attributes", () => {
    renderPanel();
    const root = screen.getByTestId("arbiter-action-panel");
    ["data-viewport", "data-constrained", "data-state"].forEach((attr) =>
      expect(root).toHaveAttribute(attr),
    );
  });
});

describe("scrollable body", () => {
  it("renders heading, description, fieldset and confirm row in order at rest", () => {
    renderPanel();
    const body = screen.getByTestId("arbiter-panel-scroll");
    expect(childTags(body)).toEqual(["h3", "p", "fieldset", "div"]);
  });

  it("inserts the alert between description and fieldset when present", () => {
    renderPanel({ errorMessage: "Provider error" });
    const body = screen.getByTestId("arbiter-panel-scroll");
    expect(childIds(body)).toEqual([
      "",
      "",
      "arbiter-panel-alert",
      "arbiter-outcome-fieldset",
      "",
    ]);
    expect(childTags(body)).toEqual(["h3", "p", "div", "fieldset", "div"]);
  });

  it("appends the status banner as the last body node", () => {
    renderPanel({ resolveState: { phase: "success", error: null, txHash: null } });
    const body = screen.getByTestId("arbiter-panel-scroll");
    expect(body.lastElementChild).toHaveAttribute("data-testid", "arbiter-panel-status");
    expect(body.children).toHaveLength(5);
  });

  it("renders heading text with the one-based milestone number", () => {
    renderPanel({ milestoneIndex: 4 });
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Resolve dispute — Milestone 5",
    );
  });

  it("renders the amount inside the description when provided", () => {
    renderPanel();
    const description = screen.getByTestId("arbiter-panel-scroll").children[1];
    expect(description).toHaveTextContent("Decide where the disputed 30 XLM goes.");
  });
});

describe("outcome fieldset", () => {
  it("contains a legend then the option grid", () => {
    renderPanel();
    const fieldset = screen.getByTestId("arbiter-outcome-fieldset");
    expect(childTags(fieldset)).toEqual(["legend", "div"]);
    expect(fieldset.firstElementChild).toHaveTextContent("Outcome");
    expect(fieldset.children[1]).toHaveAttribute("data-testid", "arbiter-outcome-grid");
  });

  it("renders exactly two options, release then refund", () => {
    renderPanel();
    const grid = screen.getByTestId("arbiter-outcome-grid");
    expect(childTags(grid)).toEqual(["label", "label"]);
    expect(childIds(grid)).toEqual(["arbiter-outcome-release", "arbiter-outcome-refund"]);
  });

  it.each([
    ["release", "Release to Freelancer", "Pay the disputed funds to the freelancer."],
    ["refund", "Refund to Client", "Return the disputed funds to the client."],
  ])("%s option is a radio input followed by label and hint text", (value, label, hint) => {
    renderPanel();
    const option = screen.getByTestId(`arbiter-outcome-${value}`);
    expect(childTags(option)).toEqual(["input", "span"]);
    const input = option.firstElementChild as HTMLInputElement;
    expect(input.type).toBe("radio");
    expect(input.value).toBe(value);
    const text = option.children[1];
    expect(childTags(text)).toEqual(["span", "span"]);
    expect(text.children[0]).toHaveTextContent(label);
    expect(text.children[1]).toHaveTextContent(hint);
  });

  it("gives both radios the same group name", () => {
    renderPanel();
    const [a, b] = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(a.name).toBeTruthy();
    expect(a.name).toBe(b.name);
  });

  it("appends the outcome error after the grid only when invalid", async () => {
    const user = userEvent.setup();
    renderPanel();
    const fieldset = screen.getByTestId("arbiter-outcome-fieldset");
    expect(fieldset.children).toHaveLength(2);
    await user.click(screen.getByTestId("arbiter-submit"));
    expect(childTags(fieldset)).toEqual(["legend", "div", "p"]);
    expect(fieldset.lastElementChild).toHaveAttribute("data-testid", "arbiter-outcome-error");
  });
});

describe("confirmation row", () => {
  it("is a label wrapping a checkbox and its text", () => {
    renderPanel();
    const checkbox = screen.getByTestId("arbiter-confirm-checkbox") as HTMLInputElement;
    expect(checkbox.type).toBe("checkbox");
    const label = checkbox.parentElement!;
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", checkbox.id);
    expect(childTags(label)).toEqual(["input", "span"]);
    expect(label.children[1]).toHaveTextContent("I understand this decision is final.");
  });

  it("appends the confirmation error below the label only when invalid", async () => {
    const user = userEvent.setup();
    renderPanel();
    const row = screen.getByTestId("arbiter-confirm-checkbox").parentElement!.parentElement!;
    expect(childTags(row)).toEqual(["label"]);
    await user.click(screen.getByTestId("arbiter-submit"));
    expect(childTags(row)).toEqual(["label", "p"]);
    expect(row.lastElementChild).toHaveAttribute("data-testid", "arbiter-confirm-error");
  });
});

describe("actions footer", () => {
  it("contains a single button of type=button", () => {
    renderPanel();
    const actions = screen.getByTestId("arbiter-panel-actions");
    expect(childTags(actions)).toEqual(["button"]);
    expect(actions.firstElementChild).toHaveAttribute("type", "button");
  });

  it("renders only the label inside the button at rest", () => {
    renderPanel();
    const button = screen.getByTestId("arbiter-submit");
    expect(childIds(button)).toEqual(["arbiter-submit-label"]);
  });

  it("prepends the spinner inside the button while pending", () => {
    renderPanel({ isPending: true });
    const button = screen.getByTestId("arbiter-submit");
    expect(childIds(button)).toEqual(["button-spinner", "arbiter-submit-label"]);
    expect(button.firstElementChild!.tagName.toLowerCase()).toBe("svg");
  });
});

describe("empty data", () => {
  it("renders the placeholder node tree instead of the panel", () => {
    const { container } = render(<ArbiterActionPanel milestoneIndex={null} />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-testid", "arbiter-panel-placeholder");
    expect(childTags(root)).toEqual(["span", "p", "p"]);
    expect(within(root as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("placement inside MilestoneCard", () => {
  const idle = { phase: "idle" as const, error: null, txHash: null };

  it("renders the panel as the card's last structural child before the dispute modal slot", () => {
    render(
      <MilestoneCard
        isClient={false}
        isFreelancer={false}
        isArbiter
        milestone={{ index: 0, amount: "100", status: "Disputed" }}
        onResolveDispute={vi.fn()}
        partialReleaseState={idle}
        claimAutoReleaseState={idle}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
      />,
    );
    const card = screen.getByTestId("milestone-card");
    const panel = screen.getByTestId("arbiter-action-panel");
    expect(panel.parentElement).toBe(card);
    // Only one panel per card, and no leftover inline resolve buttons.
    expect(within(card).getAllByTestId("arbiter-action-panel")).toHaveLength(1);
    expect(within(card).getAllByRole("button")).toHaveLength(1);
  });
});
