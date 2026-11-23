import { describe, expect, it } from "vitest";
import { agreementLines } from "@/app/lib/escrow_agreement";

describe("agreementLines", () => {
  it("reflects the entered auto-release days and arbiter", () => {
    const lines = agreementLines({ autoReleaseDays: "14", arbiter: "GARBITER123" });
    const autoRelease = lines.find((l) => l.label === "Auto-release");
    expect(autoRelease).toBeDefined();
    expect(autoRelease!.text).toContain("14 days");
    expect(autoRelease!.text).toContain("unless you explicitly approve or dispute it");

    const arbiterLine = lines.find((l) => l.label === "Arbiter");
    expect(arbiterLine).toBeDefined();
    expect(arbiterLine!.text).toContain("GARBITER123");
  });

  it("uses singular 'day' when autoReleaseDays is 1", () => {
    const lines = agreementLines({ autoReleaseDays: "1", arbiter: "GARB" });
    const autoRelease = lines.find((l) => l.label === "Auto-release");
    expect(autoRelease!.text).toContain("1 day");
  });

  it("always includes the funds-locked and platform-admin rules", () => {
    const lines = agreementLines({ autoReleaseDays: "7", arbiter: "GARB" });
    expect(lines.find((l) => l.label === "Funds locked")).toBeDefined();
    expect(lines.find((l) => l.label === "Platform admin")).toBeDefined();
  });

  it("falls back to defaults for empty inputs", () => {
    const lines = agreementLines({ autoReleaseDays: "", arbiter: "" });
    const autoRelease = lines.find((l) => l.label === "Auto-release");
    expect(autoRelease!.text).toContain("7 days");
    const arbiterLine = lines.find((l) => l.label === "Arbiter");
    expect(arbiterLine!.text).toContain("the arbiter");
  });
});
