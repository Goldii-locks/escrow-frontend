import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  checkSubmission,
  hasTokenIssue,
  nonBlank,
  summarizeMilestones,
  validatePartyAddressCollisions,
  validateAccountAddress,
  validateDeadline,
  validateTokenAddress,
  type SubmissionInput,
  type TokenStatus,
} from "@/app/(app)/create/validation";

// Real StrKeys: validation checks the checksum, not just the shape (#579).
const ACCOUNT = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H";
const OTHER_ACCOUNT = "GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA";
const THIRD_ACCOUNT = Keypair.random().publicKey();
const TOKEN = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
// ACCOUNT with its last character changed: right shape, bad checksum.
const BAD_CHECKSUM = ACCOUNT.slice(0, -1) + (ACCOUNT.endsWith("A") ? "B" : "A");

describe("validateAccountAddress", () => {
  it("accepts an empty value and a well-formed G… key", () => {
    expect(validateAccountAddress("")).toBe("");
    expect(validateAccountAddress(ACCOUNT)).toBe("");
  });

  it("accepts a well-formed C… contract address (#834)", () => {
    expect(validateAccountAddress(TOKEN)).toBe("");
  });

  it.each(["GABC", "g" + "a".repeat(55), ACCOUNT + "A", BAD_CHECKSUM])("rejects %s", (value) => {
    expect(validateAccountAddress(value)).toBe(
      "Invalid Stellar public key or contract address format"
    );
  });

  it("rejects a C… address with a bad checksum (#834)", () => {
    const badContractChecksum = TOKEN.slice(0, -1) + (TOKEN.endsWith("A") ? "B" : "A");
    expect(validateAccountAddress(badContractChecksum)).toBe(
      "Invalid Stellar public key or contract address format"
    );
  });
});

describe("validateTokenAddress", () => {
  it("accepts an empty value and a well-formed C… contract id", () => {
    expect(validateTokenAddress("")).toBe("");
    expect(validateTokenAddress(TOKEN)).toBe("");
  });

  it("rejects an account key", () => {
    expect(validateTokenAddress(ACCOUNT)).toBe("Invalid Soroban contract ID format");
  });
});

describe("validateDeadline", () => {
  it.each([
    ["", "Response deadline is required"],
    ["  ", "Response deadline is required"],
    ["1.5", "Must be a whole number of days"],
    ["abc", "Must be a whole number of days"],
    ["0", "Must be at least 1 day"],
    ["366", "Must be at most 365 days"],
  ])("%j → %s", (value, message) => {
    expect(validateDeadline(value)).toBe(message);
  });

  it.each(["1", "7", "365"])("accepts %s", (value) => {
    expect(validateDeadline(value)).toBeNull();
  });
});

describe("nonBlank", () => {
  it("drops empty and whitespace-only entries", () => {
    expect(nonBlank(["USDC", "", "  ", "XLM"])).toEqual(["USDC", "XLM"]);
  });
});

describe("validatePartyAddressCollisions", () => {
  it.each([
    [
      { client: ACCOUNT, freelancer: ACCOUNT, arbiter: OTHER_ACCOUNT },
      "The freelancer can't be your own address.",
      "",
      "",
    ],
    [
      { client: ACCOUNT, freelancer: THIRD_ACCOUNT, arbiter: ACCOUNT },
      "",
      "The arbiter can't be your own address.",
      "",
    ],
    [
      { client: THIRD_ACCOUNT, freelancer: ACCOUNT, arbiter: ACCOUNT },
      "",
      "The arbiter can't use the freelancer's address.",
      "",
    ],
    [
      { client: ACCOUNT, freelancer: THIRD_ACCOUNT, arbiter: OTHER_ACCOUNT, adminAddress: ACCOUNT },
      "",
      "",
      "The client can't be the platform admin address.",
    ],
    [
      { client: THIRD_ACCOUNT, freelancer: ACCOUNT, arbiter: OTHER_ACCOUNT, adminAddress: ACCOUNT },
      "The freelancer can't be the platform admin address.",
      "",
      "",
    ],
    [
      {
        client: THIRD_ACCOUNT,
        freelancer: ACCOUNT,
        arbiter: OTHER_ACCOUNT,
        adminAddress: OTHER_ACCOUNT,
      },
      "",
      "The arbiter can't be the platform admin address.",
      "",
    ],
  ])("rejects overlapping roles: %j", (input, freelancerError, arbiterError, clientError) => {
    expect(validatePartyAddressCollisions(input)).toEqual({
      clientError,
      freelancerError,
      arbiterError,
    });
  });
});

describe("summarizeMilestones", () => {
  it("flags an empty list", () => {
    expect(summarizeMilestones([])).toMatchObject({ hasNoMilestones: true });
  });

  it("flags blank rows as partial, not invalid", () => {
    const s = summarizeMilestones([{ amount: "100" }, { amount: " " }]);
    expect(s).toMatchObject({ hasPartialMilestones: true, hasInvalidMilestones: false });
  });

  it("flags non-numeric rows as invalid", () => {
    expect(summarizeMilestones([{ amount: "10.5abc" }]).hasInvalidMilestones).toBe(true);
  });

  it("accepts decimal token amounts (#574)", () => {
    expect(summarizeMilestones([{ amount: "10.5" }]).hasInvalidMilestones).toBe(false);
  });

  it("drops malformed rows", () => {
    const rows = [{ amount: "1" }, null, undefined, { amount: 5 } as unknown as { amount: string }];
    expect(summarizeMilestones(rows).milestones).toEqual([{ amount: "1" }]);
  });
});

