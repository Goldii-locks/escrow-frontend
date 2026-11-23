import { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";
import WhitelistConfirmModal from "@/app/components/WhitelistConfirmModal";
import WalletSelectorModal from "@/app/components/WalletSelectorModal";
import ReleaseConfirmModal from "@/app/components/ReleaseConfirmModal";

const showToast = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
  ],
}));

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function Harness({
  children,
}: {
  children: (open: boolean, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {children(open, () => setOpen(false))}
    </>
  );
}

/** Shared acceptance checks for every live modal in the application. */
function expectAccessibleDialogBehaviour(dialog: HTMLElement) {
  const trigger = screen.getByRole("button", { name: "Open dialog" });

  // Focus moves into the dialog when it opens and starts on a control inside.
  expect(dialog.contains(document.activeElement)).toBe(true);

  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  expect(first).toBeDefined();
  expect(last).toBeDefined();

  // Tab from the last control wraps to the first; Shift+Tab wraps back.
  last.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(first).toHaveFocus();

  first.focus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();

  // Escape dismisses the dialog and returns focus to the trigger.
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
}

async function expectNoAxeViolations(dialog: HTMLElement) {
  const results = await axe.run(dialog, {
    rules: {
      // jsdom has no layout engine, so colour-contrast cannot be computed.
      "color-contrast": { enabled: false },
    },
  });
  expect(results.violations).toEqual([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("modal focus management (#868)", () => {
  it("manages focus in DisputeRaiseModal", async () => {
    render(
      <Harness>
        {(open, close) => (
          <DisputeRaiseModal
            isOpen={open}
            onClose={close}
            milestoneIndex={1}
            amount="10 XLM"
            counterparty="GABC"
          />
        )}
      </Harness>,
    );

    // A real pointer click focuses the trigger in a browser; fireEvent does not.
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByTestId("dispute-raise-modal");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await expectNoAxeViolations(dialog);
    expectAccessibleDialogBehaviour(dialog);
  });

  it("does not close DisputeRaiseModal with Escape while submitting", () => {
    const onClose = vi.fn();
    render(
      <DisputeRaiseModal
        isOpen
        onClose={onClose}
        isLoading
        milestoneIndex={0}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("dispute-raise-modal")).toBeInTheDocument();
  });

  it("manages focus in WhitelistConfirmModal", async () => {
    render(
      <Harness>
        {(open, close) => (
          <WhitelistConfirmModal
            action={open ? { kind: "add", token: "GTOKEN" } : null}
            onCancel={close}
            onConfirm={vi.fn()}
          />
        )}
      </Harness>,
    );

    // A real pointer click focuses the trigger in a browser; fireEvent does not.
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByTestId("whitelist-confirm-modal");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "whitelist-confirm-title");
    await expectNoAxeViolations(dialog);
    expectAccessibleDialogBehaviour(dialog);
  });

  it("manages focus in WalletSelectorModal", async () => {
    render(
      <Harness>
        {(open, close) => (
          <WalletSelectorModal
            isOpen={open}
            onClose={close}
            freighterDetector={() => true}
          />
        )}
      </Harness>,
    );

    // A real pointer click focuses the trigger in a browser; fireEvent does not.
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByTestId("wallet-selector-modal");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "wallet-selector-modal-title",
    );
    await expectNoAxeViolations(dialog);
    expectAccessibleDialogBehaviour(dialog);
  });

  it("manages focus in ReleaseConfirmModal", async () => {
    render(
      <Harness>
        {(open, close) => (
          <ReleaseConfirmModal
            isOpen={open}
            onClose={close}
            onConfirm={vi.fn()}
            action="approve"
            amountStroops="40000000"
            decimals={7}
            symbol="XLM"
          />
        )}
      </Harness>,
    );

    // A real pointer click focuses the trigger in a browser; fireEvent does not.
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByTestId("release-confirm-modal");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await expectNoAxeViolations(dialog);
    expectAccessibleDialogBehaviour(dialog);
  });

  it("keeps ReleaseConfirmModal open while a transaction is pending", () => {
    const onClose = vi.fn();
    render(
      <ReleaseConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
        action="approve"
        amountStroops="10000000"
        isConfirming
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("release-confirm-modal")).toBeInTheDocument();
  });
});
