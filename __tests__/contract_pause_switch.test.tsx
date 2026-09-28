import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContractPauseSwitch from "@/app/components/ContractPauseSwitch";
import {
  CONTRACT_PAUSE_DESKTOP_MIN_WIDTH,
  CONTRACT_PAUSE_GRID_CLASSES,
  CONTRACT_PAUSE_TABLET_MIN_WIDTH,
  MOCK_CONTRACT_PAUSE_STATE,
  MOCK_CONTRACT_PAUSE_TRANSITIONS,
  classifyContractPauseViewport,
  containsCodeTags,
  CONTRACT_PAUSE_BADGES,
  contractPauseErrorToast,
  contractPauseSuccessToast,
  fetchContractPauseState,
  getContractPauseBadge,
  getContractPauseGridLayout,
  getContractPauseGridLayoutForWidth,
  getContractPausePhaseLabel,
  getContractPauseReadouts,
  isContractPauseState,
  sanitizePauseField,
} from "@/app/lib/contract_pause_switch";

/** Common device widths used across the layout assertions. */
const WIDTHS = {
  phoneSmall: 320,
  phone: 375,
  tablet: 768,
  laptop: 1280,
  desktop: 1920,
};

/** Splits a Tailwind class string into a Set for membership assertions. */
function toClassSet(className: string): Set<string> {
  return new Set(className.split(/\s+/).filter(Boolean));
}