describe("hasTokenIssue", () => {
  const base: TokenStatus = {
    token: TOKEN,
    whitelisted: false,
    validating: false,
    validation: { valid: true, symbol: "TKN", decimals: 7 },
    confirmed: true,
  };

  it("is clear for a whitelisted token, an empty token or a malformed one", () => {
    expect(hasTokenIssue({ ...base, whitelisted: true, confirmed: false })).toBe(false);
    expect(hasTokenIssue({ ...base, token: "" })).toBe(false);
    expect(hasTokenIssue({ ...base, token: "CABC", confirmed: false })).toBe(false);
  });

  it("blocks while validating, on an invalid token, or before confirmation", () => {
    expect(hasTokenIssue({ ...base, validating: true, validation: null })).toBe(true);
    expect(hasTokenIssue({ ...base, validation: { valid: false, error: "nope" } })).toBe(true);
    expect(hasTokenIssue({ ...base, confirmed: false })).toBe(true);
  });

  it("is clear for a validated, confirmed non-whitelisted token", () => {
    expect(hasTokenIssue(base)).toBe(false);
  });

  it("blocks any unlisted well-formed token when factory is configured (#833)", () => {
    // Even a validated, confirmed token is blocked when the factory is configured.
    expect(hasTokenIssue(base, true)).toBe(true);
  });

  it("is clear for a whitelisted token even when factory is configured", () => {
    expect(hasTokenIssue({ ...base, whitelisted: true }, true)).toBe(false);
  });
});

describe("checkSubmission", () => {
  const valid: SubmissionInput = {
    client: THIRD_ACCOUNT,
    freelancer: ACCOUNT,
    arbiter: OTHER_ACCOUNT,
    autoReleaseDays: "7",
    milestones: summarizeMilestones([{ amount: "100" }]),
    token: { token: TOKEN, listed: true, validating: false, validation: null, confirmed: false },
    factoryConfigured: false,
  };

  it("passes a complete form", () => {
    expect(checkSubmission(valid)).toEqual({ ok: true });
  });

  it.each([
    [{ freelancer: valid.client }, "The freelancer can't be your own address."],
    [{ arbiter: valid.client }, "The arbiter can't be your own address."],
    [{ arbiter: valid.freelancer }, "The arbiter can't use the freelancer's address."],
    [{ adminAddress: valid.client }, "The client can't be the platform admin address."],
    [{ adminAddress: valid.freelancer }, "The freelancer can't be the platform admin address."],
    [{ adminAddress: valid.arbiter }, "The arbiter can't be the platform admin address."],
  ])("rejects colliding party addresses: %j", (overrides, message) => {
    expect(checkSubmission({ ...valid, ...overrides })).toMatchObject({
      ok: false,
      message,
    });
  });

  it("reports the deadline first, with its field error", () => {
    const result = checkSubmission({
      ...valid,
      autoReleaseDays: "0",
      milestones: summarizeMilestones([]),
    });
    expect(result).toEqual({
      ok: false,
      message: "Please fix the response deadline before creating a job.",
      deadlineError: "Must be at least 1 day",
    });
  });

  it.each([
    [[], "Add at least one milestone amount before creating a job."],
    [[{ amount: "" }], "Complete each milestone amount before creating a job."],
    [[{ amount: "1e5" }], "Milestone amounts must contain only numeric characters."],
  ])("reports milestone problems: %j", (rows, message) => {
    expect(checkSubmission({ ...valid, milestones: summarizeMilestones(rows) })).toMatchObject({
      ok: false,
      message,
    });
  });

  it("requires a token", () => {
    expect(checkSubmission({ ...valid, token: { ...valid.token, token: "" } })).toMatchObject({
      message: "Select an accepted token before creating a job.",
    });
  });

  it.each([
    [{ validating: true }, "Token validation is still in progress. Please wait."],
    [
      { validation: { valid: false, error: "x" } },
      "The entered token is not a valid SEP-41 token contract.",
    ],
    [
      { validation: { valid: true, symbol: "T", decimals: 7 } },
      "Confirm the non-whitelisted token before creating a job.",
    ],
  ])("gates an unlisted token: %j", (overrides, message) => {
    const token = { ...valid.token, listed: false, ...overrides };
    expect(checkSubmission({ ...valid, token })).toMatchObject({ ok: false, message });
  });

  it("accepts an unlisted token once validated and confirmed", () => {
    const token = {
      ...valid.token,
      listed: false,
      validation: { valid: true, symbol: "T", decimals: 7 },
      confirmed: true,
    };
    expect(checkSubmission({ ...valid, token })).toEqual({ ok: true });
  });

  it("blocks an unlisted token immediately when factory is configured (#833)", () => {
    const token = { ...valid.token, listed: false };
    expect(checkSubmission({ ...valid, token, factoryConfigured: true })).toMatchObject({
      ok: false,
      message: "This token isn't accepted for new escrows.",
    });
  });

  it("does not reach the SEP-41/confirm checks when factory is configured", () => {
    // Even a 'validated and confirmed' unlisted token is blocked with the factory.
    const token = {
      ...valid.token,
      listed: false,
      validation: { valid: true, symbol: "T", decimals: 7 },
      confirmed: true,
    };
    expect(checkSubmission({ ...valid, token, factoryConfigured: true })).toMatchObject({
      ok: false,
      message: "This token isn't accepted for new escrows.",
    });
  });

  it("marks missing and malformed addresses on their fields", () => {
    expect(checkSubmission({ ...valid, freelancer: "", arbiter: "GBAD" })).toEqual({
      ok: false,
      message: "Please fix the address fields before creating a job.",
      freelancerError: "This field is required.",
      arbiterError: "Invalid Stellar public key or contract address format",
    });
  });

  it("clears the error on the valid address when only the other is wrong", () => {
    expect(checkSubmission({ ...valid, arbiter: "" })).toMatchObject({
      freelancerError: "",
      arbiterError: "This field is required.",
    });
  });
});
