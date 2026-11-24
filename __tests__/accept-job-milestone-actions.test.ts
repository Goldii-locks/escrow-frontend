import { describe, it, expect } from "vitest";
import {
  needsFreelancerAcceptance,
  needsArbiterAcceptance,
  isJobFullyAccepted,
} from "@/app/lib/milestone_actions";

describe("needsFreelancerAcceptance", () => {
  it("returns true when freelancerAccepted is false", () => {
    expect(needsFreelancerAcceptance({ freelancerAccepted: false })).toBe(true);
  });

  it("returns false when freelancerAccepted is true", () => {
    expect(needsFreelancerAcceptance({ freelancerAccepted: true })).toBe(false);
  });

  it("returns false when freelancerAccepted is undefined (graceful degradation)", () => {
    expect(needsFreelancerAcceptance({})).toBe(false);
    expect(needsFreelancerAcceptance({ freelancerAccepted: undefined })).toBe(false);
  });
});

describe("needsArbiterAcceptance", () => {
  it("returns true when arbiterAccepted is false", () => {
    expect(needsArbiterAcceptance({ arbiterAccepted: false })).toBe(true);
  });

  it("returns false when arbiterAccepted is true", () => {
    expect(needsArbiterAcceptance({ arbiterAccepted: true })).toBe(false);
  });

  it("returns false when arbiterAccepted is undefined (graceful degradation)", () => {
    expect(needsArbiterAcceptance({})).toBe(false);
    expect(needsArbiterAcceptance({ arbiterAccepted: undefined })).toBe(false);
  });
});

describe("isJobFullyAccepted", () => {
  it("returns true when both undefined (graceful degradation)", () => {
    expect(isJobFullyAccepted({})).toBe(true);
  });

  it("returns true when both are true", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: true, arbiterAccepted: true })).toBe(true);
  });

  it("returns false when freelancerAccepted is false", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: false, arbiterAccepted: true })).toBe(false);
  });

  it("returns false when arbiterAccepted is false", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: true, arbiterAccepted: false })).toBe(false);
  });

  it("returns false when both are false", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: false, arbiterAccepted: false })).toBe(false);
  });

  it("returns true when freelancerAccepted=true and arbiterAccepted=undefined", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: true })).toBe(true);
  });

  it("returns false when freelancerAccepted=false and arbiterAccepted=undefined", () => {
    expect(isJobFullyAccepted({ freelancerAccepted: false })).toBe(false);
  });
});
