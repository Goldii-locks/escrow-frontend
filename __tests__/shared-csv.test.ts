// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { downloadCsv, escapeCsvCell, toCsv } from "@/app/lib/shared/csv";

describe("shared CSV helpers", () => {
  it.each(["=", "+", "-", "@", "\t", "\r"])("neutralizes the %j prefix", (prefix) => {
    const cell = `'${prefix}value`;
    expect(escapeCsvCell(`${prefix}value`)).toBe(prefix === "\r" ? `"${cell}"` : cell);
  });

  it("quotes fields with commas, quotes or line breaks and separates rows with CRLF", () => {
    expect(
      toCsv([
        ["ID", "Notes"],
        [1, 'a,"b"\r\nc'],
        [2, null],
      ])
    ).toBe('ID,Notes\r\n1,"a,""b""\r\nc"\r\n2,');
  });

  it("downloads the UTF-8 CSV with a BOM", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      downloadCsv("example.csv", [["é"]]);

      const blob = createObjectURL.mock.calls[0][0];
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
        Uint8Array.of(0xef, 0xbb, 0xbf, 0xc3, 0xa9)
      );
      expect(click.mock.contexts[0]).toHaveProperty("download", "example.csv");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
