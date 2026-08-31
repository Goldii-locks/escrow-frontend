import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectWalletExtensionById,
  checkWalletAvailabilityById,
  disconnectWalletWithCheck,
  type WalletDisconnectResult,
} from "@/app/lib/wallet_disconnect_handler";

// ---------------------------------------------------------------------------
// Mocked Wallet Actions — disconnectWalletWithCheck with various scenarios
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler disconnectWalletWithCheck mocked wallet actions", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Successful disconnect scenarios
  // -------------------------------------------------------------------------

  describe("successful disconnect scenarios", () => {
    it("completes disconnect for freighter when extension is available", async () => {
      const disconnectFn = vi.fn(async () => {
        // Simulate async disconnect operation
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.fallbackInstructions).toBeNull();
      expect(result.installUrl).toBeNull();
      expect(disconnectFn).toHaveBeenCalledTimes(1);
    });

    it("completes disconnect for albedo when extension is available", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(disconnectFn).toHaveBeenCalled();
    });

    it("completes disconnect for xbull when extension is available", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "xbull",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(disconnectFn).toHaveBeenCalled();
    });

    it("completes disconnect for hana when extension is available", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "hana",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(disconnectFn).toHaveBeenCalled();
    });

    it("handles disconnect function that returns a value", async () => {
      const disconnectFn = vi.fn(async () => {
        return "disconnected";
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn as unknown as () => Promise<void>,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(disconnectFn).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Failed disconnect scenarios with Error objects
  // -------------------------------------------------------------------------

  describe("failed disconnect scenarios with Error objects", () => {
    it("captures error message when disconnect throws Error for freighter", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("Freighter extension crashed");
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Freighter extension crashed");
      expect(result.fallbackInstructions).toBeNull();
      expect(result.installUrl).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[wallet_disconnect_handler]");
      expect(logged).toContain("DISCONNECT FAILED");
      expect(logged).toContain("freighter");
    });

    it("captures error message when disconnect throws Error for albedo", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("Albedo popup closed unexpectedly");
      });

      const result = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Albedo popup closed unexpectedly");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("captures error message when disconnect throws Error for xbull", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("xBull connection lost");
      });

      const result = await disconnectWalletWithCheck(
        "xbull",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("xBull connection lost");
    });

    it("captures error message when disconnect throws Error for hana", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("Hana wallet timeout");
      });

      const result = await disconnectWalletWithCheck(
        "hana",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Hana wallet timeout");
    });

    it("handles Error with empty message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("");
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Failed disconnect scenarios with non-Error throws
  // -------------------------------------------------------------------------

  describe("failed disconnect scenarios with non-Error throws", () => {
    it("handles string throw with fallback message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw "string error from extension";
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during wallet disconnect.");
    });

    it("handles number throw with fallback message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw 404;
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during wallet disconnect.");
    });

    it("handles object throw with fallback message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw { code: "DISCONNECT_FAILED", reason: "user cancelled" };
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during wallet disconnect.");
    });

    it("handles null throw with fallback message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw null;
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during wallet disconnect.");
    });

    it("handles undefined throw with fallback message", async () => {
      const disconnectFn = vi.fn(async () => {
        throw undefined;
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during wallet disconnect.");
    });
  });

  // -------------------------------------------------------------------------
  // Wallet not installed scenarios
  // -------------------------------------------------------------------------

  describe("wallet not installed scenarios", () => {
    it("returns fallback instructions for freighter when not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeNull();
      expect(result.fallbackInstructions).not.toBeNull();
      expect(result.fallbackInstructions).toMatch(/freighter/i);
      expect(result.fallbackInstructions).toMatch(/install/i);
      expect(result.fallbackInstructions).toMatch(/refresh/i);
      expect(result.installUrl).toContain("freighter.app");
      expect(disconnectFn).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[wallet_disconnect_handler]");
      expect(logged).toContain("not installed");
    });

    it("returns fallback instructions for albedo when not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/albedo/i);
      expect(result.installUrl).toContain("albedo.link");
      expect(disconnectFn).not.toHaveBeenCalled();
    });

    it("returns fallback instructions for xbull when not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "xbull",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/xbull/i);
      expect(disconnectFn).not.toHaveBeenCalled();
    });

    it("returns fallback instructions for hana when not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "hana",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/hana/i);
      expect(disconnectFn).not.toHaveBeenCalled();
    });

    it("returns generic fallback for unknown wallet when not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "unknown-wallet",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/wallet extension not found/i);
      expect(result.installUrl).toBeNull();
      expect(disconnectFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Detector throws scenarios
  // -------------------------------------------------------------------------

  describe("detector throws scenarios", () => {
    it("returns fallback when detector throws for freighter", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => {
          throw new Error("detector failed");
        },
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).not.toBeNull();
      expect(result.installUrl).toContain("freighter.app");
      expect(disconnectFn).not.toHaveBeenCalled();
    });

    it("returns fallback when detector throws for albedo", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn,
        () => {
          throw new Error("detector error");
        },
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/albedo/i);
      expect(disconnectFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent and sequential disconnect scenarios
  // -------------------------------------------------------------------------

  describe("concurrent and sequential disconnect scenarios", () => {
    it("handles multiple sequential disconnects successfully", async () => {
      const disconnectFn1 = vi.fn(async () => {});
      const disconnectFn2 = vi.fn(async () => {});
      const disconnectFn3 = vi.fn(async () => {});

      const result1 = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn1,
        () => true,
      );
      const result2 = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn2,
        () => true,
      );
      const result3 = await disconnectWalletWithCheck(
        "xbull",
        disconnectFn3,
        () => true,
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(disconnectFn1).toHaveBeenCalledTimes(1);
      expect(disconnectFn2).toHaveBeenCalledTimes(1);
      expect(disconnectFn3).toHaveBeenCalledTimes(1);
    });

    it("handles concurrent disconnect attempts", async () => {
      const disconnectFn1 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const disconnectFn2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const [result1, result2] = await Promise.all([
        disconnectWalletWithCheck("freighter", disconnectFn1, () => true),
        disconnectWalletWithCheck("albedo", disconnectFn2, () => true),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(disconnectFn1).toHaveBeenCalled();
      expect(disconnectFn2).toHaveBeenCalled();
    });

    it("handles mixed success and failure in sequential disconnects", async () => {
      const disconnectFn1 = vi.fn(async () => {});
      const disconnectFn2 = vi.fn(async () => {
        throw new Error("disconnect failed");
      });
      const disconnectFn3 = vi.fn(async () => {});

      const result1 = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn1,
        () => true,
      );
      const result2 = await disconnectWalletWithCheck(
        "albedo",
        disconnectFn2,
        () => true,
      );
      const result3 = await disconnectWalletWithCheck(
        "xbull",
        disconnectFn3,
        () => true,
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("disconnect failed");
      expect(result3.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Delayed and async disconnect scenarios
  // -------------------------------------------------------------------------

  describe("delayed and async disconnect scenarios", () => {
    it("handles delayed disconnect operation", async () => {
      const disconnectFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
      expect(disconnectFn).toHaveBeenCalled();
    });

    it("handles disconnect that resolves immediately", async () => {
      const disconnectFn = vi.fn(async () => {
        return Promise.resolve();
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(true);
    });

    it("handles disconnect that rejects immediately", async () => {
      const disconnectFn = vi.fn(async () => {
        return Promise.reject(new Error("immediate rejection"));
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("immediate rejection");
    });
  });

  // -------------------------------------------------------------------------
  // Logging behavior verification
  // -------------------------------------------------------------------------

  describe("logging behavior verification", () => {
    it("logs warning when wallet is not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      await disconnectWalletWithCheck("freighter", disconnectFn, () => false);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[wallet_disconnect_handler]");
      expect(logged).toContain("freighter");
      expect(logged).toContain("not installed");
    });

    it("logs warning when disconnect fails", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("disconnect error");
      });

      await disconnectWalletWithCheck("albedo", disconnectFn, () => true);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[wallet_disconnect_handler]");
      expect(logged).toContain("DISCONNECT FAILED");
      expect(logged).toContain("albedo");
    });

    it("does not log when disconnect succeeds", async () => {
      const disconnectFn = vi.fn(async () => {});

      await disconnectWalletWithCheck("freighter", disconnectFn, () => true);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("logs availability check failure when detector throws", async () => {
      const disconnectFn = vi.fn(async () => {});

      await disconnectWalletWithCheck("freighter", disconnectFn, () => {
        throw new Error("detector error");
      });

      expect(warnSpy).toHaveBeenCalled();
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[wallet_disconnect_handler]");
      expect(logged).toContain("AVAILABILITY CHECK FAILED");
    });
  });

  // -------------------------------------------------------------------------
  // Result structure validation
  // -------------------------------------------------------------------------

  describe("result structure validation", () => {
    it("returns correct structure on successful disconnect", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result: WalletDisconnectResult = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("fallbackInstructions");
      expect(result).toHaveProperty("installUrl");
      expect(typeof result.success).toBe("boolean");
    });

    it("returns correct structure when wallet not installed", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result: WalletDisconnectResult = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => false,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error", null);
      expect(result).toHaveProperty("fallbackInstructions");
      expect(result).toHaveProperty("installUrl");
      expect(typeof result.fallbackInstructions).toBe("string");
    });

    it("returns correct structure on disconnect failure", async () => {
      const disconnectFn = vi.fn(async () => {
        throw new Error("failure");
      });

      const result: WalletDisconnectResult = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("fallbackInstructions", null);
      expect(result).toHaveProperty("installUrl", null);
      expect(typeof result.error).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles disconnect function that throws synchronously", async () => {
      const disconnectFn = vi.fn(() => {
        throw new Error("synchronous throw");
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn as unknown as () => Promise<void>,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("synchronous throw");
    });

    it("handles empty wallet ID", async () => {
      const disconnectFn = vi.fn(async () => {});

      const result = await disconnectWalletWithCheck(
        "",
        disconnectFn,
        () => false,
      );

      expect(result.success).toBe(false);
      expect(result.fallbackInstructions).toMatch(/wallet extension not found/i);
    });

    it("handles very long error messages", async () => {
      const longMessage = "x".repeat(1000);
      const disconnectFn = vi.fn(async () => {
        throw new Error(longMessage);
      });

      const result = await disconnectWalletWithCheck(
        "freighter",
        disconnectFn,
        () => true,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(longMessage);
    });

    it("handles disconnect function called multiple times", async () => {
      const disconnectFn = vi.fn(async () => {});

      await disconnectWalletWithCheck("freighter", disconnectFn, () => true);
      await disconnectWalletWithCheck("freighter", disconnectFn, () => true);

      expect(disconnectFn).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration with window globals
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler integration with window globals", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    const w = window as unknown as Record<string, unknown>;
    delete w["freighterApi"];
    delete w["freighter"];
    delete w["albedo"];
    delete w["albedoApi"];
    delete w["xBullSDK"];
    delete w["hanaWallet"];
    delete w["hana"];
  });

  it("detects freighter from window.freighterApi", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectWalletExtensionById("freighter")).toBe(true);
  });

  it("detects freighter from window.freighter", () => {
    (window as unknown as Record<string, unknown>)["freighter"] = {};
    expect(detectWalletExtensionById("freighter")).toBe(true);
  });

  it("detects albedo from window.albedo", () => {
    (window as unknown as Record<string, unknown>)["albedo"] = {};
    expect(detectWalletExtensionById("albedo")).toBe(true);
  });

  it("detects albedo from window.albedoApi", () => {
    (window as unknown as Record<string, unknown>)["albedoApi"] = {};
    expect(detectWalletExtensionById("albedo")).toBe(true);
  });

  it("detects xbull from window.xBullSDK", () => {
    (window as unknown as Record<string, unknown>)["xBullSDK"] = {};
    expect(detectWalletExtensionById("xbull")).toBe(true);
  });

  it("detects hana from window.hanaWallet", () => {
    (window as unknown as Record<string, unknown>)["hanaWallet"] = {};
    expect(detectWalletExtensionById("hana")).toBe(true);
  });

  it("detects hana from window.hana", () => {
    (window as unknown as Record<string, unknown>)["hana"] = {};
    expect(detectWalletExtensionById("hana")).toBe(true);
  });

  it("returns false when no globals are present", () => {
    expect(detectWalletExtensionById("freighter")).toBe(false);
    expect(detectWalletExtensionById("albedo")).toBe(false);
    expect(detectWalletExtensionById("xbull")).toBe(false);
    expect(detectWalletExtensionById("hana")).toBe(false);
  });

  it("uses detector override even when globals are present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectWalletExtensionById("freighter", () => false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkWalletAvailabilityById detailed scenarios
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler checkWalletAvailabilityById detailed scenarios", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns complete result structure when wallet is available", () => {
    const result = checkWalletAvailabilityById("freighter", () => true);

    expect(result.available).toBe(true);
    expect(result.setupInstruction).toBeNull();
    expect(result.installUrl).toBeNull();
  });

  it("returns freighter-specific setup instructions when unavailable", () => {
    const result = checkWalletAvailabilityById("freighter", () => false);

    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/freighter/i);
    expect(result.setupInstruction).toMatch(/freighter\.app/i);
    expect(result.installUrl).toBe("https://www.freighter.app/");
  });

  it("returns albedo-specific setup instructions when unavailable", () => {
    const result = checkWalletAvailabilityById("albedo", () => false);

    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/albedo/i);
    expect(result.setupInstruction).toMatch(/albedo\.link/i);
    expect(result.installUrl).toBe("https://albedo.link/");
  });

  it("returns xbull-specific setup instructions when unavailable", () => {
    const result = checkWalletAvailabilityById("xbull", () => false);

    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/xbull/i);
    expect(result.installUrl).toBe("https://xbull.app/");
  });

  it("returns hana-specific setup instructions when unavailable", () => {
    const result = checkWalletAvailabilityById("hana", () => false);

    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/hana/i);
    expect(result.installUrl).toBe("https://www.hanawallet.io/");
  });

  it("returns generic instructions for unknown wallet", () => {
    const result = checkWalletAvailabilityById("unknown", () => false);

    expect(result.available).toBe(false);
    expect(result.setupInstruction).toMatch(/wallet extension not found/i);
    expect(result.installUrl).toBeNull();
  });

  it("handles detector exception gracefully", () => {
    const result = checkWalletAvailabilityById("freighter", () => {
      throw new Error("detector crashed");
    });

    expect(result.available).toBe(false);
    expect(result.setupInstruction).not.toBeNull();
    expect(result.installUrl).toBe("https://www.freighter.app/");
    expect(warnSpy).toHaveBeenCalled();
  });
});
