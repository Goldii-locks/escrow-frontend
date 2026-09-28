import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// SignatureTimeoutAlert pulls in WalletContext, which loads the Stellar
// Wallets Kit at module scope. Stubbing the context keeps this suite focused
// on fee inspection and independent of the wallet SDK import chain.
vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => ({
    networkMismatchMessage: null,
    selectedWalletId: "freighter",
    assembleMultiSigTransaction: async () => ({
      uniqueSigners: 0,
      splitsValidated: 0,
    }),
    signatureTimeoutError: null,
    signatureTimeoutXdr: null,
    clearSignatureTimeout: () => {},
  }),
}));

import SignatureTimeoutAlert from "@/app/components/SignatureTimeoutAlert";
import SignatureTimeoutFeeWarningBanner from "@/app/components/SignatureTimeoutFeeWarningBanner";
import {
  assertSignatureFeeWithinBounds,
  DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS,
  ELEVATED_FEE_RATIO,
  extractEstimatedFeeStroops,
  extractSimulationError,
  formatStroopsAsXlm,
  inspectSignatureFee,
  SignatureFeeExceededError,
  SignatureSimulationError,
  warnOnSignatureFeeExceeded,
  type SignatureTimeoutSimulationResult,
} from "@/app/lib/signature_timeout_alert";

