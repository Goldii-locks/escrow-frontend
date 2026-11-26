import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAutoReleaseInfo } from "@/app/lib/autoRelease";

vi.mock("@/app/lib/transactions", () => ({ BACKEND_URL: "https://escrow.example" }));

afterEach(() => vi.restoreAllMocks());

describe("fetchAutoReleaseInfo", () => {
  it("converts remaining seconds to an absolute deadline using the supplied clock", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ success: true, data: { secondsRemaining: 12 } }));

    await expect(fetchAutoReleaseInfo("job/a", 2, { now: () => 500 })).resolves.toEqual({
      deadlineMs: 12_500,
      eligible: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://escrow.example/api/jobs/job%2Fa/milestones/2/time-remaining",
      { signal: undefined }
    );
  });

  it("marks an elapsed window eligible and uses the default clock", async () => {
    vi.spyOn(Date, "now").mockReturnValue(900);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ success: true, data: { secondsRemaining: 0 } })
    );

    await expect(fetchAutoReleaseInfo("job", 0)).resolves.toEqual({
      deadlineMs: 900,
      eligible: true,
    });
  });

  it("returns an unknown deadline on a 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(fetchAutoReleaseInfo("job", 0)).resolves.toEqual({
      deadlineMs: null,
      eligible: false,
    });
  });

  it("rejects malformed data with only a legacy deadline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ success: true, data: { deadline: 1_700_000_000 } })
    );

    await expect(fetchAutoReleaseInfo("job", 0)).resolves.toEqual({
      deadlineMs: null,
      eligible: false,
    });
  });

  it("forwards the abort signal and returns an unknown deadline on abort", async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_, init) => {
      init?.signal?.throwIfAborted();
      throw new Error("Expected an aborted request");
    });
    controller.abort();

    await expect(fetchAutoReleaseInfo("job", 0, { signal: controller.signal })).resolves.toEqual({
      deadlineMs: null,
      eligible: false,
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});
