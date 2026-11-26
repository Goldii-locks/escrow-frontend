import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/batchAutoRelease";
import { simulateContractRead } from "@/app/lib/contract_read";

vi.mock("@/app/lib/contract_read", () => ({ simulateContractRead: vi.fn() }));

const read = vi.mocked(simulateContractRead);
const job = {
  id: "job",
  autoReleaseSeconds: 20,
  milestones: [
    { index: 0, amount: "100", status: "Delivered", deliveredAt: 100 },
    { index: 1, amount: "100", status: "Pending" },
    { index: 2, amount: "100", status: "Delivered", deliveredAt: 200 },
    { index: 3, amount: "100", status: "Delivered", deliveredAt: 1_100_000_000_000 },
  ],
};

beforeEach(() => read.mockReset());

describe("job auto-release deadlines", () => {
  it("reads all delivered milestones and extensions in one simulation", async () => {
    read.mockResolvedValueOnce({
      job: {
        auto_release_seconds: BigInt(20),
        milestones: [
          { delivered_at: BigInt(100) },
          {},
          { delivered_at: BigInt(200) },
          { delivered_at: BigInt(1_100_000_000_000) },
        ],
      },
      milestone_timing: [
        { extension_seconds: 5, deadline: BigInt(125) },
        {},
        { extension_seconds: 0, deadline: BigInt(220) },
        { extension_seconds: 10, deadline: BigInt(1_100_000_000_030) },
      ],
    });

    expect(await fetchAllAutoReleaseDeadlines(job)).toEqual({
      0: 125_000,
      2: 220_000,
      3: 1_100_000_000_030_000,
    });
    expect(read).toHaveBeenCalledExactlyOnceWith("job", "get_escrow_state");
  });

  it("shares a pending read across dashboard consumers and keeps local deadlines if it fails", async () => {
    read.mockRejectedValueOnce(new Error("view unavailable"));

    const expanded = fetchAllAutoReleaseDeadlines(job);
    const actionPanel = fetchAllAutoReleaseDeadlines(job);
    const expected = { 0: 120_000, 2: 220_000, 3: 1_100_000_000_020_000 };
    await expect(expanded).resolves.toEqual(expected);
    await expect(actionPanel).resolves.toEqual(expected);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("skips the simulation for jobs without delivered milestones or an aborted request", async () => {
    await expect(fetchAllAutoReleaseDeadlines({ id: "empty", milestones: [] })).resolves.toEqual(
      {}
    );
    await fetchAllAutoReleaseDeadlines(job, AbortSignal.abort());
    expect(read).not.toHaveBeenCalled();
  });
});
