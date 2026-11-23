import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArbiterDisputeQueue from "@/app/components/ArbiterDisputeQueue";
import {
  buildArbiterDisputeQueue,
  type ArbiterQueueJob,
} from "@/app/lib/arbiter_dispute_queue";

const ARBITER = "GARBITER";
const NOW = Date.parse("2026-01-10T00:00:00Z");
const HOUR = 60 * 60 * 1000;

const jobs: ArbiterQueueJob[] = [
  {
    id: "job-late",
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [
      {
        index: 0,
        amount: "10000000",
        status: "Disputed",
        escalationDeadline: NOW + 48 * HOUR,
        disputedAt: NOW - 24 * HOUR,
        disputedBy: "GCLIENT",
      },
    ],
  },
  {
    id: "job-soon",
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [
      {
        index: 1,
        amount: "20000000",
        status: "Disputed",
        escalationDeadline: NOW + 2 * HOUR,
      },
    ],
  },
  {
    id: "job-overdue",
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [
      {
        index: 0,
        amount: "30000000",
        status: "Disputed",
        escalationDeadline: NOW - HOUR,
      },
    ],
  },
];

describe("ArbiterDisputeQueue component (#881)", () => {
  it("shows disputes from all three jobs on one page, most urgent first", () => {
    const entries = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    render(<ArbiterDisputeQueue entries={entries} />);

    const items = screen.getAllByTestId("arbiter-queue-item");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.getAttribute("data-job-id"))).toEqual([
      "job-overdue",
      "job-soon",
      "job-late",
    ]);

    const deadlines = screen.getAllByTestId("arbiter-queue-deadline");
    expect(deadlines[0]).toHaveTextContent("Escalatable now");
    expect(deadlines[1]).toHaveTextContent("2h 0m");
    expect(deadlines[2]).toHaveTextContent("2d 0h");
  });

  it("links each dispute to the job's dispute view on the dashboard", () => {
    const entries = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    render(<ArbiterDisputeQueue entries={entries} />);

    const links = screen.getAllByTestId("arbiter-queue-link");
    expect(links[0]).toHaveAttribute("href", "/dashboard?contractId=job-overdue");
    expect(links[1]).toHaveAttribute("href", "/dashboard?contractId=job-soon");
    expect(links[2]).toHaveAttribute("href", "/dashboard?contractId=job-late");
  });

  it("shows amount, raiser and raise time when known", () => {
    const entries = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    render(<ArbiterDisputeQueue entries={entries} />);

    // 10000000 stroops at 7 decimals = 1 XLM on the late job.
    expect(screen.getByText(/1 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-09 00:00 UTC/)).toBeInTheDocument();
    expect(screen.getAllByText(/unknown party/)).toHaveLength(2);
  });

  it("renders the empty state when there are no disputes", () => {
    render(<ArbiterDisputeQueue entries={[]} />);

    expect(screen.getByTestId("arbiter-queue-empty")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent(
      /no disputes need your decision/i,
    );
    expect(screen.queryByTestId("arbiter-queue-list")).not.toBeInTheDocument();
  });

  it("renders a loading state while fetching", () => {
    render(<ArbiterDisputeQueue entries={[]} loading />);
    expect(screen.getByTestId("arbiter-queue-loading")).toBeInTheDocument();
  });

  it("renders an error with a retry action", () => {
    const onRefresh = vi.fn();
    render(
      <ArbiterDisputeQueue entries={[]} error="Backend unreachable" onRefresh={onRefresh} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Backend unreachable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("announces the queue size and offers refresh", () => {
    const onRefresh = vi.fn();
    const entries = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    render(<ArbiterDisputeQueue entries={entries} onRefresh={onRefresh} />);

    expect(screen.getByTestId("arbiter-queue-count")).toHaveTextContent(
      "3 disputes awaiting your decision",
    );
    fireEvent.click(screen.getByTestId("arbiter-queue-refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});