const LIMIT = DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS;
const BANNER = "signature-timeout-fee-warning-banner";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signature_timeout_alert — simulation fee inspection", () => {
  // -------------------------------------------------------------------------
  // extractEstimatedFeeStroops
  // -------------------------------------------------------------------------

  it("reads minResourceFee from a Soroban simulation", () => {
    expect(extractEstimatedFeeStroops({ minResourceFee: 2_500_000 })).toBe(
      2_500_000
    );
  });

  it("reads a string minResourceFee", () => {
    expect(extractEstimatedFeeStroops({ minResourceFee: "750000" })).toBe(
      750_000
    );
  });

  it("falls back to the classic fee field", () => {
    expect(extractEstimatedFeeStroops({ fee: 100 })).toBe(100);
  });

  it("prefers minResourceFee over fee when both are present", () => {
    expect(
      extractEstimatedFeeStroops({ minResourceFee: 900, fee: 100 })
    ).toBe(900);
  });

  it("returns 0 when the simulation carries no fee data", () => {
    expect(extractEstimatedFeeStroops({})).toBe(0);
  });

  it("returns 0 for a null or undefined simulation", () => {
    expect(extractEstimatedFeeStroops(null)).toBe(0);
    expect(extractEstimatedFeeStroops(undefined)).toBe(0);
  });

  it("returns 0 for an unparseable fee value", () => {
    expect(extractEstimatedFeeStroops({ minResourceFee: "not-a-number" })).toBe(
      0
    );
  });

  it("returns 0 for a negative fee value", () => {
    expect(extractEstimatedFeeStroops({ fee: -5_000 })).toBe(0);
  });

  // -------------------------------------------------------------------------
  // extractSimulationError
  // -------------------------------------------------------------------------

  it("reads a top-level simulation error", () => {
    expect(extractSimulationError({ error: "HostError" })).toBe("HostError");
  });

  it("reads a nested result.error", () => {
    expect(extractSimulationError({ result: { error: "trap" } })).toBe("trap");
  });

  it("returns null when the simulation succeeded", () => {
    expect(extractSimulationError({ minResourceFee: 10 })).toBeNull();
  });

  it("treats a blank error string as no error", () => {
    expect(extractSimulationError({ error: "   " })).toBeNull();
  });

  // -------------------------------------------------------------------------
  // inspectSignatureFee — the validation rule
  // -------------------------------------------------------------------------

  it("flags a fee above the standard bound as exceeded", () => {
    const state = inspectSignatureFee({ minResourceFee: LIMIT + 1 });
    expect(state.exceeded).toBe(true);
    expect(state.hasWarning).toBe(true);
    expect(state.severity).toBe("exceeded");
    expect(state.warningMessage).toContain("High fee detected");
  });

  it("does not flag a fee exactly at the bound", () => {
    const state = inspectSignatureFee({ minResourceFee: LIMIT });
    expect(state.exceeded).toBe(false);
  });

  it("reports no warning for a fee comfortably inside the bound", () => {
    const state = inspectSignatureFee({ minResourceFee: 100 });
    expect(state.hasWarning).toBe(false);
    expect(state.severity).toBe("none");
    expect(state.warningMessage).toBeNull();
  });

  it("flags a fee above the elevated ratio but under the bound", () => {
    const state = inspectSignatureFee({
      minResourceFee: LIMIT * ELEVATED_FEE_RATIO + 1,
    });
    expect(state.severity).toBe("elevated");
    expect(state.exceeded).toBe(false);
    expect(state.hasWarning).toBe(true);
    expect(state.warningMessage).toContain("Elevated fee");
  });

  it("honours a custom fee limit", () => {
    const state = inspectSignatureFee({ minResourceFee: 500 }, 400);
    expect(state.exceeded).toBe(true);
    expect(state.feeLimitStroops).toBe(400);
  });

  it("falls back to the default limit when given a non-positive limit", () => {
    const state = inspectSignatureFee({ minResourceFee: 10 }, 0);
    expect(state.feeLimitStroops).toBe(LIMIT);
  });

  it("reports the simulation error severity when the simulation failed", () => {
    const state = inspectSignatureFee({ error: "insufficient balance" });
    expect(state.severity).toBe("error");
    expect(state.hasWarning).toBe(true);
    expect(state.exceeded).toBe(false);
    expect(state.simulationError).toBe("insufficient balance");
    expect(state.warningMessage).toContain("Simulation failed");
  });

  it("surfaces the simulation error even when a fee is present", () => {
    const state = inspectSignatureFee({
      minResourceFee: LIMIT * 10,
      error: "trap",
    });
    expect(state.severity).toBe("error");
    expect(state.estimatedFeeStroops).toBe(LIMIT * 10);
  });

  it("carries the estimated fee and limit through in the state", () => {
    const state = inspectSignatureFee({ minResourceFee: 3_000_000 }, LIMIT);
    expect(state.estimatedFeeStroops).toBe(3_000_000);
    expect(state.feeLimitStroops).toBe(LIMIT);
  });

  it("includes both the XLM and stroop amounts in the warning copy", () => {
    const state = inspectSignatureFee({ minResourceFee: 5_000_000 });
    expect(state.warningMessage).toContain("0.5000000 XLM");
    expect(state.warningMessage).toContain("5000000 stroops");
  });

  it("treats a null simulation as within bounds", () => {
    const state = inspectSignatureFee(null);
    expect(state.hasWarning).toBe(false);
    expect(state.estimatedFeeStroops).toBe(0);
  });

  it("formatStroopsAsXlm renders 7 decimal places", () => {
    expect(formatStroopsAsXlm(10_000_000)).toBe("1.0000000");
  });

  // -------------------------------------------------------------------------
  // warnOnSignatureFeeExceeded
  // -------------------------------------------------------------------------

  it("logs a console warning when the fee exceeds the bound", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnSignatureFeeExceeded({ minResourceFee: LIMIT * 2 });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain("[signature_timeout_alert]");
    expect(String(warn.mock.calls[0][0])).toContain("EXCEEDED");
  });

  it("does not log when the fee is within bounds", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnSignatureFeeExceeded({ minResourceFee: 10 });
    expect(warn).not.toHaveBeenCalled();
  });

  it("attaches a SignatureFeeExceededError to the warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnSignatureFeeExceeded({ minResourceFee: LIMIT * 2 });
    expect(warn.mock.calls[0][1]).toBeInstanceOf(SignatureFeeExceededError);
  });

  it("attaches a SignatureSimulationError when the simulation failed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnSignatureFeeExceeded({ error: "trap" });
    expect(warn.mock.calls[0][1]).toBeInstanceOf(SignatureSimulationError);
  });

  it("returns the same state as inspectSignatureFee", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sim: SignatureTimeoutSimulationResult = { minResourceFee: LIMIT * 3 };
    expect(warnOnSignatureFeeExceeded(sim)).toEqual(inspectSignatureFee(sim));
  });

  // -------------------------------------------------------------------------
  // assertSignatureFeeWithinBounds
  // -------------------------------------------------------------------------

  it("throws SignatureFeeExceededError above the bound", () => {
    expect(() =>
      assertSignatureFeeWithinBounds({ minResourceFee: LIMIT + 1 })
    ).toThrow(SignatureFeeExceededError);
  });

  it("throws SignatureSimulationError when the simulation failed", () => {
    expect(() => assertSignatureFeeWithinBounds({ error: "trap" })).toThrow(
      SignatureSimulationError
    );
  });

  it("returns the state when the fee is within bounds", () => {
    const state = assertSignatureFeeWithinBounds({ minResourceFee: 10 });
    expect(state.hasWarning).toBe(false);
  });

  it("SignatureFeeExceededError carries both amounts", () => {
    const err = new SignatureFeeExceededError(2_000_000, 1_000_000);
    expect(err.estimatedFeeStroops).toBe(2_000_000);
    expect(err.feeLimitStroops).toBe(1_000_000);
    expect(err.name).toBe("SignatureFeeExceededError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("SignatureTimeoutFeeWarningBanner", () => {
  it("displays the banner when the fee exceeds standard bounds", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: LIMIT * 2 }}
      />
    );
    expect(screen.getByTestId(BANNER)).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain(
      "High fee detected"
    );
  });

  it("renders nothing when the fee is within bounds", () => {
    const { container } = render(
      <SignatureTimeoutFeeWarningBanner simulation={{ minResourceFee: 100 }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a simulation", () => {
    const { container } = render(
      <SignatureTimeoutFeeWarningBanner simulation={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the exceeded severity on the banner", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: LIMIT * 2 }}
      />
    );
    expect(screen.getByTestId(BANNER)).toHaveAttribute(
      "data-severity",
      "exceeded"
    );
  });

  it("marks the elevated severity on the banner", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: LIMIT * 0.75 }}
      />
    );
    expect(screen.getByTestId(BANNER)).toHaveAttribute(
      "data-severity",
      "elevated"
    );
  });

  it("marks the error severity when the simulation failed", () => {
    render(<SignatureTimeoutFeeWarningBanner simulation={{ error: "trap" }} />);
    expect(screen.getByTestId(BANNER)).toHaveAttribute("data-severity", "error");
  });

  it("respects a custom fee limit", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: 500 }}
        feeLimitStroops={400}
      />
    );
    expect(screen.getByTestId(BANNER)).toHaveAttribute(
      "data-severity",
      "exceeded"
    );
  });

  it("uses design token classes for the exceeded state", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: LIMIT * 2 }}
      />
    );
    const banner = screen.getByTestId(BANNER);
    expect(banner.className).toContain("border-warning");
    expect(banner.className).toContain("text-warning-soft");
  });

  it("uses danger tokens for the simulation error state", () => {
    render(<SignatureTimeoutFeeWarningBanner simulation={{ error: "trap" }} />);
    const banner = screen.getByTestId(BANNER);
    expect(banner.className).toContain("border-danger");
    expect(banner.className).toContain("text-danger-soft");
  });

  it("applies a custom className", () => {
    render(
      <SignatureTimeoutFeeWarningBanner
        simulation={{ minResourceFee: LIMIT * 2 }}
        className="mt-6"
      />
    );
    expect(screen.getByTestId(BANNER).className).toContain("mt-6");
  });
});

