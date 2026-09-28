/**
 * Tests for issue #245 — Graceful catch of user signature rejection exceptions
 * in signature_timeout_alert.
 *
 * Validates that runSignatureWithRejectionHandling catches wallet rejection
 * errors, emits a clean warning toast, logs a structured block, and returns
 * null — while re-throwing every other error unchanged.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSignatureRejectedByUser,
  runSignatureWithRejectionHandling,
  SignatureRejectedByUserError,
} from "@/app/lib/signature_timeout_alert";

describe("signature_timeout_alert user rejection handling (#245)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // isSignatureRejectedByUser — detection predicate
  // -------------------------------------------------------------------------

  describe("isSignatureRejectedByUser", () => {
    it("returns true for a first-class SignatureRejectedByUserError", () => {
      expect(
        isSignatureRejectedByUser(new SignatureRejectedByUserError())
      ).toBe(true);
    });

    it("returns true for 'user rejected transaction' message", () => {
      expect(
        isSignatureRejectedByUser(new Error("user rejected transaction"))
      ).toBe(true);
    });

    it("returns true for 'user declined' phrase (case-insensitive)", () => {
      expect(
        isSignatureRejectedByUser(new Error("User Declined the request"))
      ).toBe(true);
    });

    it("returns true for 'request rejected' phrase", () => {
      expect(isSignatureRejectedByUser(new Error("request rejected"))).toBe(
        true
      );
    });

    it("returns true for 'denied by the user' phrase", () => {
      expect(
        isSignatureRejectedByUser(new Error("denied by the user"))
      ).toBe(true);
    });

    it("returns true for 'rejected by user' phrase", () => {
      expect(isSignatureRejectedByUser(new Error("rejected by user"))).toBe(
        true
      );
    });

    it("returns true for 'canceled by user' phrase", () => {
      expect(isSignatureRejectedByUser(new Error("canceled by user"))).toBe(
        true
      );
    });

    it("returns true for 'cancelled by user' phrase", () => {
      expect(isSignatureRejectedByUser(new Error("cancelled by user"))).toBe(
        true
      );
    });

    it("performs case-insensitive matching", () => {
      expect(isSignatureRejectedByUser(new Error("USER REJECTED"))).toBe(true);
      expect(isSignatureRejectedByUser(new Error("REQUEST REJECTED"))).toBe(
        true
      );
      expect(
        isSignatureRejectedByUser(new Error("DENIED BY THE USER"))
      ).toBe(true);
    });

    it("returns false for an unrelated error message", () => {
      expect(isSignatureRejectedByUser(new Error("rpc timeout"))).toBe(false);
    });

    it("returns false for a horizon unreachable error", () => {
      expect(
        isSignatureRejectedByUser(new Error("horizon unreachable"))
      ).toBe(false);
    });

    it("returns false for a plain string (non-Error)", () => {
      expect(isSignatureRejectedByUser("user rejected")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isSignatureRejectedByUser(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isSignatureRejectedByUser(undefined)).toBe(false);
    });

    it("returns false for a number", () => {
      expect(isSignatureRejectedByUser(42)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // SignatureRejectedByUserError class shape
  // -------------------------------------------------------------------------

  describe("SignatureRejectedByUserError", () => {
    it("has the correct error name", () => {
      expect(new SignatureRejectedByUserError().name).toBe(
        "SignatureRejectedByUserError"
      );
    });

    it("uses the default message when none is supplied", () => {
      expect(new SignatureRejectedByUserError().message).toBe(
        "user rejected transaction"
      );
    });

    it("accepts a custom message", () => {
      expect(new SignatureRejectedByUserError("custom").message).toBe(
        "custom"
      );
    });

    it("is an instance of Error", () => {
      expect(new SignatureRejectedByUserError()).toBeInstanceOf(Error);
    });

    it("isSignatureRejectedByUser returns true for a custom-message instance", () => {
      expect(
        isSignatureRejectedByUser(
          new SignatureRejectedByUserError("something else")
        )
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // runSignatureWithRejectionHandling — happy path
  // -------------------------------------------------------------------------

  describe("runSignatureWithRejectionHandling — happy path", () => {
    it("returns the resolved value when the user approves", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(
        async () => "signed-xdr",
        showToast
      );

      expect(result).toBe("signed-xdr");
      expect(showToast).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("returns an object result correctly", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(
        async () => ({ hash: "abc" }),
        showToast
      );

      expect(result).toEqual({ hash: "abc" });
    });

    it("does not call showToast on success", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => "ok", showToast);
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // runSignatureWithRejectionHandling — rejection handling
  // -------------------------------------------------------------------------

  describe("runSignatureWithRejectionHandling — rejection handling", () => {
    it("catches rejection and returns null", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      expect(result).toBeNull();
    });

    it("shows a 'warning' toast with the cancellation message on rejection", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      expect(showToast).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        "Signature cancelled — you rejected the request in your wallet.",
        "warning"
      );
    });

    it("toast type is always 'warning' on rejection", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new SignatureRejectedByUserError();
      }, showToast);

      expect(showToast.mock.calls[0][1]).toBe("warning");
    });

    it("logs a structured [signature_timeout_alert] warning block", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[signature_timeout_alert]");
    });

    it("warning block contains 'SIGNATURE REJECTED' title", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("SIGNATURE REJECTED");
    });

    it("warning block contains the rejection body message", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("signature rejected by user");
    });

    it("warning block includes a stack trace section", async () => {
      const showToast = vi.fn();
      await runSignatureWithRejectionHandling(async () => {
        throw new Error("user rejected transaction");
      }, showToast);

      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("--- stack trace ---");
      expect(logged).toContain("--- end stack ---");
    });

    it("handles SignatureRejectedByUserError instance correctly", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(async () => {
        throw new SignatureRejectedByUserError();
      }, showToast);

      expect(result).toBeNull();
      expect(showToast).toHaveBeenCalledWith(
        "Signature cancelled — you rejected the request in your wallet.",
        "warning"
      );
    });

    it("handles 'user declined' phrase", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(async () => {
        throw new Error("User Declined the request");
      }, showToast);

      expect(result).toBeNull();
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it("handles 'denied by the user' phrase", async () => {
      const showToast = vi.fn();
      const result = await runSignatureWithRejectionHandling(async () => {
        throw new Error("denied by the user");
      }, showToast);

      expect(result).toBeNull();
      expect(showToast).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // runSignatureWithRejectionHandling — non-rejection error propagation
  // -------------------------------------------------------------------------

  describe("runSignatureWithRejectionHandling — non-rejection errors", () => {
    it("re-throws non-rejection errors without showing a toast", async () => {
      const showToast = vi.fn();
      await expect(
        runSignatureWithRejectionHandling(async () => {
          throw new Error("horizon unreachable");
        }, showToast)
      ).rejects.toThrow("horizon unreachable");

      expect(showToast).not.toHaveBeenCalled();
    });

    it("does not log a warning for non-rejection errors", async () => {
      const showToast = vi.fn();
      await expect(
        runSignatureWithRejectionHandling(async () => {
          throw new Error("network failure");
        }, showToast)
      ).rejects.toThrow();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("preserves the original error type when re-throwing", async () => {
      const showToast = vi.fn();
      const original = new TypeError("bad XDR format");
      await expect(
        runSignatureWithRejectionHandling(async () => {
          throw original;
        }, showToast)
      ).rejects.toBe(original);
    });
  });
});
