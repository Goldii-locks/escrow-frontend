// @vitest-environment jsdom
/**
 * #891 — Action state keys must be scoped to the job contract ID.
 *
 * Before the fix, `approve-0` on job A and `approve-0` on job B resolved to
 * the same key in useActionStates, so a pending or failed action on job A
 * leaked into job B's milestone 0.
 *
 * The fix introduces actionKey(jobId, kind, index) which produces
 * `${jobId}:${kind}:${index}`.  This test verifies the core acceptance
 * criterion: a pending `approve` on job A leaves job B's milestone 0
 * idle and actionable.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActionStates } from "@/app/hooks/useActionStates";

// Inline the same helper that lives in dashboard/page.tsx so the test stays
// self-contained and doesn't need to import the full page component.
function actionKey(jobId: string, kind: string, index?: number): string {
  return index === undefined ? `${jobId}:${kind}` : `${jobId}:${kind}:${index}`;
}

const JOB_A = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const JOB_B = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("actionKey scoping (#891)", () => {
  it("produces distinct keys for the same kind+index on different jobs", () => {
    expect(actionKey(JOB_A, "approve", 0)).not.toBe(actionKey(JOB_B, "approve", 0));
  });

  it("includes jobId, kind, and index in the key", () => {
    const key = actionKey(JOB_A, "approve", 0);
    expect(key).toContain(JOB_A);
    expect(key).toContain("approve");
    expect(key).toContain("0");
  });

  it("omits index segment when index is undefined", () => {
    const key = actionKey(JOB_A, "fund");
    expect(key).toBe(`${JOB_A}:fund`);
  });

  it("pending approve on job A leaves job B milestone 0 idle and actionable", () => {
    const { result } = renderHook(() => useActionStates());

    // Simulate job A's approve-milestone-0 going into the submitting phase.
    act(() => {
      result.current.setPhase(actionKey(JOB_A, "approve", 0), "submitting");
    });

    // Job A milestone 0 must be pending.
    expect(result.current.isPending(actionKey(JOB_A, "approve", 0))).toBe(true);

    // Job B milestone 0 must be untouched — idle, not pending.
    expect(result.current.isPending(actionKey(JOB_B, "approve", 0))).toBe(false);
    expect(result.current.getState(actionKey(JOB_B, "approve", 0)).phase).toBe("idle");
  });

  it("failed action on job A does not set an error on job B", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => {
      result.current.setPhase(actionKey(JOB_A, "approve", 0), "error");
      result.current.setError(actionKey(JOB_A, "approve", 0), "Simulation failed");
    });

    expect(result.current.getState(actionKey(JOB_A, "approve", 0)).error).toBe("Simulation failed");
    expect(result.current.getState(actionKey(JOB_B, "approve", 0)).error).toBeNull();
  });

  it("resolving milestone 2 on job A does not affect milestone 2 on job B", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => {
      result.current.setPhase(actionKey(JOB_A, "resolve", 2), "signing");
    });

    expect(result.current.isPending(actionKey(JOB_A, "resolve", 2))).toBe(true);
    expect(result.current.isPending(actionKey(JOB_B, "resolve", 2))).toBe(false);
  });

  it("fund key is scoped to the job and does not collide across jobs", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => {
      result.current.setPhase(actionKey(JOB_A, "fund"), "building");
    });

    expect(result.current.isPending(actionKey(JOB_A, "fund"))).toBe(true);
    expect(result.current.isPending(actionKey(JOB_B, "fund"))).toBe(false);
  });
});