describe("contract_pause_switch module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // Grid layout sizing constraints (Issue #478)
  // =========================================================================

  describe("Grid layout sizing constraints (Issue #478)", () => {
    it("classifies viewport widths onto the documented breakpoints", () => {
      expect(classifyContractPauseViewport(WIDTHS.phoneSmall)).toBe("mobile");
      expect(classifyContractPauseViewport(WIDTHS.phone)).toBe("mobile");
      expect(classifyContractPauseViewport(CONTRACT_PAUSE_TABLET_MIN_WIDTH - 1)).toBe(
        "mobile",
      );
      expect(classifyContractPauseViewport(CONTRACT_PAUSE_TABLET_MIN_WIDTH)).toBe(
        "tablet",
      );
      expect(classifyContractPauseViewport(WIDTHS.tablet)).toBe("tablet");
      expect(classifyContractPauseViewport(CONTRACT_PAUSE_DESKTOP_MIN_WIDTH - 1)).toBe(
        "tablet",
      );
      expect(classifyContractPauseViewport(CONTRACT_PAUSE_DESKTOP_MIN_WIDTH)).toBe(
        "desktop",
      );
      expect(classifyContractPauseViewport(WIDTHS.desktop)).toBe("desktop");
    });

    it("falls back to the narrowest layout for unusable widths", () => {
      expect(classifyContractPauseViewport(-1)).toBe("mobile");
      expect(classifyContractPauseViewport(Number.NaN)).toBe("mobile");
      expect(classifyContractPauseViewport(Number.POSITIVE_INFINITY)).toBe("mobile");
      expect(
        classifyContractPauseViewport("1024" as unknown as number),
      ).toBe("mobile");
    });

    it("widens the status grid one column per breakpoint", () => {
      expect(getContractPauseGridLayout("mobile").statusColumns).toBe(1);
      expect(getContractPauseGridLayout("tablet").statusColumns).toBe(2);
      expect(getContractPauseGridLayout("desktop").statusColumns).toBe(3);
    });

    it("stops stretching the toggle inline only once the row fits", () => {
      const mobile = getContractPauseGridLayout("mobile");
      const tablet = getContractPauseGridLayout("tablet");
      const desktop = getContractPauseGridLayout("desktop");

      expect(mobile.fullWidthToggle).toBe(true);
      expect(mobile.inlineToggle).toBe(false);
      expect(tablet.fullWidthToggle).toBe(true);
      expect(desktop.fullWidthToggle).toBe(false);
      expect(desktop.inlineToggle).toBe(true);
    });

    it("caps the panel width at every breakpoint so the row cannot outgrow it", () => {
      expect(getContractPauseGridLayout("mobile").maxWidthClass).toBe("max-w-full");
      expect(getContractPauseGridLayout("tablet").maxWidthClass).toBe("max-w-2xl");
      expect(getContractPauseGridLayout("desktop").maxWidthClass).toBe("max-w-4xl");
    });

    it("keeps cells top-aligned on mobile and aligned once the row is even", () => {
      expect(getContractPauseGridLayout("mobile").align).toBe("start");
      expect(getContractPauseGridLayout("tablet").align).toBe("stretch");
      expect(getContractPauseGridLayout("desktop").align).toBe("stretch");
    });

    it("resolves the layout straight from a pixel width", () => {
      expect(getContractPauseGridLayoutForWidth(WIDTHS.tablet).viewport).toBe(
        "tablet",
      );
      expect(getContractPauseGridLayoutForWidth(WIDTHS.laptop).statusColumns).toBe(3);
    });

    it("encodes 1 -> 2 -> 3 responsive columns on the status grid", () => {
      const classes = toClassSet(CONTRACT_PAUSE_GRID_CLASSES.statusGrid);

      expect(classes.has("grid")).toBe(true);
      expect(classes.has("grid-cols-1")).toBe(true);
      expect(classes.has("sm:grid-cols-2")).toBe(true);
      expect(classes.has("lg:grid-cols-3")).toBe(true);
    });

    it("keeps every readout cell shrinkable and breakable so content cannot wrap out of bounds", () => {
      const cell = toClassSet(CONTRACT_PAUSE_GRID_CLASSES.statusCell);
      const value = toClassSet(CONTRACT_PAUSE_GRID_CLASSES.statusValue);

      // `min-w-0` is what lets a grid track shrink below its content width, so
      // a long contract address cannot push the row past the panel cap.
      expect(cell.has("min-w-0")).toBe(true);
      expect(value.has("min-w-0")).toBe(true);
      expect(value.has("break-words")).toBe(true);

      // No fixed widths or nowrap anywhere in the cell/value classes.
      for (const token of [...cell, ...value]) {
        expect(token).not.toMatch(/^w-\[/);
        expect(token).not.toBe("whitespace-nowrap");
      }
    });

    it("keeps the toggle a full-width tap target on mobile and auto-width from sm", () => {
      const toggle = toClassSet(CONTRACT_PAUSE_GRID_CLASSES.toggle);

      expect(toggle.has("w-full")).toBe(true);
      expect(toggle.has("sm:w-auto")).toBe(true);
      expect(toggle.has("min-h-[44px]")).toBe(true);
    });

    it("stacks the toggle row on mobile and inlines it from sm", () => {
      const row = toClassSet(CONTRACT_PAUSE_GRID_CLASSES.toggleRow);

      expect(row.has("flex-col")).toBe(true);
      expect(row.has("sm:flex-row")).toBe(true);
      expect(row.has("sm:items-center")).toBe(true);
    });

    it("renders the status grid and toggle on the panel", () => {
      render(<ContractPauseSwitch initialState={MOCK_CONTRACT_PAUSE_STATE} />);

      expect(screen.getByTestId("contract-pause-switch")).toBeInTheDocument();
      expect(screen.getByTestId("contract-pause-status-grid")).toHaveClass(
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
      );
      expect(screen.getByTestId("contract-pause-toggle")).toHaveClass(
        "w-full",
        "sm:w-auto",
      );
    });
  });

  // =========================================================================
  // Mock integration checks (Issue #479)
  // =========================================================================

  describe("Mock integration checks (Issue #479)", () => {
    it("exposes a complete mock freeze state", () => {
      expect(isContractPauseState(MOCK_CONTRACT_PAUSE_STATE)).toBe(true);
      expect(MOCK_CONTRACT_PAUSE_STATE.contractId).toMatch(/^C/);
      expect(MOCK_CONTRACT_PAUSE_STATE.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T/,
      );
      expect(MOCK_CONTRACT_PAUSE_TRANSITIONS.length).toBeGreaterThan(0);
    });

    it("rejects payloads that are missing fields the panel reads", () => {
      expect(isContractPauseState(null)).toBe(false);
      expect(isContractPauseState("frozen")).toBe(false);
      expect(isContractPauseState({})).toBe(false);
      expect(
        isContractPauseState({ ...MOCK_CONTRACT_PAUSE_STATE, paused: "yes" }),
      ).toBe(false);
      const incomplete: Record<string, unknown> = {
        ...MOCK_CONTRACT_PAUSE_STATE,
      };
      delete incomplete.updatedBy;
      expect(isContractPauseState(incomplete)).toBe(false);
    });

    it("labels the freeze phase from the boolean flag", () => {
      expect(getContractPausePhaseLabel(true)).toBe("Frozen");
      expect(getContractPausePhaseLabel(false)).toBe("Active");
    });

    it("falls back to a dash for blank readout values", () => {
      const readouts = getContractPauseReadouts({
        ...MOCK_CONTRACT_PAUSE_STATE,
        reason: "   ",
        updatedBy: "",
      });

      expect(readouts.phase).toBe("Frozen");
      expect(readouts.reason).toBe("—");
      expect(readouts.updatedBy).toBe("—");
      expect(readouts.contractId).toBe(MOCK_CONTRACT_PAUSE_STATE.contractId);
    });

    it("returns the mock state when the backend is unreachable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      await expect(fetchContractPauseState()).resolves.toEqual(
        MOCK_CONTRACT_PAUSE_STATE,
      );
    });

    it("returns the mock state when the backend payload is incomplete", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ paused: true }),
          }),
        ),
      );

      await expect(fetchContractPauseState()).resolves.toEqual(
        MOCK_CONTRACT_PAUSE_STATE,
      );
    });

    it("returns the mock state on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve({ ok: false, status: 503 })),
      );

      await expect(fetchContractPauseState()).resolves.toEqual(
        MOCK_CONTRACT_PAUSE_STATE,
      );
    });

    it("returns a complete backend payload through a success envelope", async () => {
      const backendState = {
        ...MOCK_CONTRACT_PAUSE_STATE,
        paused: false,
        reason: "Indexer resynced; releases verified.",
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: backendState }),
          }),
        ),
      );

      await expect(fetchContractPauseState()).resolves.toEqual(backendState);
    });

    it("renders every readout from the mock state with no backend", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("network down"))),
      );

      render(<ContractPauseSwitch />);

      await waitFor(() => {
        expect(
          screen.getByText(MOCK_CONTRACT_PAUSE_STATE.reason),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(MOCK_CONTRACT_PAUSE_STATE.contractId),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Frozen").length).toBeGreaterThan(0);
      expect(screen.getByTestId("contract-pause-cell-reason")).toBeInTheDocument();
      expect(
        screen.getByTestId("contract-pause-cell-contract"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("contract-pause-cell-updated")).toBeInTheDocument();
    });

    it("shows placeholders while the freeze state resolves", async () => {
      render(<ContractPauseSwitch isLoading />);

      const loading = screen.getByTestId("contract-pause-loading");
      expect(loading).toBeInTheDocument();
      expect(screen.getByTestId("contract-pause-toggle")).toBeInTheDocument();

      // Flush the mock fetch so the pending update lands inside the test.
      await waitFor(() => {
        expect(
          screen.getByTestId("contract-pause-toggle"),
        ).toHaveAttribute("aria-checked", "true");
      });
    });

    it("renders the toggle in the frozen state and reports the next state", () => {
      const onToggle = vi.fn();
      render(
        <ContractPauseSwitch
          initialState={MOCK_CONTRACT_PAUSE_STATE}
          onToggle={onToggle}
        />,
      );

      const toggle = screen.getByRole("switch", { name: /Emergency freeze/i });
      expect(toggle).toHaveAttribute("aria-checked", "true");
      expect(toggle).toHaveTextContent("Lift Freeze");

      fireEvent.click(toggle);
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it("reports the frozen state when the contract is live", () => {
      const onToggle = vi.fn();
      render(
        <ContractPauseSwitch
          initialState={{ ...MOCK_CONTRACT_PAUSE_STATE, paused: false }}
          onToggle={onToggle}
        />,
      );

      const toggle = screen.getByRole("switch", { name: /Emergency freeze/i });
      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(toggle).toHaveTextContent("Freeze Contract");

      fireEvent.click(toggle);
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it("does not fire while a transaction is pending", () => {
      const onToggle = vi.fn();
      render(
        <ContractPauseSwitch
          initialState={MOCK_CONTRACT_PAUSE_STATE}
          isPending
          onToggle={onToggle}
        />,
      );

      const toggle = screen.getByRole("switch", { name: /Emergency freeze/i });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveTextContent("Submitting...");

      fireEvent.click(toggle);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("does not fire while the control is disabled", () => {
      const onToggle = vi.fn();
      render(
        <ContractPauseSwitch
          initialState={MOCK_CONTRACT_PAUSE_STATE}
          disabled
          onToggle={onToggle}
        />,
      );

      const toggle = screen.getByRole("switch", { name: /Emergency freeze/i });
      fireEvent.click(toggle);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("honours the controlled paused prop over the resolved snapshot", () => {
      render(
        <ContractPauseSwitch
          initialState={MOCK_CONTRACT_PAUSE_STATE}
          paused={false}
        />,
      );

      expect(
        screen.getByRole("switch", { name: /Emergency freeze/i }),
      ).toHaveAttribute("aria-checked", "false");
    });

    it("renders without a wallet, a backend, or an onToggle handler", () => {
      render(<ContractPauseSwitch initialState={MOCK_CONTRACT_PAUSE_STATE} />);

      expect(screen.getByTestId("contract-pause-switch")).toBeInTheDocument();
      expect(() =>
        fireEvent.click(screen.getByRole("switch", { name: /Emergency freeze/i })),
      ).not.toThrow();
    });
  });

  // =========================================================================
  // Backend API URL construction (#480)
  // =========================================================================

  describe("Backend API URL construction (#480)", () => {
    it("hits the configured BACKEND_URL when no apiUrl override is given", async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                ...MOCK_CONTRACT_PAUSE_STATE,
                paused: false,
                reason: "All clear.",
              },
            }),
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchContractPauseState();

      expect(fetchMock).toHaveBeenCalledOnce();
      const calledUrl = String((fetchMock.mock.calls as unknown[][])[0][0]);
      // The URL must include the backend host and the is_paused query method.
      expect(calledUrl).toContain("/api/jobs/query");
      expect(calledUrl).toContain("method=is_paused");
      expect(result.paused).toBe(false);
    });

    it("uses the apiUrl override when provided", async () => {
      const customUrl = "https://staging.example.com/api/pause-state";
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_CONTRACT_PAUSE_STATE),
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await fetchContractPauseState({ apiUrl: customUrl });

      expect((fetchMock.mock.calls as unknown[][])[0][0]).toBe(customUrl);
    });

    it("falls back to mock when the backend returns a valid envelope with incomplete data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ success: true, data: { paused: true } }),
          }),
        ),
      );

      const result = await fetchContractPauseState();
      expect(result).toEqual(MOCK_CONTRACT_PAUSE_STATE);
    });
  });

  // =========================================================================
  // Input sanitization
  // =========================================================================

  describe("Input sanitization", () => {
    it("detects script tags and javascript: payloads", () => {
      expect(containsCodeTags("<script>alert(1)</script>")).toBe(true);
      expect(containsCodeTags("<img src=x onerror=alert(1)>")).toBe(true);
      expect(containsCodeTags("javascript:alert(1)")).toBe(true);
      expect(containsCodeTags("JAVASCRIPT:void(0)")).toBe(true);
    });

    it("passes clean text through", () => {
      expect(containsCodeTags("Normal freeze reason")).toBe(false);
      expect(containsCodeTags("CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH")).toBe(false);
      expect(containsCodeTags("2026-09-24T18:42:00Z")).toBe(false);
    });

    it("sanitizePauseField strips injected payloads to empty string", () => {
      expect(sanitizePauseField("<script>alert(1)</script>")).toBe("");
      expect(sanitizePauseField("javascript:void(0)")).toBe("");
      expect(sanitizePauseField("<b>bold</b>")).toBe("");
    });

    it("sanitizePauseField trims whitespace from clean values", () => {
      expect(sanitizePauseField("  reason  ")).toBe("reason");
      expect(sanitizePauseField("")).toBe("");
    });

    it("getContractPauseReadouts collapses injected fields to a dash", () => {
      const readouts = getContractPauseReadouts({
        ...MOCK_CONTRACT_PAUSE_STATE,
        reason: "<script>alert(1)</script>",
        updatedBy: "javascript:void(0)",
        contractId: "<img src=x>",
      });

      expect(readouts.reason).toBe("—");
      expect(readouts.updatedBy).toBe("—");
      expect(readouts.contractId).toBe("—");
      // Phase is derived from the boolean, not from user text — must be unaffected.
      expect(readouts.phase).toBe("Frozen");
    });

    it("renders a dash instead of injected content in the readout cells", () => {
      render(
        <ContractPauseSwitch
          initialState={{
            ...MOCK_CONTRACT_PAUSE_STATE,
            reason: "<script>alert(1)</script>",
            contractId: "<b>EVIL</b>",
          }}
        />,
      );

      // The raw injected string must never appear in the DOM.
      expect(screen.queryByText(/<script>/)).toBeNull();
      expect(screen.queryByText(/<b>EVIL<\/b>/)).toBeNull();

      // Both poisoned fields collapse to the dash fallback.
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Status badges
  // =========================================================================

  describe("Status badges", () => {
    it("each badge has a label, icon and className", () => {
      for (const badge of Object.values(CONTRACT_PAUSE_BADGES)) {
        expect(badge.label.length).toBeGreaterThan(0);
        expect(badge.icon.length).toBeGreaterThan(0);
        expect(badge.className).toContain("rounded-full");
      }
    });

    it("getContractPauseBadge returns frozen when paused and not pending", () => {
      expect(getContractPauseBadge(true, false).status).toBe("frozen");
    });

    it("getContractPauseBadge returns active when not paused and not pending", () => {
      expect(getContractPauseBadge(false, false).status).toBe("active");
    });

    it("getContractPauseBadge returns pending while a tx is in flight", () => {
      expect(getContractPauseBadge(true, true).status).toBe("pending");
      expect(getContractPauseBadge(false, true).status).toBe("pending");
    });

    it("frozen badge uses red colour tokens", () => {
      expect(CONTRACT_PAUSE_BADGES.frozen.className).toContain("red");
    });

    it("active badge uses green colour tokens", () => {
      expect(CONTRACT_PAUSE_BADGES.active.className).toContain("green");
    });

    it("pending badge uses amber colour tokens", () => {
      expect(CONTRACT_PAUSE_BADGES.pending.className).toContain("amber");
    });

    it("renders the frozen badge in the header and state cell when paused", () => {
      render(<ContractPauseSwitch initialState={MOCK_CONTRACT_PAUSE_STATE} />);

      const badges = screen.getAllByTestId(/contract-pause-(status|state)-badge/);
      for (const badge of badges) {
        expect(badge).toHaveAttribute("data-status", "frozen");
        expect(badge.textContent).toContain("Frozen");
      }
    });

    it("renders the active badge when the contract is live", () => {
      render(
        <ContractPauseSwitch
          initialState={{ ...MOCK_CONTRACT_PAUSE_STATE, paused: false }}
        />,
      );

      const badges = screen.getAllByTestId(/contract-pause-(status|state)-badge/);
      for (const badge of badges) {
        expect(badge).toHaveAttribute("data-status", "active");
        expect(badge.textContent).toContain("Active");
      }
    });

    it("renders the pending badge while a transaction is in flight", () => {
      render(
        <ContractPauseSwitch initialState={MOCK_CONTRACT_PAUSE_STATE} isPending />,
      );

      const badges = screen.getAllByTestId(/contract-pause-(status|state)-badge/);
      for (const badge of badges) {
        expect(badge).toHaveAttribute("data-status", "pending");
        expect(badge.textContent).toContain("Pending");
      }
    });

    it("controlled paused=false shows active badge regardless of initialState", () => {
      render(
        <ContractPauseSwitch
          initialState={MOCK_CONTRACT_PAUSE_STATE}
          paused={false}
        />,
      );

      const badges = screen.getAllByTestId(/contract-pause-(status|state)-badge/);
      for (const badge of badges) {
        expect(badge).toHaveAttribute("data-status", "active");
      }
    });
  });

  // =========================================================================
  // Toast notifications
  // =========================================================================

  describe("Toast notifications", () => {
    it("success toast for freeze has type success and mentions frozen", () => {
      const toast = contractPauseSuccessToast(true);
      expect(toast.type).toBe("success");
      expect(toast.message.toLowerCase()).toContain("frozen");
    });

    it("success toast for unfreeze has type success and mentions active", () => {
      const toast = contractPauseSuccessToast(false);
      expect(toast.type).toBe("success");
      expect(toast.message.toLowerCase()).toContain("active");
    });

    it("error toast has type error and includes the reason", () => {
      const toast = contractPauseErrorToast("wallet rejected");
      expect(toast.type).toBe("error");
      expect(toast.message).toContain("wallet rejected");
    });

    it("error toast includes a human-readable prefix", () => {
      const toast = contractPauseErrorToast("timeout");
      expect(toast.message.toLowerCase()).toContain("failed");
    });

    it("freeze and unfreeze produce distinct messages", () => {
      expect(contractPauseSuccessToast(true).message).not.toBe(
        contractPauseSuccessToast(false).message,
      );
    });
  });
});
