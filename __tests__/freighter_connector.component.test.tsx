import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FreighterConnector from "@/app/components/FreighterConnector";
import FreighterGasWarningBanner from "@/app/components/FreighterGasWarningBanner";
import {
  freighterTracker,
  FreighterSignatureTimeoutError,
  HIGH_FEE_THRESHOLD_STROOPS,
} from "@/app/lib/freighter_connector";

const showToast = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

// ---------------------------------------------------------------------------
// #112 — React Testing Library assertions for freighter_connector
// ---------------------------------------------------------------------------

describe("FreighterConnector component (#112)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    freighterTracker.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Trigger action compilation — all interactive elements must render
  // -------------------------------------------------------------------------

  it("renders all trigger actions and initial idle status without errors", () => {
    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={vi.fn()}
      />
    );

    expect(screen.getByTestId("freighter-connector")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Estimate fees" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign via Freighter" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("freighter-connector-status")).toHaveTextContent(
      "idle"
    );
  });

  // -------------------------------------------------------------------------
  // Fee estimation — normal fee (no warning)
  // -------------------------------------------------------------------------

  it("stays idle and shows no warning banner when fee is within bounds", async () => {
    const simulate = vi.fn().mockResolvedValue({ fee: 100 });

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("idle");
    });

    expect(
      screen.queryByTestId("freighter-gas-warning-banner")
    ).not.toBeInTheDocument();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Fee estimation — high fee warning
  // -------------------------------------------------------------------------

  it("shows simulation-warning status and gas warning banner when fee is too high", async () => {
    const simulate = vi
      .fn()
      .mockResolvedValue({ fee: HIGH_FEE_THRESHOLD_STROOPS + 500 });

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={vi.fn()}
        txId="tx-high-fee"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("simulation-warning");
    });

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[freighter_connector]");
    expect(logged).toContain("HIGH FEE WARNING");
    expect(logged).toContain("--- stack trace ---");
  });

  // -------------------------------------------------------------------------
  // Fee estimation — simulation error
  // -------------------------------------------------------------------------

  it("shows simulation-error status and error banner when simulation reports an error", async () => {
    const simulate = vi
      .fn()
      .mockResolvedValue({ fee: 0, error: "HostError: contract trap" });

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={vi.fn()}
        txId="tx-sim-err"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("simulation-error");
    });

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/simulation failed/i);
    expect(banner).toHaveTextContent("HostError: contract trap");
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIMULATION ERROR");
    expect(logged).toContain("--- stack trace ---");
  });

  it("calls onSimulated callback with the simulation result", async () => {
    const onSimulated = vi.fn();
    const simulate = vi.fn().mockResolvedValue({ fee: 50 });

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={vi.fn()}
        onSimulated={onSimulated}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));

    await waitFor(() => {
      expect(onSimulated).toHaveBeenCalledWith({ fee: 50 });
    });
  });

  it("handles simulate() throwing an unexpected error gracefully", async () => {
    const simulate = vi.fn().mockRejectedValue(new Error("RPC unreachable"));

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("error");
    });

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIMULATE ERROR");
    expect(logged).toContain("--- stack trace ---");
  });

  // -------------------------------------------------------------------------
  // Signing — happy path
  // -------------------------------------------------------------------------

  it("transitions to signed status when Freighter approves the transaction", async () => {
    const signTransaction = vi.fn().mockResolvedValue("signed-xdr-abc");
    const onSigned = vi.fn();

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
        onSigned={onSigned}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    expect(
      screen.getByTestId("freighter-connector-status")
    ).toHaveTextContent("signing");

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("signed");
    });

    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith("signed-xdr-abc");
  });

  // -------------------------------------------------------------------------
  // Signing — user rejection
  // -------------------------------------------------------------------------

  it("transitions to rejected status when user declines in Freighter", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("User rejected transaction"));

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("rejected");
    });

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIGNATURE REJECTED");
    expect(logged).toContain("--- stack trace ---");
    expect(showToast).toHaveBeenCalledWith(
      "Signature cancelled — you rejected the request in your wallet.",
      "warning"
    );
  });

  it("also handles 'user declined' rejection phrasing", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("User declined the request"));

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("rejected");
    });
  });

  it("transitions to rejected status when signTransaction returns empty string", async () => {
    const signTransaction = vi.fn().mockResolvedValue("");

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("rejected");
    });
  });

  // -------------------------------------------------------------------------
  // Signing — unexpected error
  // -------------------------------------------------------------------------

  it("transitions to error status for unexpected signing failures", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("Freighter extension crashed"));

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("error");
    });

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIGN ERROR");
    expect(logged).toContain("--- stack trace ---");
  });

  // -------------------------------------------------------------------------
  // Signing — signature timeout alert
  // -------------------------------------------------------------------------

  it("surfaces the signature timeout alert when Freighter signing times out", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new FreighterSignatureTimeoutError(60_000));

    render(
      <FreighterConnector
        simulate={vi.fn()}
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("error");
    });

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("SIGN ERROR");
    expect(logged).toContain("Freighter signature timed out after 60000ms");
    expect(logged).toContain("--- stack trace ---");
  });

  // -------------------------------------------------------------------------
  // Simulate then sign — full flow
  // -------------------------------------------------------------------------

  it("completes a full simulate-then-sign flow without errors", async () => {
    const simulate = vi.fn().mockResolvedValue({ fee: 200 });
    const signTransaction = vi.fn().mockResolvedValue("final-signed-xdr");
    const onSigned = vi.fn();

    render(
      <FreighterConnector
        simulate={simulate}
        signTransaction={signTransaction}
        onSigned={onSigned}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Estimate fees" }));
    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign via Freighter" }));
    await waitFor(() => {
      expect(
        screen.getByTestId("freighter-connector-status")
      ).toHaveTextContent("signed");
    });

    expect(onSigned).toHaveBeenCalledWith("final-signed-xdr");
    expect(
      screen.queryByTestId("freighter-gas-warning-banner")
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FreighterGasWarningBanner standalone component tests
// ---------------------------------------------------------------------------

describe("FreighterGasWarningBanner component (#112)", () => {
  it("renders nothing when simulation is null", () => {
    const { container } = render(
      <FreighterGasWarningBanner simulation={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when fee is within bounds and no error", () => {
    const { container } = render(
      <FreighterGasWarningBanner simulation={{ fee: 100 }} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId("freighter-gas-warning-banner")
    ).not.toBeInTheDocument();
  });

  it("renders a warning banner for high fees", () => {
    render(
      <FreighterGasWarningBanner
        simulation={{ fee: HIGH_FEE_THRESHOLD_STROOPS + 1 }}
      />
    );

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/unusually high/i);
  });

  it("renders a warning banner for simulation errors", () => {
    render(
      <FreighterGasWarningBanner
        simulation={{ fee: 0, error: "HostError: overflow" }}
      />
    );

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/simulation failed/i);
    expect(banner).toHaveTextContent("HostError: overflow");
  });

  it("renders a warning banner for simulationError objects", () => {
    render(
      <FreighterGasWarningBanner
        simulation={{ fee: 0, simulationError: { code: -1 } }}
      />
    );

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/simulation failed/i);
  });

  it("applies additional className when provided", () => {
    render(
      <FreighterGasWarningBanner
        simulation={{ fee: HIGH_FEE_THRESHOLD_STROOPS + 1 }}
        className="mt-4"
      />
    );

    const banner = screen.getByTestId("freighter-gas-warning-banner");
    expect(banner.className).toContain("mt-4");
  });
});
