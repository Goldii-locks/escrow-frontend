import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionStates } from "@/app/hooks/useActionStates";

/**
 * Loading state (#307).
 *
 * `isLoading` is tracked per action key and is deliberately separate from
 * `isPending`, which is derived from the transaction phase. A spinner needs to
 * appear while a wallet is being prompted — before any transaction phase
 * exists — so the two cannot be the same signal.
 */
describe("useActionStates — loading state", () => {
  it("reports false for a key that has never been touched", () => {
    const { result } = renderHook(() => useActionStates());
    expect(result.current.isLoading("release")).toBe(false);
  });

  it("flips a key's loading state on and off", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => result.current.setLoading("release", true));
    expect(result.current.isLoading("release")).toBe(true);

    act(() => result.current.setLoading("release", false));
    expect(result.current.isLoading("release")).toBe(false);
  });

  it("keeps loading state independent per action key", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => result.current.setLoading("release", true));

    expect(result.current.isLoading("release")).toBe(true);
    expect(result.current.isLoading("dispute")).toBe(false);
  });

  it("does not disturb phase, error or txHash", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => {
      result.current.setPhase("release", "submitting");
      result.current.setError("release", "boom");
      result.current.setTxHash("release", "abc123");
    });
    act(() => result.current.setLoading("release", true));

    const state = result.current.getState("release");
    expect(state.phase).toBe("submitting");
    expect(state.error).toBe("boom");
    expect(state.txHash).toBe("abc123");
    expect(state.isLoading).toBe(true);
  });

  it("is cleared by resetAction along with the rest of the state", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => result.current.setLoading("release", true));
    act(() => result.current.resetAction("release"));

    expect(result.current.isLoading("release")).toBe(false);
  });

  it("is independent of isPending, which tracks the transaction phase", () => {
    const { result } = renderHook(() => useActionStates());

    act(() => result.current.setLoading("release", true));

    // Wallet prompt is open, but the phase is still idle -- no transaction has
    // been built or submitted, so isPending must not report one.
    expect(result.current.isLoading("release")).toBe(true);
    expect(result.current.isPending("release")).toBe(false);
  });
});