// The alert component itself is owned by the multisig timeout feature; these
// tests cover only the fee-inspection behaviour wired into it.
describe("SignatureTimeoutAlert — fee inspection", () => {
  it("renders nothing when there is no timeout and no fee warning", () => {
    const { container } = render(
      <SignatureTimeoutAlert simulation={{ minResourceFee: 100 }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders on a fee warning alone, with no timeout", () => {
    render(
      <SignatureTimeoutAlert simulation={{ minResourceFee: LIMIT * 2 }} />
    );
    expect(screen.getByTestId("signature-timeout-alert")).toBeInTheDocument();
    expect(screen.getByTestId(BANNER)).toBeInTheDocument();
  });

  it("shows the fee banner alongside the timeout notice", () => {
    render(
      <SignatureTimeoutAlert
        isOpen
        simulation={{ minResourceFee: LIMIT * 5 }}
      />
    );
    expect(
      screen.getByText("Signature request timed out")
    ).toBeInTheDocument();
    expect(screen.getByTestId(BANNER)).toBeInTheDocument();
  });

  it("shows the timeout notice with no banner when the fee is in bounds", () => {
    render(
      <SignatureTimeoutAlert isOpen simulation={{ minResourceFee: 100 }} />
    );
    expect(
      screen.getByText("Signature request timed out")
    ).toBeInTheDocument();
    expect(screen.queryByTestId(BANNER)).not.toBeInTheDocument();
  });

  it("exposes the fee severity on the alert wrapper", () => {
    render(
      <SignatureTimeoutAlert
        isOpen
        simulation={{ minResourceFee: LIMIT * 5 }}
      />
    );
    expect(screen.getByTestId("signature-timeout-alert")).toHaveAttribute(
      "data-fee-severity",
      "exceeded"
    );
  });

  it("reports a severity of none when no simulation is supplied", () => {
    render(<SignatureTimeoutAlert isOpen />);
    expect(screen.getByTestId("signature-timeout-alert")).toHaveAttribute(
      "data-fee-severity",
      "none"
    );
  });

  it("respects a custom fee limit", () => {
    render(
      <SignatureTimeoutAlert
        simulation={{ minResourceFee: 500 }}
        feeLimitStroops={400}
      />
    );
    expect(screen.getByTestId(BANNER)).toHaveAttribute(
      "data-severity",
      "exceeded"
    );
  });

  it("surfaces a failed simulation as an error banner", () => {
    render(<SignatureTimeoutAlert simulation={{ error: "trap" }} />);
    expect(screen.getByTestId(BANNER)).toHaveAttribute(
      "data-severity",
      "error"
    );
  });
});
