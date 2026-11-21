/**
 * /admin targets one escrow at a time (#837): the whitelist and pause
 * controls only render once an escrow is picked. Tests that exercise those
 * controls select one first with this helper.
 */
import { fireEvent, screen } from "@testing-library/react";

/** A well-formed contract ID (C + 55 base-32 chars). */
export const TEST_ESCROW_ID = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";

/** Types `contractId` into the escrow picker and selects it. */
export function selectEscrow(contractId: string = TEST_ESCROW_ID): void {
  fireEvent.change(screen.getByLabelText("Escrow contract ID"), {
    target: { value: contractId },
  });
  fireEvent.click(screen.getByRole("button", { name: "Select escrow" }));
}
