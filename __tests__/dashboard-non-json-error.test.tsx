import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";
import { SERVICE_UNAVAILABLE_MESSAGE } from "@/app/lib/api_response";

const mockUseWallet = vi.fn();
const mockUseToast = vi.fn();
const mockUseActionStates = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/app/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));
vi.mock("@/app/components/MilestoneCard", () => ({
  default: () => <div data-testid="milestone-card" />,
}));

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => mockUseActionStates(),
}));

function htmlErrorResponse(status: number, includeContentType = true) {
  return {
    ok: false,
    status,
    headers: includeContentType
      ? new Headers({ "content-type": "text/html; charset=utf-8" })
      : new Headers(),
    json: async () => {
      throw new SyntaxError('Unexpected token \'<\', "<html>..." is not valid JSON');
    },
  } as unknown as Response;
}

describe("Dashboard non-JSON backend errors (issue #844)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
    mockUseToast.mockReturnValue({
      showToast: vi.fn(),
      toasts: [],
      hideToast: vi.fn(),
    });
    mockUseActionStates.mockReturnValue({
      getState: () => ({ phase: "idle", error: null, txHash: null }),
      isPending: () => false,
      setPhase: vi.fn(),
      setError: vi.fn(),
      setTxHash: vi.fn(),
    });
  });

  it("shows the friendly service message and retry button for a 502 HTML page", async () => {
    const json = vi.fn(() => {
      throw new SyntaxError('Unexpected token \'<\', "<html>..." is not valid JSON');
    });
    const response = {
      ok: false,
      status: 502,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      json,
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });
    expect(screen.getByText(SERVICE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-retry-button")).toBeInTheDocument();
    expect(json).not.toHaveBeenCalled();
  });

  it("shows the friendly message when a 504 body throws on json()", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlErrorResponse(504, false)));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(SERVICE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-retry-button")).toBeInTheDocument();
  });
});
