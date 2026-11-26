import { describe, expect, it } from "vitest";
import {
  canonicaliseSpec,
  hashSpec,
  type MilestoneSpec,
} from "@/app/lib/spec_hash";

describe("spec_hash canonicalisation", () => {
  const spec: MilestoneSpec = { title: "Design", description: "Wireframes + Figma" };

  it("produces sorted-key JSON with no whitespace", () => {
    expect(canonicaliseSpec(spec)).toBe('{"description":"Wireframes + Figma","title":"Design"}');
  });

  it("NFC-normalises strings", () => {
    const composed = { title: "café", description: "" }; // é as single code point
    const decomposed = { title: "cafe\u0301", description: "" }; // e + combining accent
    expect(canonicaliseSpec(composed)).toBe(canonicaliseSpec(decomposed));
  });

  it("trims whitespace", () => {
    expect(canonicaliseSpec({ title: "  Design  ", description: "  x  " })).toBe(
      '{"description":"x","title":"Design"}'
    );
  });
});

describe("spec_hash hashSpec", () => {
  it("hashes identical specs to identical hashes", async () => {
    const a = await hashSpec({ title: "Design", description: "Wireframes" });
    const b = await hashSpec({ title: "Design", description: "Wireframes" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different specs", async () => {
    const a = await hashSpec({ title: "Design", description: "Wireframes" });
    const b = await hashSpec({ title: "Design", description: "Mockups" });
    expect(a).not.toBe(b);
  });

  it("blank spec yields a valid 32-byte hash", async () => {
    const h = await hashSpec({ title: "", description: "" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
