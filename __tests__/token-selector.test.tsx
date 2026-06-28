import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => body }),
  );
}

describe("Create Job token selector (#4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("populates the dropdown from the whitelist with symbol/name labels", async () => {
    stubFetch({
      success: true,
      data: [
        { address: "CUSDC", symbol: "USDC" },
        { address: "CLUMENADDRESSxxxx", name: "Lumens" },
      ],
    });
    render(<CreateJob />);

    expect(await screen.findByRole("option", { name: "USDC" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lumens" })).toBeInTheDocument();

    const select = screen.getByLabelText("Token Contract Address") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "CUSDC" } });
    expect(select.value).toBe("CUSDC");
  });

  it("falls back to a truncated address when no symbol/name is provided", async () => {
    stubFetch({ data: ["CABCDEFGHIJKLMNOP"] });
    render(<CreateJob />);
    expect(await screen.findByRole("option", { name: "CABC…MNOP" })).toBeInTheDocument();
  });

  it("shows a message (not a broken dropdown) when the whitelist is empty", async () => {
    stubFetch({ success: true, data: [] });
    render(<CreateJob />);
    expect(await screen.findByTestId("token-whitelist-empty")).toBeInTheDocument();
    expect(screen.queryByLabelText("Token Contract Address")).not.toBeInTheDocument();
  });

  it("shows an error message when the whitelist fails to load", async () => {
    stubFetch({}, false);
    render(<CreateJob />);
    expect(await screen.findByTestId("token-whitelist-error")).toBeInTheDocument();
  });
});
