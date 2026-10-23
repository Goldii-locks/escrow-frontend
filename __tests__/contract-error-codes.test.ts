import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, formatTxError, parseContractErrorCode } from "@/app/lib/errors";

const revert = (code: number) => new Error(`Contract execution reverted (error code ${code})`);

describe("contract error codes (#600)", () => {
  it("parses the code from the backend revert message", () => {
    expect(parseContractErrorCode("Contract execution reverted (error code 13)")).toBe(13);
    expect(parseContractErrorCode("something else")).toBeNull();
  });

  it("maps NotFunded, DeadlineNotPassed and Paused to their own messages", () => {
    expect(formatTxError(revert(4))).toMatch(/hasn't been funded yet/);
    expect(formatTxError(revert(11))).toMatch(/deadline has not passed/);
    expect(formatTxError(revert(13))).toMatch(/This escrow is paused/);
  });

  it("falls back to the generic message with the code for unknown codes", () => {
    expect(formatTxError(revert(999))).toBe(
      "The contract rejected this transaction (error code 999). Check the job state and try again."
    );
  });

  it("follows the contract's Error enum numbering", () => {
    // Spot checks against escrow-contract/contracts/milestone-escrow/src/lib.rs.
    expect(ERROR_MESSAGES[1]).toMatch(/already been initialized/); // AlreadyInitialized
    expect(ERROR_MESSAGES[8]).toMatch(/not on the escrow's whitelist/); // TokenNotWhitelisted
    expect(ERROR_MESSAGES[12]).toMatch(/addresses is invalid/); // InvalidAddress
    expect(ERROR_MESSAGES[37]).toMatch(/balance is too low/); // InsufficientBalance
    expect(Object.keys(ERROR_MESSAGES)).toHaveLength(37);
  });
});
